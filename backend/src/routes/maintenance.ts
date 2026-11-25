import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAgencyAdmin } from '../middleware/auth'
import {
  busMaintenanceJournalRef,
  postBusMaintenanceJournal,
  removeBusMaintenanceJournal,
} from '../services/ledger'
import { branchIdOnCreate, branchOwnedWhere } from '../utils/branchScope'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

function assertBranchEntity(
  req: { user?: { role: string; branchId: string | null } },
  branchId: string | null,
) {
  if (req.user!.role === 'branch_admin' && branchId !== req.user!.branchId) {
    return false
  }
  return true
}

function computeFinalCost(before: number, discountType: string, discountValue: number) {
  if (discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, discountValue))
    return Math.max(0, before * (1 - pct / 100))
  }
  if (discountType === 'fixed') {
    return Math.max(0, before - discountValue)
  }
  return before
}

function formatBusLabel(bus: { busNumber: string; plateNumber: string }) {
  const plate = bus.plateNumber?.trim() || '—'
  const num = bus.busNumber?.trim()
  return num ? `${plate} (${num})` : plate
}

export const maintenanceRouter = Router()
maintenanceRouter.use(authRequired)

maintenanceRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const where = branchOwnedWhere(req.user!)
    const [repairTypes, spareParts, expenses] = await Promise.all([
      prisma.repairType.count({ where }),
      prisma.sparePart.count({ where }),
      prisma.busMaintenanceExpense.count({ where }),
    ])
    return ok(res, { repairTypes, spareParts, expenses })
  }),
)

/* ── أنواع الإصلاح ── */

maintenanceRouter.get(
  '/repair-types',
  asyncHandler(async (req, res) => {
    const list = await prisma.repairType.findMany({
      where: branchOwnedWhere(req.user!),
      orderBy: { name: 'asc' },
    })
    return ok(res, { list })
  }),
)

maintenanceRouter.post(
  '/repair-types',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const item = await prisma.repairType.create({
      data: {
        name: body.data.name.trim(),
        branchId: branchIdOnCreate(req.user!),
      },
    })
    return ok(res, { repairType: item }, 201)
  }),
)

maintenanceRouter.put(
  '/repair-types/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.repairType.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const item = await prisma.repairType.update({
      where: { id: paramId(req) },
      data: { name: body.data.name.trim() },
    })
    return ok(res, { repairType: item })
  }),
)

maintenanceRouter.delete(
  '/repair-types/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.repairType.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const used = await prisma.busMaintenanceExpense.count({
      where: { repairTypeId: existing.id },
    })
    if (used > 0) return fail(res, 'لا يمكن الحذف — النوع مستخدم في صيانات', 400)
    await prisma.repairType.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

/* ── قطع الغيار ── */

maintenanceRouter.get(
  '/spare-parts',
  asyncHandler(async (req, res) => {
    const list = await prisma.sparePart.findMany({
      where: branchOwnedWhere(req.user!),
      orderBy: { name: 'asc' },
    })
    return ok(res, { list })
  }),
)

maintenanceRouter.post(
  '/spare-parts',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        partCode: z.string().optional(),
        unitPrice: z.number().min(0).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const item = await prisma.sparePart.create({
      data: {
        name: body.data.name.trim(),
        partCode: (body.data.partCode ?? '').trim(),
        unitPrice: body.data.unitPrice ?? 0,
        branchId: branchIdOnCreate(req.user!),
      },
    })
    return ok(res, { sparePart: item }, 201)
  }),
)

maintenanceRouter.put(
  '/spare-parts/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.sparePart.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const body = z
      .object({
        name: z.string().min(1),
        partCode: z.string().optional(),
        unitPrice: z.number().min(0).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const item = await prisma.sparePart.update({
      where: { id: paramId(req) },
      data: {
        name: body.data.name.trim(),
        ...(body.data.partCode !== undefined ? { partCode: body.data.partCode.trim() } : {}),
        ...(body.data.unitPrice !== undefined ? { unitPrice: body.data.unitPrice } : {}),
      },
    })
    return ok(res, { sparePart: item })
  }),
)

maintenanceRouter.delete(
  '/spare-parts/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.sparePart.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    await prisma.sparePart.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

/* ── مصاريف الصيانة ── */

const expenseBody = z.object({
  busId: z.string().min(1),
  repairTypeId: z.string().min(1),
  maintenanceDate: z.string().min(1),
  costBeforeDiscount: z.number().min(0),
  discountType: z.enum(['none', 'percent', 'fixed']).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().optional(),
  creditAccountId: z.number().int().positive().nullable().optional(),
})

function mapExpense(row: {
  id: string
  busId: string
  repairTypeId: string
  maintenanceDate: string
  costBeforeDiscount: number
  discountType: string
  discountValue: number
  finalCost: number
  notes: string
  creditAccountId: number | null
  journalReferenceId: number | null
  createdAt: Date
  bus: { id: string; busNumber: string; plateNumber: string }
  repairType: { id: string; name: string }
}) {
  return {
    id: row.id,
    busId: row.busId,
    repairTypeId: row.repairTypeId,
    maintenanceDate: row.maintenanceDate,
    costBeforeDiscount: row.costBeforeDiscount,
    discountType: row.discountType,
    discountValue: row.discountValue,
    finalCost: row.finalCost,
    notes: row.notes,
    creditAccountId: row.creditAccountId,
    journalReferenceId: row.journalReferenceId,
    createdAt: row.createdAt,
    busPlate: row.bus.plateNumber,
    busNumber: row.bus.busNumber,
    repairTypeName: row.repairType.name,
  }
}

maintenanceRouter.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const list = await prisma.busMaintenanceExpense.findMany({
      where: branchOwnedWhere(req.user!),
      include: {
        bus: { select: { id: true, busNumber: true, plateNumber: true } },
        repairType: { select: { id: true, name: true } },
      },
      orderBy: [{ maintenanceDate: 'desc' }, { createdAt: 'desc' }],
    })
    return ok(res, { list: list.map(mapExpense) })
  }),
)

maintenanceRouter.post(
  '/expenses',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = expenseBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const bus = await prisma.bus.findUnique({ where: { id: body.data.busId } })
    if (!bus) return fail(res, 'الحافلة غير موجودة', 404)

    const repairType = await prisma.repairType.findUnique({
      where: { id: body.data.repairTypeId },
    })
    if (!repairType) return fail(res, 'نوع الصيانة غير موجود', 404)
    if (!assertBranchEntity(req, repairType.branchId)) {
      return fail(res, 'ليس لديك صلاحية على نوع الصيانة', 403)
    }

    const discountType = body.data.discountType ?? 'none'
    const discountValue = body.data.discountValue ?? 0
    const finalCost = computeFinalCost(body.data.costBeforeDiscount, discountType, discountValue)

    if (finalCost > 0 && !body.data.creditAccountId) {
      return fail(res, 'اختر حساب الصرف (صندوق أو بنك) للمبلغ', 400)
    }

    if (body.data.creditAccountId) {
      const creditAcc = await prisma.account.findUnique({
        where: { id: body.data.creditAccountId },
      })
      if (!creditAcc) return fail(res, 'حساب الصرف غير موجود', 404)
    }

    const created = await prisma.busMaintenanceExpense.create({
      data: {
        busId: body.data.busId,
        repairTypeId: body.data.repairTypeId,
        maintenanceDate: body.data.maintenanceDate,
        costBeforeDiscount: body.data.costBeforeDiscount,
        discountType,
        discountValue,
        finalCost,
        notes: (body.data.notes ?? '').trim(),
        creditAccountId: body.data.creditAccountId ?? null,
        branchId: branchIdOnCreate(req.user!),
        journalReferenceId: null,
      },
      include: {
        bus: { select: { id: true, busNumber: true, plateNumber: true } },
        repairType: { select: { id: true, name: true } },
      },
    })

    let journalReferenceId: number | null = null
    try {
      if (finalCost > 0 && body.data.creditAccountId) {
        journalReferenceId = await postBusMaintenanceJournal({
          maintenanceId: created.id,
          creditAccountId: body.data.creditAccountId,
          amount: finalCost,
          maintenanceDate: body.data.maintenanceDate,
          busLabel: formatBusLabel(created.bus),
          repairTypeName: created.repairType.name,
          notes: created.notes,
        })
      }
    } catch (err) {
      await prisma.busMaintenanceExpense.delete({ where: { id: created.id } })
      const msg = err instanceof Error ? err.message : 'فشل الترحيل المحاسبي'
      return fail(res, msg, 400)
    }

    const expense = await prisma.busMaintenanceExpense.update({
      where: { id: created.id },
      data: { journalReferenceId },
      include: {
        bus: { select: { id: true, busNumber: true, plateNumber: true } },
        repairType: { select: { id: true, name: true } },
      },
    })

    return ok(res, { expense: mapExpense(expense) }, 201)
  }),
)

maintenanceRouter.put(
  '/expenses/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.busMaintenanceExpense.findUnique({
      where: { id: paramId(req) },
      include: {
        bus: { select: { busNumber: true, plateNumber: true } },
        repairType: { select: { name: true } },
      },
    })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const body = expenseBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const discountType = body.data.discountType ?? 'none'
    const discountValue = body.data.discountValue ?? 0
    const finalCost = computeFinalCost(body.data.costBeforeDiscount, discountType, discountValue)

    if (finalCost > 0 && !body.data.creditAccountId) {
      return fail(res, 'اختر حساب الصرف (صندوق أو بنك) للمبلغ', 400)
    }

    if (body.data.creditAccountId) {
      const creditAcc = await prisma.account.findUnique({
        where: { id: body.data.creditAccountId },
      })
      if (!creditAcc) return fail(res, 'حساب الصرف غير موجود', 404)
    }

    const bus = await prisma.bus.findUnique({ where: { id: body.data.busId } })
    if (!bus) return fail(res, 'الحافلة غير موجودة', 404)

    const repairType = await prisma.repairType.findUnique({
      where: { id: body.data.repairTypeId },
    })
    if (!repairType) return fail(res, 'نوع الصيانة غير موجود', 404)

    await removeBusMaintenanceJournal(existing.id)

    let journalReferenceId: number | null = null
    try {
      if (finalCost > 0 && body.data.creditAccountId) {
        journalReferenceId = await postBusMaintenanceJournal({
          maintenanceId: existing.id,
          creditAccountId: body.data.creditAccountId,
          amount: finalCost,
          maintenanceDate: body.data.maintenanceDate,
          busLabel: formatBusLabel(bus),
          repairTypeName: repairType.name,
          notes: (body.data.notes ?? '').trim(),
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل الترحيل المحاسبي'
      return fail(res, msg, 400)
    }

    const expense = await prisma.busMaintenanceExpense.update({
      where: { id: paramId(req) },
      data: {
        busId: body.data.busId,
        repairTypeId: body.data.repairTypeId,
        maintenanceDate: body.data.maintenanceDate,
        costBeforeDiscount: body.data.costBeforeDiscount,
        discountType,
        discountValue,
        finalCost,
        notes: (body.data.notes ?? '').trim(),
        creditAccountId: body.data.creditAccountId ?? null,
        journalReferenceId,
      },
      include: {
        bus: { select: { id: true, busNumber: true, plateNumber: true } },
        repairType: { select: { id: true, name: true } },
      },
    })

    return ok(res, { expense: mapExpense(expense) })
  }),
)

maintenanceRouter.delete(
  '/expenses/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.busMaintenanceExpense.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    await removeBusMaintenanceJournal(existing.id)
    await prisma.busMaintenanceExpense.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)