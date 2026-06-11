/**
 * Form Fields Routes
 * GET /api/form-fields, POST /api/form-fields, GET/PATCH/DELETE /api/form-fields/:id, POST /api/form-fields/seed
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { generateId } from '../lib/utils'
import { requireAdminAuthMiddleware } from '../middleware/auth'

const formFields = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/form-fields
formFields.get('/', async (c) => {
  const db = new DbClient(c.env.DB)
  try {
    const result = await db.findActiveFormFields()
    return c.json(result.results || [])
  } catch (error) {
    return c.json({ error: 'Failed to fetch form fields' }, 500)
  }
})

// POST /api/form-fields
formFields.post('/', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const id = generateId()
    await db.createFormField({
      id, labelEN: body.labelEN, labelAR: body.labelAR, fieldKey: body.fieldKey,
      fieldType: body.fieldType, placeholderEN: body.placeholderEN || null,
      placeholderAR: body.placeholderAR || null, helpTextEN: body.helpTextEN || null,
      helpTextAR: body.helpTextAR || null, required: body.required !== false ? 1 : 0,
      'order': body.order ?? 0, section: body.section || 'personal',
      options: JSON.stringify(body.options || []), validation: JSON.stringify(body.validation || {}),
      aiValidationPrompt: body.aiValidationPrompt || null, aiAutoValidate: body.aiAutoValidate ? 1 : 0,
      isVisible: body.isVisible !== false ? 1 : 0, isActive: 1,
      ruleDescriptionEN: body.ruleDescriptionEN || null, ruleDescriptionAR: body.ruleDescriptionAR || null,
      showRule: body.showRule !== false ? 1 : 0,
    })
    const field: any = await db.findFormFieldById(id)
    return c.json(field, 201)
  } catch (error) {
    return c.json({ error: 'Failed to create form field' }, 500)
  }
})

// GET /api/form-fields/:id
formFields.get('/:id', async (c) => {
  const db = new DbClient(c.env.DB)
  const field: any = await db.findFormFieldById(c.req.param('id'))
  if (!field) return c.json({ error: 'Field not found' }, 404)
  return c.json(field)
})

// PATCH /api/form-fields/:id
formFields.patch('/:id', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const updateData: Record<string, unknown> = {}
    if (body.labelEN !== undefined) updateData.labelEN = body.labelEN
    if (body.labelAR !== undefined) updateData.labelAR = body.labelAR
    if (body.fieldKey !== undefined) updateData.fieldKey = body.fieldKey
    if (body.fieldType !== undefined) updateData.fieldType = body.fieldType
    if (body.placeholderEN !== undefined) updateData.placeholderEN = body.placeholderEN
    if (body.placeholderAR !== undefined) updateData.placeholderAR = body.placeholderAR
    if (body.helpTextEN !== undefined) updateData.helpTextEN = body.helpTextEN
    if (body.helpTextAR !== undefined) updateData.helpTextAR = body.helpTextAR
    if (body.required !== undefined) updateData.required = body.required ? 1 : 0
    if (body.order !== undefined) updateData['order'] = body.order
    if (body.section !== undefined) updateData.section = body.section
    if (body.options !== undefined) updateData.options = JSON.stringify(body.options)
    if (body.validation !== undefined) updateData.validation = JSON.stringify(body.validation)
    if (body.aiValidationPrompt !== undefined) updateData.aiValidationPrompt = body.aiValidationPrompt
    if (body.aiAutoValidate !== undefined) updateData.aiAutoValidate = body.aiAutoValidate ? 1 : 0
    if (body.isVisible !== undefined) updateData.isVisible = body.isVisible ? 1 : 0
    if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0
    if (body.ruleDescriptionEN !== undefined) updateData.ruleDescriptionEN = body.ruleDescriptionEN
    if (body.ruleDescriptionAR !== undefined) updateData.ruleDescriptionAR = body.ruleDescriptionAR
    if (body.showRule !== undefined) updateData.showRule = body.showRule ? 1 : 0

    await db.updateFormField(c.req.param('id'), updateData)
    const updated: any = await db.findFormFieldById(c.req.param('id'))
    return c.json(updated)
  } catch (error) {
    return c.json({ error: 'Failed to update form field' }, 500)
  }
})

// DELETE /api/form-fields/:id
formFields.delete('/:id', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    await db.deleteFormField(c.req.param('id'))
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete form field' }, 500)
  }
})

// POST /api/form-fields/seed
formFields.post('/seed', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const defaultFields = [
      { labelEN: 'Emirates ID', labelAR: 'رقم الهوية', fieldKey: 'emiratesId', fieldType: 'text', section: 'personal', required: 1, 'order': 1, validation: JSON.stringify({ regex: '^784[0-9]{12}$', customMessage: 'Must be a valid 15-digit Emirates ID starting with 784' }), ruleDescriptionEN: 'Must be a valid 15-digit Emirates ID starting with 784', ruleDescriptionAR: 'يجب أن يكون رقم هوية إماراتي صحيح من 15 رقماً يبدأ بـ 784' },
      { labelEN: 'Full Name (Arabic)', labelAR: 'الاسم الكامل', fieldKey: 'nameAr', fieldType: 'text', section: 'personal', required: 1, 'order': 2 },
      { labelEN: 'Full Name (English)', labelAR: 'الاسم بالإنجليزي', fieldKey: 'nameEn', fieldType: 'text', section: 'personal', required: 0, 'order': 3 },
      { labelEN: 'Phone Number', labelAR: 'رقم الهاتف', fieldKey: 'phone', fieldType: 'text', section: 'personal', required: 1, 'order': 4, validation: JSON.stringify({ regex: '^05[0-9]{8}$' }), ruleDescriptionEN: 'Must be a valid UAE mobile number starting with 05', ruleDescriptionAR: 'يجب أن يكون رقم هاتف إماراتي يبدأ بـ 05' },
      { labelEN: 'Monthly Income', labelAR: 'الدخل الشهري', fieldKey: 'monthlyIncome', fieldType: 'number', section: 'financial', required: 1, 'order': 5 },
      { labelEN: 'Employer Type', labelAR: 'نوع جهة العمل', fieldKey: 'employerType', fieldType: 'select', section: 'financial', required: 1, 'order': 6, options: JSON.stringify([{ value: 'government', labelEN: 'Government', labelAR: 'حكومي' }, { value: 'semi-government', labelEN: 'Semi-Government', labelAR: 'شبه حكومي' }, { value: 'private', labelEN: 'Private', labelAR: 'خاص' }]) },
      { labelEN: 'Family Size', labelAR: 'عدد أفراد الأسرة', fieldKey: 'familySize', fieldType: 'number', section: 'financial', required: 1, 'order': 7 },
      { labelEN: 'Reason Category', labelAR: 'فئة السبب', fieldKey: 'reasonCategory', fieldType: 'select', section: 'loan', required: 1, 'order': 8, options: JSON.stringify([{ value: 'job_loss', labelEN: 'Job Loss', labelAR: 'فقدان الوظيفة' }, { value: 'medical', labelEN: 'Medical', labelAR: 'طبي' }, { value: 'salary_cut', labelEN: 'Salary Cut', labelAR: 'تخفيض الراتب' }, { value: 'divorce', labelEN: 'Divorce', labelAR: 'طلاق' }, { value: 'retirement', labelEN: 'Retirement', labelAR: 'تقاعد' }, { value: 'other', labelEN: 'Other', labelAR: 'أخرى' }]) },
      { labelEN: 'Requested Duration (Months)', labelAR: 'المدة المطلوبة (أشهر)', fieldKey: 'requestedDurationMonths', fieldType: 'number', section: 'loan', required: 1, 'order': 9 },
    ]

    let seeded = 0
    for (const field of defaultFields) {
      const existing: any = await db.findFormFieldByKey(field.fieldKey)
      if (!existing) {
        await db.createFormField({ id: generateId(), ...field, placeholderEN: null, placeholderAR: null, helpTextEN: null, helpTextAR: null, aiValidationPrompt: null, aiAutoValidate: 0, isVisible: 1, isActive: 1, showRule: 1, ruleDescriptionEN: field.ruleDescriptionEN || null, ruleDescriptionAR: field.ruleDescriptionAR || null, validation: field.validation || '{}' })
        seeded++
      }
    }

    return c.json({ success: true, message: `Seeded ${seeded} form fields`, seeded })
  } catch (error) {
    console.error('Seed form fields error:', error)
    return c.json({ error: 'Failed to seed form fields' }, 500)
  }
})

export default formFields
