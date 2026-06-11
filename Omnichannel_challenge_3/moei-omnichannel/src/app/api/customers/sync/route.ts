import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * POST /api/customers/sync
 * 
 * Ensures a customer exists in the database based on UAE PASS profile data.
 * Called when a user logs in via UAE PASS to sync their profile.
 * 
 * Request body:
 *   - idn: Emirates ID Number (e.g. "784-1990-1234567-1")
 *   - sub: UAE PASS subject ID (e.g. "UAEPASS/a1b2c3d4-...")
 *   - fullnameEN: English name
 *   - fullnameAR: Arabic name
 *   - email: Email address
 *   - mobile: Phone number
 *   - gender: "male" | "female"
 *   - dob: Date of birth "YYYY-MM-DD"
 *   - nationalityEN: Nationality
 * 
 * Returns the customer record with the real DB id (CUID).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idn, sub, fullnameEN, fullnameAR, email, mobile, gender, dob, nationalityEN } = body

    if (!fullnameEN) {
      return NextResponse.json({ error: 'fullnameEN is required' }, { status: 400 })
    }

    // Try to find existing customer by multiple identifiers
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          ...(idn ? [{ emiratesId: idn }] : []),
          ...(sub ? [{ uaePassId: sub }] : []),
          ...(email ? [{ email }] : []),
          ...(idn ? [{ uaePassId: idn }] : []), // Sometimes IDN is stored in uaePassId
        ].filter((clause) => Object.values(clause)[0] !== null && Object.values(clause)[0] !== '')
      }
    })

    if (existing) {
      // Update existing customer with latest UAE PASS data
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          ...(fullnameEN && { nameEn: fullnameEN }),
          ...(fullnameAR && { nameAr: fullnameAR }),
          ...(email && { email }),
          ...(mobile && { phone: mobile }),
          ...(sub && { uaePassId: sub }),
          ...(idn && { emiratesId: idn }),
          ...(gender && { gender }),
          ...(dob && { dateOfBirth: dob }),
          ...(nationalityEN && {
            nationality: nationalityEN,
            isUaeNational: nationalityEN === 'Emirati' || nationalityEN === 'UAE',
          }),
          isVerified: true,
        }
      })
      return NextResponse.json(updated)
    }

    // Create new customer
    const newCustomer = await prisma.customer.create({
      data: {
        nameEn: fullnameEN,
        nameAr: fullnameAR || '',
        email: email || `${idn || Date.now()}@moei.ae`,
        phone: mobile || '',
        uaePassId: sub || idn || '',
        emiratesId: idn || '',
        gender: gender || '',
        dateOfBirth: dob || '',
        nationality: nationalityEN || '',
        isUaeNational: nationalityEN === 'Emirati' || nationalityEN === 'UAE',
        isVerified: true,
      }
    })
    return NextResponse.json(newCustomer)

  } catch (error: any) {
    console.error('Customer sync error:', error)
    return NextResponse.json({ error: 'Failed to sync customer' }, { status: 500 })
  }
}
