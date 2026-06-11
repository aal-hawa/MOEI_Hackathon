import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerIdParam = searchParams.get('customerId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const channel = searchParams.get('channel')

    const where: Record<string, unknown> = {}

    // Resolve customerId: the portal may pass a UAE PASS IDN (e.g. "784-1990-1234567-1"),
    // a uaePassId (e.g. "UAEPASS/..."), a Customer CUID, or even an email/name.
    // We need to resolve it to the actual Customer.id (CUID) used as foreign key in Case.
    if (customerIdParam) {
      // First try: direct match (already a Customer CUID)
      const directCustomer = await prisma.customer.findUnique({ where: { id: customerIdParam } })
      if (directCustomer) {
        where.customerId = directCustomer.id
      } else {
        // Try matching by uaePassId, email, or name
        const resolvedCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              { uaePassId: customerIdParam },
              { email: customerIdParam },
              { nameEn: customerIdParam },
              { emiratesId: customerIdParam },
            ]
          }
        })
        if (resolvedCustomer) {
          where.customerId = resolvedCustomer.id
        } else {
          // Could not resolve — return empty
          return NextResponse.json([])
        }
      }
    }

    if (status) where.status = status
    if (priority) where.priority = priority
    if (channel) where.channel = channel

    const cases = await prisma.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, nameEn: true, nameAr: true, uaePassId: true, email: true } },
        _count: { select: { interactions: true } },
      },
    })

    return NextResponse.json(cases)
  } catch (error: any) {
    console.error('Cases GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, titleEn, titleAr, description, channel, category, priority, name, email } = body

    if (!titleEn) {
      return NextResponse.json({ error: 'titleEn is required' }, { status: 400 })
    }

    // Resolve or create customer
    let dbCustomerId = customerId

    if (dbCustomerId) {
      // Try to find existing customer by ID, uaePassId, email, or name
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            { id: dbCustomerId },
            { uaePassId: dbCustomerId },
            { email: dbCustomerId },
            { nameEn: name || dbCustomerId },
            { emiratesId: dbCustomerId },
          ]
        }
      })

      if (existing) {
        dbCustomerId = existing.id
      } else {
        // Create a new customer with the provided info
        const newCustomer = await prisma.customer.create({
          data: {
            nameEn: name || dbCustomerId,
            email: email || `${dbCustomerId}@moei.ae`,
            uaePassId: dbCustomerId,
            emiratesId: dbCustomerId,
          }
        })
        dbCustomerId = newCustomer.id
      }
    } else if (name || email) {
      // No customerId but have name/email — find or create
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(name ? [{ nameEn: name }] : []),
          ]
        }
      })
      if (existing) {
        dbCustomerId = existing.id
      } else {
        const newCustomer = await prisma.customer.create({
          data: {
            nameEn: name || 'Unknown Customer',
            email: email || `customer-${Date.now()}@moei.ae`,
          }
        })
        dbCustomerId = newCustomer.id
      }
    } else {
      return NextResponse.json({ error: 'customerId or name/email is required' }, { status: 400 })
    }

    // Generate Reference Number
    const prefix = category ? category.slice(0, 2).toUpperCase() : 'G'
    const referenceNumber = `MOEI-${prefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`

    // Create case
    const newCase = await prisma.case.create({
      data: {
        referenceNumber,
        customerId: dbCustomerId,
        titleEn,
        titleAr: titleAr || null,
        description: description || null,
        status: 'open',
        priority: priority || 'medium',
        category: category || null,
        channel: channel || 'web',
      },
      include: {
        customer: true
      }
    })

    return NextResponse.json({
      ...newCase,
      success: true,
      message: `Case ${referenceNumber} created successfully`
    })

  } catch (error: any) {
    console.error('Failed to create case:', error)
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 })
  }
}
