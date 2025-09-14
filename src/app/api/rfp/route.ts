import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rfp = await prisma.rFP.create({
      data: body,
    })
    return new Response(JSON.stringify(rfp), { status: 201 })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'RFP creation failed' }), { status: 500 })
  }
}

