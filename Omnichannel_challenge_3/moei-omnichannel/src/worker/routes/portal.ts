/**
 * Portal Routes for Customer Enhancements
 * GET /api/service-requests
 * GET /api/bills
 * GET /api/appointments
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/service-requests', async (c) => {
  try {
    const requests = await db.serviceRequest.findMany({
      include: { service: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    // Map to frontend format
    const formatted = requests.map(r => {
      const isCompleted = r.status === 'completed'
      const isInProgress = r.status === 'in_progress'
      return {
        refNumber: r.referenceNumber,
        title: r.service.nameEn,
        stages: [
          { key: 'submitted', labelKey: 'stageSubmitted', timestamp: r.createdAt.toISOString().split('T')[0], status: 'completed' },
          { key: 'underReview', labelKey: 'stageUnderReview', status: isCompleted || isInProgress ? 'completed' : 'current' },
          { key: 'approved', labelKey: 'stageApproved', status: isCompleted ? 'completed' : isInProgress ? 'current' : 'pending' },
          { key: 'inProgress', labelKey: 'stageInProgress', status: isCompleted ? 'completed' : 'pending' },
          { key: 'completed', labelKey: 'stageCompleted', status: isCompleted ? 'completed' : 'pending' }
        ]
      }
    })

    return c.json(formatted)
  } catch (error) {
    console.error('ServiceRequests GET error:', error)
    return c.json({ error: 'Failed to fetch service requests' }, 500)
  }
})

app.get('/bills', async (c) => {
  try {
    const bills = await db.bill.findMany({
      orderBy: { dueDate: 'asc' },
      take: 10
    })
    return c.json(bills)
  } catch (error) {
    console.error('Bills GET error:', error)
    return c.json({ error: 'Failed to fetch bills' }, 500)
  }
})

app.get('/appointments', async (c) => {
  try {
    const appointments = await db.appointment.findMany({
      orderBy: { date: 'asc' },
      take: 10
    })
    return c.json(appointments)
  } catch (error) {
    console.error('Appointments GET error:', error)
    return c.json({ error: 'Failed to fetch appointments' }, 500)
  }
})

app.post('/appointments', async (c) => {
  try {
    const body = await c.req.json()
    const appointment = await db.appointment.create({
      data: {
        customerId: body.customerId || 'cuid-mock-customer',
        date: new Date(body.date),
        timeSlot: body.timeSlot,
        service: body.service,
        status: 'scheduled'
      }
    })
    return c.json(appointment, 201)
  } catch (error) {
    console.error('Appointment POST error:', error)
    return c.json({ error: 'Failed to create appointment' }, 500)
  }
})

export const portalRoutes = app
