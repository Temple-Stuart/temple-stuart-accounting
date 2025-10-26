import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

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
          
          // Convert PDF to base64
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const base64 = buffer.toString('base64');

          console.log('✅ File converted to base64, length:', base64.length);

          // Extract with GPT-4o Vision
          console.log('🤖 Calling GPT-4o...');
          
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a data extraction expert. Extract ALL transaction data from Robinhood trade confirmation PDFs. Return JSON array with each transaction.'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract all transactions from this Robinhood PDF. For each transaction, return:
{
  "symbol": "NVDA",
  "strike": 150.00,
  "expiry": "2025-07-25",
  "contractType": "CALL",
  "action": "B" or "S" or "BTC" or "STO",
  "quantity": 1,
  "price": 7.30,
  "principal": 730.00,
  "fees": 0.04,
  "netAmount": 730.04,
  "tradeDate": "2025-06-25"
}

Return as JSON array. Include ALL fee fields (Comm, Contr Fee, Tran Fee). If stock transaction, omit strike/expiry/contractType.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64}`
                    }
                  }
                ]
              }
            ],
            temperature: 0,
            max_tokens: 2000
          });

          console.log('✅ GPT-4o responded');
          
          const result = completion.choices[0]?.message?.content;
          console.log('📊 Result:', result?.substring(0, 200));
          
          if (result) {
            const transactions = JSON.parse(result);
            console.log('✅ Parsed transactions:', transactions.length);
            allExtractedTransactions.push(...transactions);
          }

          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, error);
        }
      }
    }

    console.log('📊 Total extracted:', allExtractedTransactions.length);

    // Now match extracted transactions to existing Plaid data
    const existingTransactions = await prisma.investment_transactions.findMany({
      where: {
        account: {
          userId: (await prisma.users.findUnique({ where: { email: userEmail } }))!.id
        }
      },
      include: {
        security: true
      }
    });

    const matchedData = allExtractedTransactions.map(rhTxn => {
      // Try to match with existing Plaid transaction
      const match = existingTransactions.find(plaidTxn => {
        const dateDiff = Math.abs(
          new Date(rhTxn.tradeDate).getTime() - new Date(plaidTxn.date).getTime()
        ) / (1000 * 60 * 60 * 24);
        
        return (
          dateDiff <= 1 &&
          rhTxn.symbol === (plaidTxn.security?.ticker_symbol || '') &&
          Math.abs((rhTxn.strike || 0) - (plaidTxn.security?.option_strike_price || 0)) < 0.01 &&
          Math.abs(rhTxn.quantity - (plaidTxn.quantity || 0)) < 0.01
        );
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

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: files.length,
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
