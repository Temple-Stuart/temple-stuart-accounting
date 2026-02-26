import { prisma } from '../src/lib/prisma';

async function main() {
  const targetEmail = 'stuart.alexander.phi@gmail.com';
  
  // Ensure custom user exists for GitHub account
  let targetUser = await prisma.users.findUnique({ where: { email: targetEmail } });
  
  if (!targetUser) {
    targetUser = await prisma.users.create({
      data: {
        id: `user_github_${Date.now()}`,
        email: targetEmail,
        password: '',
        name: 'Alex Stuart',
        updatedAt: new Date()
      }
    });
    console.log(`Created custom user for ${targetEmail}`);
  } else {
    console.log(`Found existing user: ${targetUser.id}`);
  }
  
  // Source users with data (both templestuart accounts)
  const sourceUserIds = [
    'cmf6dqgj70000zcrmhwwssuze',  // Astuart@templestuart.com
    'm6wf8z6gjmmjp8dawz',          // astuart@templestuart.com
  ];
  
  // Move Plaid items
  const plaidResult = await prisma.plaid_items.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${plaidResult.count} Plaid items`);
  
  // Move budgets
  const budgetResult = await prisma.budgets.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${budgetResult.count} budgets`);
  
  // Move journal entries
  const jeResult = await prisma.journal_entries.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${jeResult.count} journal entries`);
  
  // Move bank reconciliations
  const reconResult = await prisma.bank_reconciliations.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${reconResult.count} bank reconciliations`);
  
  // Move period closes
  const pcResult = await prisma.period_closes.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${pcResult.count} period closes`);
  
  // Move trips
  const tripResult = await prisma.trips.updateMany({
    where: { userId: { in: sourceUserIds } },
    data: { userId: targetUser.id }
  });
  console.log(`Moved ${tripResult.count} trips`);
  
  // Verify final state
  const finalPlaid = await prisma.plaid_items.count({ where: { userId: targetUser.id } });
  
  console.log(`\n✅ DONE - All data now under ${targetEmail}`);
  console.log(`   Plaid Items: ${finalPlaid}`);
  console.log(`\nLog in with GitHub and you should see everything.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
