import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await req.formData();
    const files = formData.getAll('pdfs') as File[];

    console.log('📁 Files received:', files.length);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No PDFs uploaded' }, { status: 400 });
    }

    const allExtractedTransactions = [];
    let processedCount = 0;

    // Process PDFs in batches of 10
    for (let i = 0; i < files.length; i += 10) {
      const batch = files.slice(i, i + 10);
      
      for (const file of batch) {
        try {
          console.log('📄 Processing file:', file.name, 'Size:', file.size);
          
          // Convert PDF to text
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          
          console.log('📖 Extracting text from PDF...');
          const pdfData = await pdf(buffer);
          const pdfText = pdfData.text;
          
          console.log('✅ Text extracted, length:', pdfText.length);
          console.log('📄 First 500 chars:', pdfText.substring(0, 500));

          // Extract with GPT-4o (text mode, not vision)
          console.log('🤖 Calling GPT-4o...');
          
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a data extraction expert specializing in Robinhood trade confirmation PDFs. Extract ALL transaction data and return valid JSON only - no markdown, no code blocks, just pure JSON.'
              },
              {
                role: 'user',
                content: `Extract all transactions from this Robinhood trade confirmation text. 

For each transaction, return this exact structure:
{
  "symbol": "NVDA",
  "strike": 150.00,
  "expiry": "2025-07-25",
  "contractType": "CALL" or "PUT",
  "action": "B" or "S" or "BTC" or "STO",
  "quantity": 1,
  "price": 7.30,
  "principal": 730.00,
  "fees": 0.04,
  "tranFee": 0.04,
  "contrFee": 0.00,
  "netAmount": 730.04,
  "tradeDate": "2025-06-25"
}

Return as JSON array with no markdown formatting. For stock transactions, set strike/expiry/contractType to null.

PDF TEXT:
${pdfText}`
              }
            ],
            temperature: 0,
            max_tokens: 4000
          });

          console.log('✅ GPT-4o responded');
          
          let result = completion.choices[0]?.message?.content || '';
          console.log('📊 Raw result:', result.substring(0, 300));
          
          // Clean up markdown formatting if present
          result = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          if (result) {
            try {
              const transactions = JSON.parse(result);
              console.log('✅ Parsed transactions:', Array.isArray(transactions) ? transactions.length : 'not an array');
              
              if (Array.isArray(transactions)) {
                allExtractedTransactions.push(...transactions);
              } else {
                console.error('❌ Result is not an array:', transactions);
              }
            } catch (parseError) {
              console.error('❌ JSON parse error:', parseError);
              console.error('Failed to parse:', result);
            }
          }

          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, error);
        }
      }
    }

    console.log('📊 Total extracted:', allExtractedTransactions.length);

    // Now match extracted transactions to existing Plaid data
    const user = await prisma.users.findUnique({ where: { email: userEmail } });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingTransactions = await prisma.investment_transactions.findMany({
      where: {
        account: {
          userId: user.id
        }
      },
      include: {
        security: true
      }
    });

    console.log('📊 Existing Plaid transactions:', existingTransactions.length);

    const matchedData = allExtractedTransactions.map(rhTxn => {
      // Try to match with existing Plaid transaction
      const match = existingTransactions.find(plaidTxn => {
        const dateDiff = Math.abs(
          new Date(rhTxn.tradeDate).getTime() - new Date(plaidTxn.date).getTime()
        ) / (1000 * 60 * 60 * 24);
        
        const symbolMatch = rhTxn.symbol === (plaidTxn.security?.ticker_symbol || '');
        const strikeMatch = Math.abs((rhTxn.strike || 0) - (plaidTxn.security?.option_strike_price || 0)) < 0.01;
        const qtyMatch = Math.abs(rhTxn.quantity - (plaidTxn.quantity || 0)) < 0.01;
        
        return dateDiff <= 1 && symbolMatch && strikeMatch && qtyMatch;
      });

      return {
        robinhoodData: rhTxn,
        plaidData: match ? {
          id: match.id,
          date: match.date,
          quantity: match.quantity,
          price: match.price,
          amount: match.amount,
          fees: match.fees,
          strike: match.security?.option_strike_price,
          expiry: match.security?.option_expiration_date,
          contractType: match.security?.option_contract_type
        } : null,
        matchStatus: match ? 
          (Math.abs((match.fees || 0) - rhTxn.fees) > 0.01 ? 'fee_mismatch' : 'matched') : 
          'missing_from_plaid'
      };
    });

    console.log('📊 Matched data:', matchedData.length);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: files.length,
      extracted: allExtractedTransactions.length,
      matches: matchedData
    });

  } catch (error) {
    console.error('❌ PDF upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to process PDFs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
