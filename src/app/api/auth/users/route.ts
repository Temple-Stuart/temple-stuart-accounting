import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const users = await prisma.user.findMany()
    return new Response(JSON.stringify(users), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), { status: 500 })
  }
}

