import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function getMissionUser() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  return user;
}

export async function getMissionWithOwnerCheck(missionId: string, userId: string) {
  const mission = await prisma.missions.findFirst({
    where: { id: missionId, userId },
  });
  return mission;
}
