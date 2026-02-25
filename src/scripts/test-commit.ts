import { PrismaClient } from '@prisma/client';
import { commitPlaidTransaction, reversePlaidTransaction } from '../lib/journal-entry-service';

const prisma = new PrismaClient({ log: ['error'] });

const USER_ID = 'cmfi3rcrl0000zcj0ajbj4za5';
const ENTITY_ID = 'e83f5b3a-0b46-4c73-8b91-1b736ecdd3eb'; // Personal Finances
const TXN_ID = 'OxRk3vYZrbi07gyxd9JPtbAKvqjXVMFZk1j7r'; // Starbucks $10.75
const EXPENSE_CODE = '6110'; // Coffee & Snacks
const BANK_CODE = '1010';    // Primary Checking

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function main() {
  try {
    // ═══════════════════════════════════════════
    // STEP 1: COMMIT
    // ═══════════════════════════════════════════
    console.log('\n=== STEP 1: Commit Starbucks $10.75 ===');
    const journalEntry = await commitPlaidTransaction(prisma, {
      userId: USER_ID,
      entityId: ENTITY_ID,
      transactionId: TXN_ID,
      accountCode: EXPENSE_CODE,
      bankAccountCode: BANK_CODE,
      date: new Date('2026-02-19'),
      amount: 10.75, // positive = expense
      description: 'Starbucks',
      merchantName: 'Starbucks',
    });

    assert('Journal entry created', !!journalEntry.id);
    assert('Source type is plaid_txn', journalEntry.source_type === 'plaid_txn');
    assert('Source ID is transaction ID', journalEntry.source_id === TXN_ID);
    assert('Status is posted', journalEntry.status === 'posted');
    console.log(`  Journal entry ID: ${journalEntry.id}`);

    // Query ledger entries
    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: { journal_entry_id: journalEntry.id },
      include: { account: { select: { code: true, balance_type: true } } },
      orderBy: { entry_type: 'asc' }, // C first, then D
    });

    console.log('\n--- Ledger Entries ---');
    for (const le of ledgerEntries) {
      console.log(`  ${le.entry_type} ${le.account.code} ${le.amount} cents (account balance_type: ${le.account.balance_type})`);
    }

    assert('2 ledger entries created', ledgerEntries.length === 2);

    const debitEntry = ledgerEntries.find(le => le.entry_type === 'D');
    const creditEntry = ledgerEntries.find(le => le.entry_type === 'C');

    assert('Debit entry exists', !!debitEntry);
    assert('Credit entry exists', !!creditEntry);
    assert('Debit amount is 1075 cents', debitEntry?.amount === BigInt(1075),
      `got ${debitEntry?.amount}`);
    assert('Credit amount is 1075 cents', creditEntry?.amount === BigInt(1075),
      `got ${creditEntry?.amount}`);
    assert('Debit account is 6110 (expense)', debitEntry?.account.code === EXPENSE_CODE,
      `got ${debitEntry?.account.code}`);
    assert('Credit account is 1010 (bank)', creditEntry?.account.code === BANK_CODE,
      `got ${creditEntry?.account.code}`);

    // Query COA balances
    const expenseCoa = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: EXPENSE_CODE } },
    });
    const bankCoa = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: BANK_CODE } },
    });

    console.log('\n--- COA Balances After Commit ---');
    console.log(`  6110 (expense, balance_type D): settled_balance = ${expenseCoa?.settled_balance}`);
    console.log(`  1010 (bank,    balance_type D): settled_balance = ${bankCoa?.settled_balance}`);

    // 6110 is expense (D). Debit to D-type account → ADD → +1075
    assert('6110 balance is 1075', expenseCoa?.settled_balance === BigInt(1075),
      `got ${expenseCoa?.settled_balance}`);
    // 1010 is asset (D). Credit to D-type account → SUBTRACT → -1075
    assert('1010 balance is -1075', bankCoa?.settled_balance === BigInt(-1075),
      `got ${bankCoa?.settled_balance}`);

    // Check transaction status
    const txnAfterCommit = await prisma.transactions.findUnique({
      where: { transactionId: TXN_ID },
      select: { accountCode: true, review_status: true },
    });
    assert('Transaction accountCode set to 6110', txnAfterCommit?.accountCode === EXPENSE_CODE,
      `got ${txnAfterCommit?.accountCode}`);
    assert('Transaction review_status is committed', txnAfterCommit?.review_status === 'committed',
      `got ${txnAfterCommit?.review_status}`);

    // ═══════════════════════════════════════════
    // STEP 2: REVERSE
    // ═══════════════════════════════════════════
    console.log('\n=== STEP 2: Reverse the Starbucks commit ===');
    const reversal = await reversePlaidTransaction(prisma, {
      userId: USER_ID,
      journalEntryId: journalEntry.id,
      transactionId: TXN_ID,
    });

    assert('Reversal returns original ID', reversal.originalId === journalEntry.id);
    assert('Reversal returns new reversal ID', !!reversal.reversalId);
    console.log(`  Original ID: ${reversal.originalId}`);
    console.log(`  Reversal ID: ${reversal.reversalId}`);

    // Query both journal entries
    const originalAfter = await prisma.journal_entries.findUnique({ where: { id: reversal.originalId } });
    const reversalAfter = await prisma.journal_entries.findUnique({ where: { id: reversal.reversalId } });

    console.log('\n--- Journal Entries After Reversal ---');
    console.log(`  Original: status=${originalAfter?.status}, reversed_by=${originalAfter?.reversed_by_entry_id}`);
    console.log(`  Reversal: is_reversal=${reversalAfter?.is_reversal}, reverses=${reversalAfter?.reverses_entry_id}`);

    assert('Original status is reversed', originalAfter?.status === 'reversed',
      `got ${originalAfter?.status}`);
    assert('Original reversed_by_entry_id points to reversal', originalAfter?.reversed_by_entry_id === reversal.reversalId);
    assert('Reversal is_reversal is true', reversalAfter?.is_reversal === true);
    assert('Reversal reverses_entry_id points to original', reversalAfter?.reverses_entry_id === reversal.originalId);

    // Query all 4 ledger entries
    const allLedger = await prisma.ledger_entries.findMany({
      where: {
        journal_entry_id: { in: [reversal.originalId, reversal.reversalId] },
      },
      include: { account: { select: { code: true } } },
      orderBy: [{ journal_entry_id: 'asc' }, { entry_type: 'asc' }],
    });

    console.log('\n--- All 4 Ledger Entries ---');
    for (const le of allLedger) {
      const which = le.journal_entry_id === reversal.originalId ? 'ORIG' : 'REV ';
      console.log(`  ${which} ${le.entry_type} ${le.account.code} ${le.amount} cents`);
    }
    assert('4 total ledger entries', allLedger.length === 4, `got ${allLedger.length}`);

    // COA balances should be back to 0
    const expenseAfter = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: EXPENSE_CODE } },
    });
    const bankAfter = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: BANK_CODE } },
    });

    console.log('\n--- COA Balances After Reversal ---');
    console.log(`  6110: settled_balance = ${expenseAfter?.settled_balance}`);
    console.log(`  1010: settled_balance = ${bankAfter?.settled_balance}`);

    assert('6110 balance back to 0', expenseAfter?.settled_balance === BigInt(0),
      `got ${expenseAfter?.settled_balance}`);
    assert('1010 balance back to 0', bankAfter?.settled_balance === BigInt(0),
      `got ${bankAfter?.settled_balance}`);

    // Check transaction reset
    const txnAfterReversal = await prisma.transactions.findUnique({
      where: { transactionId: TXN_ID },
      select: { accountCode: true, review_status: true },
    });
    assert('Transaction accountCode is null', txnAfterReversal?.accountCode === null,
      `got ${txnAfterReversal?.accountCode}`);
    assert('Transaction review_status is pending_review', txnAfterReversal?.review_status === 'pending_review',
      `got ${txnAfterReversal?.review_status}`);

    // ═══════════════════════════════════════════
    // STEP 3: RE-COMMIT (should succeed after reversal)
    // ═══════════════════════════════════════════
    console.log('\n=== STEP 3: Re-commit same transaction (should succeed) ===');
    const recommit = await commitPlaidTransaction(prisma, {
      userId: USER_ID,
      entityId: ENTITY_ID,
      transactionId: TXN_ID,
      accountCode: EXPENSE_CODE,
      bankAccountCode: BANK_CODE,
      date: new Date('2026-02-19'),
      amount: 10.75,
      description: 'Starbucks (re-commit)',
      merchantName: 'Starbucks',
    });

    assert('Re-commit succeeded', !!recommit.id);
    console.log(`  New journal entry ID: ${recommit.id}`);

    // Verify balances are correct again
    const expenseFinal = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: EXPENSE_CODE } },
    });
    const bankFinal = await prisma.chart_of_accounts.findUnique({
      where: { userId_entity_id_code: { userId: USER_ID, entity_id: ENTITY_ID, code: BANK_CODE } },
    });

    assert('6110 balance is 1075 after re-commit', expenseFinal?.settled_balance === BigInt(1075),
      `got ${expenseFinal?.settled_balance}`);
    assert('1010 balance is -1075 after re-commit', bankFinal?.settled_balance === BigInt(-1075),
      `got ${bankFinal?.settled_balance}`);

    // ═══════════════════════════════════════════
    // CLEANUP: Reverse the re-commit so DB is clean
    // ═══════════════════════════════════════════
    console.log('\n=== CLEANUP: Reverse re-commit ===');
    await reversePlaidTransaction(prisma, {
      userId: USER_ID,
      journalEntryId: recommit.id,
      transactionId: TXN_ID,
    });
    console.log('  Cleaned up.');

    // ═══════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════
    console.log('\n════════════════════════════════');
    console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
    console.log('════════════════════════════════');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
