import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const user = await prisma.users.create({
      data: body,
    })
    return new Response(JSON.stringify(user), { status: 201 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Signup failed' }), { status: 500 })
  }
}

