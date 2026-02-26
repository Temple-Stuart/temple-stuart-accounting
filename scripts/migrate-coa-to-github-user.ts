import { prisma } from '../src/lib/prisma';

async function main() {
  const oldUserId = 'cmf6dqgj70000zcrmhwwssuze';
  const githubUserId = 'cmfi3rcrl0000zcj0ajbj4za5';

  // Verify both users exist
  const [oldUser, githubUser] = await Promise.all([
    prisma.users.findUnique({ where: { id: oldUserId } }),
    prisma.users.findUnique({ where: { id: githubUserId } })
  ]);

  console.log('Old user:', oldUser?.email);
  console.log('GitHub user:', githubUser?.email);

  if (!githubUser) {
    console.error('GitHub user not found!');
    return;
  }

  // Count before
  const before = await prisma.chart_of_accounts.count({ where: { userId: oldUserId } });
  console.log(`\nCOA records to migrate: ${before}`);

  // Migrate
  const result = await prisma.chart_of_accounts.updateMany({
    where: { userId: oldUserId },
    data: { userId: githubUserId }
  });

  console.log(`Migrated: ${result.count} COA records`);

  // Verify
  const after = await prisma.chart_of_accounts.count({ where: { userId: githubUserId } });
  console.log(`GitHub user now owns: ${after} COA records`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
