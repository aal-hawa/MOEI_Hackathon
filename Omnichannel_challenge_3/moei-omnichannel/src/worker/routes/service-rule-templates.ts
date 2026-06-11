/**
 * Service Rule Templates Route
 * GET /api/service-rules/templates
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

const TEMPLATES = [
  {
    id: 'tpl-electricity-connection',
    nameEn: 'New Electricity Connection',
    nameAr: 'توصيل كهرباء جديد',
    category: 'electricity_water',
    descriptionEn: 'Apply for a new electricity connection for residential or commercial properties',
    descriptionAr: 'التقدم بطلب توصيل كهرباء جديد للعقارات السكنية أو التجارية',
    priority: 'high',
    feeAmount: '1,500',
    feeCurrency: 'AED',
    processingTimeEn: '3-5 working days',
    processingTimeAr: '3-5 أيام عمل',
    requiredActions: ['search', 'add'],
    fields: [
      { fieldKey: 'emirates_id', labelEn: 'Emirates ID', labelAr: 'رقم الهوية', fieldType: 'id_number', required: true, forActions: ['search', 'add'] },
      { fieldKey: 'property_type', labelEn: 'Property Type', labelAr: 'نوع العقار', fieldType: 'select', required: true, forActions: ['add'], optionsEn: ['Residential', 'Commercial', 'Industrial'], optionsAr: ['سكني', 'تجاري', 'صناعي'] },
      { fieldKey: 'plot_number', labelEn: 'Plot Number', labelAr: 'رقم قطعة الأرض', fieldType: 'text', required: true, forActions: ['add'] },
      { fieldKey: 'connection_load', labelEn: 'Required Load (kW)', labelAr: 'الحمل المطلوب (كيلووات)', fieldType: 'number', required: true, forActions: ['add'] },
    ],
  },
  {
    id: 'tpl-water-connection',
    nameEn: 'Water Connection Application',
    nameAr: 'طلب توصيل مياه',
    category: 'electricity_water',
    descriptionEn: 'Apply for a new water supply connection',
    descriptionAr: 'التقدم بطلب توصيل إمدادات مياه جديدة',
    priority: 'high',
    feeAmount: '500',
    feeCurrency: 'AED',
    processingTimeEn: '2-3 working days',
    processingTimeAr: '2-3 أيام عمل',
    requiredActions: ['search', 'add'],
    fields: [
      { fieldKey: 'emirates_id', labelEn: 'Emirates ID', labelAr: 'رقم الهوية', fieldType: 'id_number', required: true, forActions: ['search', 'add'] },
      { fieldKey: 'property_address', labelEn: 'Property Address', labelAr: 'عنوان العقار', fieldType: 'textarea', required: true, forActions: ['add'] },
    ],
  },
  {
    id: 'tpl-housing-loan',
    nameEn: 'Housing Loan Application',
    nameAr: 'طلب قرض إسكان',
    category: 'housing',
    descriptionEn: 'Apply for a government housing loan',
    descriptionAr: 'التقدم بطلب قرض إسكان حكومي',
    priority: 'medium',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '15-30 working days',
    processingTimeAr: '15-30 يوم عمل',
    requiredActions: ['search', 'add'],
    fields: [
      { fieldKey: 'emirates_id', labelEn: 'Emirates ID', labelAr: 'رقم الهوية', fieldType: 'id_number', required: true, forActions: ['search', 'add'] },
      { fieldKey: 'income', labelEn: 'Monthly Income (AED)', labelAr: 'الدخل الشهري (درهم)', fieldType: 'number', required: true, forActions: ['add'] },
      { fieldKey: 'family_size', labelEn: 'Family Size', labelAr: 'حجم الأسرة', fieldType: 'number', required: true, forActions: ['add'] },
    ],
  },
]

app.get('/service-rules/templates', (c) => {
  const category = c.req.query('category')
  const filtered = category ? TEMPLATES.filter(t => t.category === category) : TEMPLATES
  return c.json({ templates: filtered })
})

app.post('/service-rules/templates', async (c) => {
  try {
    const { templateId } = await c.req.json()
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return c.json({ error: 'Template not found' }, 404)

    const rule = await db.$transaction(async (tx) => {
      const newRule = await tx.serviceRule.create({
        data: {
          nameEn: template.nameEn,
          nameAr: template.nameAr,
          category: template.category,
          descriptionEn: template.descriptionEn,
          descriptionAr: template.descriptionAr,
          priority: template.priority,
          feeAmount: template.feeAmount,
          feeCurrency: template.feeCurrency,
          processingTimeEn: template.processingTimeEn,
          processingTimeAr: template.processingTimeAr,
          requiredActions: JSON.stringify(template.requiredActions),
          isActive: true,
        }
      })

      for (let i = 0; i < template.fields.length; i++) {
        const field = template.fields[i]
        await tx.serviceRuleField.create({
          data: {
            ruleId: newRule.id,
            fieldKey: field.fieldKey,
            labelEn: field.labelEn,
            labelAr: field.labelAr,
            fieldType: field.fieldType,
            required: field.required,
            forActions: JSON.stringify(field.forActions),
            optionsEn: field.optionsEn ? JSON.stringify(field.optionsEn) : '',
            optionsAr: field.optionsAr ? JSON.stringify(field.optionsAr) : '',
            sortOrder: i,
            isActive: true,
          }
        })
      }
      return newRule
    })

    return c.json({ message: 'Template created successfully', rule })
  } catch (error) {
    console.error('Template create error:', error)
    return c.json({ error: 'Failed to create rule from template' }, 500)
  }
})

app.post('/service-rules/seed', async (c) => {
  try {
    let count = 0
    await db.$transaction(async (tx) => {
      for (const template of TEMPLATES) {
        // Only seed if not already exists
        const existing = await tx.serviceRule.findFirst({ where: { nameEn: template.nameEn } })
        if (existing) continue

        const newRule = await tx.serviceRule.create({
          data: {
            nameEn: template.nameEn,
            nameAr: template.nameAr,
            category: template.category,
            descriptionEn: template.descriptionEn,
            descriptionAr: template.descriptionAr,
            priority: template.priority,
            feeAmount: template.feeAmount,
            feeCurrency: template.feeCurrency,
            processingTimeEn: template.processingTimeEn,
            processingTimeAr: template.processingTimeAr,
            requiredActions: JSON.stringify(template.requiredActions),
            isActive: true,
          }
        })

        for (let i = 0; i < template.fields.length; i++) {
          const field = template.fields[i]
          await tx.serviceRuleField.create({
            data: {
              ruleId: newRule.id,
              fieldKey: field.fieldKey,
              labelEn: field.labelEn,
              labelAr: field.labelAr,
              fieldType: field.fieldType,
              required: field.required,
              forActions: JSON.stringify(field.forActions),
              optionsEn: field.optionsEn ? JSON.stringify(field.optionsEn) : '',
              optionsAr: field.optionsAr ? JSON.stringify(field.optionsAr) : '',
              sortOrder: i,
              isActive: true,
            }
          })
        }
        count++
      }
    })

    return c.json({ message: 'Services seeded successfully', count })
  } catch (error) {
    console.error('Seed error:', error)
    return c.json({ error: 'Failed to seed services' }, 500)
  }
})

export const serviceRuleTemplatesRoutes = app
