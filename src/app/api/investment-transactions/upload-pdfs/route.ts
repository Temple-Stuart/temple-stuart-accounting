import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { parseRobinhoodPDF } from '@/lib/robinhood-parser';
import { PDFParse } from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


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
          const parser = new PDFParse({ data: buffer }); const pdfData = await parser.getText();
          const pdfText = pdfData.text;
          
          console.log('✅ Text extracted, length:', pdfText.length);
          console.log('📄 First 500 chars:', pdfText.substring(0, 500));


          // Extract with regex parser
          console.log('🔍 Parsing PDF with regex...');
          const transactions = parseRobinhoodPDF(pdfText);
          console.log('✅ Parsed transactions:', transactions.length);
          allExtractedTransactions.push(...transactions);

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
        accounts: {
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

    // Save RH data to matched transactions
    const updatePromises = matchedData
      .filter(m => m.plaidData) // Only update matched transactions
      .map(m => 
        prisma.investment_transactions.update({
          where: { id: m.plaidData!.id },
          data: {
            rhQuantity: m.robinhoodData.quantity,
            rhPrice: m.robinhoodData.price,
            rhPrincipal: m.robinhoodData.principal,
            rhFees: m.robinhoodData.fees,
            rhTranFee: m.robinhoodData.tranFee,
            rhContrFee: m.robinhoodData.contrFee,
            rhNetAmount: m.robinhoodData.netAmount,
            rhAction: m.robinhoodData.action,
            reconciliationStatus: m.matchStatus,
            isReconciled: false,
          }
        })
      );

    await Promise.all(updatePromises);
    console.log('💾 Saved RH data to', updatePromises.length, 'matched transactions');

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
