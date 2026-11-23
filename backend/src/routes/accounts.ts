import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin, requireAgencyAdmin, type AuthUser } from '../middleware/auth'
import { accountsScopeWhere, branchIdOnCreate } from '../utils/branchScope'
import { getAccountBalance } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const accountsRouter = Router()
accountsRouter.use(authRequired)

const AGENCY_BRANCH_LABEL = 'الفرع الرئيسي'

type AccountRow = {
  id: number
  code: string
  nameAr: string
  nameEn: string | null
  parentId: number | null
  accountLevel: string
  financialStatement: string | null
  branchId?: string | null
  createdByName?: string | null
  createdAt?: Date
  branch?: { name: string } | null
}

function branchNameForAccount(a: AccountRow): string {
  if (a.branch?.name) return a.branch.name
  if (a.branchId) return '—'
  return AGENCY_BRANCH_LABEL
}

function mapAccount(a: AccountRow, parentName?: string | null) {
  return {
    id: a.id,
    code: a.code,
    name_ar: a.nameAr,
    name_en: a.nameEn,
    parent_id: a.parentId,
    parent_name: parentName ?? null,
    account_level: a.accountLevel,
    financial_statement: a.financialStatement,
    branch_id: a.branchId ?? null,
    branch_name: branchNameForAccount(a),
    created_by: a.createdByName ?? null,
    created_at: a.createdAt?.toISOString?.() ?? undefined,
  }
}

const accountInclude = {
  branch: { select: { name: true } },
} as const

function sameLedgerBranch(
  accountBranchId: string | null,
  ledgerBranchId: string | null,
): boolean {
  return accountBranchId === ledgerBranchId
}

async function assertAccountInUserLedger(
  user: AuthUser,
  account: { branchId: string | null },
): Promise<boolean> {
  if (!user) return false
  const scope = await accountsScopeWhere(user)
  const want = scope.branchId as string | null | undefined
  if (want === '__none__') return false
  return sameLedgerBranch(account.branchId, want ?? null)
}

/** حساب قابل للترحيل: المستوى فرعي فقط (الأب تحت الأب يبقى رئيسي ولا يُرحَّل عليه) */
async function listPostableAccounts(branchWhere: Record<string, unknown>) {
  const all = await prisma.account.findMany({
    where: branchWhere,
    orderBy: { code: 'asc' },
  })
  const postable = all.filter((a) => a.accountLevel === 'فرعي')

  // إزالة التكرار بنفس الكود (تظهر مرة واحدة في قوائم السندات)
  const seenCodes = new Set<string>()
  const unique: typeof postable = []
  for (const a of postable) {
    if (seenCodes.has(a.code)) continue
    seenCodes.add(a.code)
    unique.push(a)
  }
  return unique
}

accountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const branchWhere = await accountsScopeWhere(req.user!)
    const list = await prisma.account.findMany({
      where: branchWhere,
      orderBy: { code: 'asc' },
      include: accountInclude,
    })
    const byId = new Map(list.map((a) => [a.id, a]))
    return ok(res, {
      list: list.map((a) =>
        mapAccount(a, a.parentId ? byId.get(a.parentId)?.nameAr ?? null : null),
      ),
    })
  }),
)

accountsRouter.get(
  '/sub',
  asyncHandler(async (req, res) => {
    const branchWhere = await accountsScopeWhere(req.user!)
    const list = await listPostableAccounts(branchWhere)
    const all = await prisma.account.findMany({ where: branchWhere })
    const byId = new Map(all.map((a) => [a.id, a]))
    return ok(res, {
      list: list.map((a) =>
        mapAccount(a, a.parentId ? byId.get(a.parentId)?.nameAr ?? null : null),
      ),
    })
  }),
)

accountsRouter.get(
  '/journal-lines',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : null
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : null
    const accountIdRaw = typeof req.query.accountId === 'string' ? Number(req.query.accountId) : NaN
    const accountId = Number.isFinite(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : null
    const typesRaw = typeof req.query.types === 'string' ? req.query.types : ''
    const types = typesRaw
      ? typesRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : null

    const dateWhere =
      from && to
        ? { journalDate: { gte: from, lte: to } }
        : to
          ? { journalDate: { lte: to } }
          : from
            ? { journalDate: { gte: from } }
            : {}

    const branchWhere = await accountsScopeWhere(req.user!)
    const scopedAccounts = await prisma.account.findMany({
      where: branchWhere,
      select: { id: true },
    })
    const scopedIds = scopedAccounts.map((a) => a.id)
    if (!scopedIds.length) {
      return ok(res, { count: 0, list: [] })
    }

    const accountIdWhere = accountId
      ? scopedIds.includes(accountId)
        ? { accountId }
        : { accountId: { in: [] as number[] } }
      : { accountId: { in: scopedIds } }

    const lines = await prisma.journalLine.findMany({
      where: {
        ...dateWhere,
        ...accountIdWhere,
        ...(types?.length ? { referenceType: { in: types } } : {}),
      },
      include: { account: true },
      orderBy: [{ journalDate: 'desc' }, { id: 'desc' }],
      take: 1000,
    })

    const label = (t: string) => {
      switch (t) {
        case 'booking':
          return 'تذكرة'
        case 'booking_commission':
          return 'عمولة'
        case 'admin_settlement':
          return 'تسديد (أدمن)'
        case 'manual_journal':
          return 'سند قيد'
        case 'receipt':
          return 'سند قبض'
        case 'payment':
          return 'سند صرف'
        default:
          return t
      }
    }

    return ok(res, {
      count: lines.length,
      list: lines.map((l) => ({
        id: l.id,
        journal_date: l.journalDate,
        account_id: l.accountId,
        account_code: l.account.code,
        account_name: l.account.nameAr,
        debit: l.debit,
        credit: l.credit,
        currency_code: l.currencyCode,
        currency_name: l.currencyName,
        notes: l.notes,
        reference_type: l.referenceType,
        reference_id: l.referenceId,
        entry_label: label(l.referenceType),
        created_at: l.createdAt.toISOString(),
      })),
    })
  }),
)

const journalEntryBody = z.object({
  journal_date: z.string().min(1),
  amount: z.number().positive(),
  debit_account_id: z.number().int().positive(),
  credit_account_id: z.number().int().positive(),
  notes: z.string().optional(),
  reference_type: z.enum(['manual_journal', 'receipt', 'payment']).optional(),
  currency_code: z.string().nullable().optional(),
  currency_name: z.string().nullable().optional(),
})

accountsRouter.post(
  '/journal-manual',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = journalEntryBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات القيد غير صالحة')
    if (body.data.debit_account_id === body.data.credit_account_id) {
      return fail(res, 'الحساب المدين والدائن يجب أن يختلفا')
    }

    const [debitAcc, creditAcc] = await Promise.all([
      prisma.account.findUnique({ where: { id: body.data.debit_account_id } }),
      prisma.account.findUnique({ where: { id: body.data.credit_account_id } }),
    ])
    if (!debitAcc || !creditAcc) return fail(res, 'أحد الحسابات غير موجود', 404)

    const referenceType = body.data.reference_type ?? 'manual_journal'
    const ref = Math.abs(Date.now() % 2_000_000_000) || 1
    const notes =
      body.data.notes?.trim() ||
      (referenceType === 'receipt'
        ? 'سند قبض'
        : referenceType === 'payment'
          ? 'سند صرف'
          : 'سند قيد')
    const currencyCode = body.data.currency_code?.trim() || null
    const currencyName = body.data.currency_name?.trim() || null
    await prisma.journalLine.createMany({
      data: [
        {
          referenceId: ref,
          referenceType,
          journalDate: body.data.journal_date,
          accountId: body.data.debit_account_id,
          debit: body.data.amount,
          credit: 0,
          currencyCode,
          currencyName,
          notes,
        },
        {
          referenceId: ref,
          referenceType,
          journalDate: body.data.journal_date,
          accountId: body.data.credit_account_id,
          debit: 0,
          credit: body.data.amount,
          currencyCode,
          currencyName,
          notes,
        },
      ],
    })

    return ok(res, { referenceId: ref, referenceType }, 201)
  }),
)

accountsRouter.put(
  '/journal-manual/:ref',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const ref = Number(paramId(req, 'ref'))
    if (!ref) return fail(res, 'مرجع غير صالح')

    const body = journalEntryBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات القيد غير صالحة')
    if (body.data.debit_account_id === body.data.credit_account_id) {
      return fail(res, 'الحساب المدين والدائن يجب أن يختلفا')
    }

    const referenceType = body.data.reference_type ?? 'manual_journal'
    const existing = await prisma.journalLine.count({
      where: { referenceId: ref, referenceType },
    })
    if (!existing) return fail(res, 'القيد غير موجود', 404)

    const [debitAcc, creditAcc] = await Promise.all([
      prisma.account.findUnique({ where: { id: body.data.debit_account_id } }),
      prisma.account.findUnique({ where: { id: body.data.credit_account_id } }),
    ])
    if (!debitAcc || !creditAcc) return fail(res, 'أحد الحسابات غير موجود', 404)

    const notes =
      body.data.notes?.trim() ||
      (referenceType === 'receipt'
        ? 'سند قبض'
        : referenceType === 'payment'
          ? 'سند صرف'
          : 'سند قيد')
    const currencyCode = body.data.currency_code?.trim() || null
    const currencyName = body.data.currency_name?.trim() || null
    await prisma.$transaction([
      prisma.journalLine.deleteMany({
        where: { referenceId: ref, referenceType },
      }),
      prisma.journalLine.createMany({
        data: [
          {
            referenceId: ref,
            referenceType,
            journalDate: body.data.journal_date,
            accountId: body.data.debit_account_id,
            debit: body.data.amount,
            credit: 0,
            currencyCode,
            currencyName,
            notes,
          },
          {
            referenceId: ref,
            referenceType,
            journalDate: body.data.journal_date,
            accountId: body.data.credit_account_id,
            debit: 0,
            credit: body.data.amount,
            currencyCode,
            currencyName,
            notes,
          },
        ],
      }),
    ])

    return ok(res, { referenceId: ref, referenceType })
  }),
)

accountsRouter.delete(
  '/journal-manual/:ref',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const ref = Number(paramId(req, 'ref'))
    if (!ref) return fail(res, 'مرجع غير صالح')
    const typeRaw = typeof req.query.type === 'string' ? req.query.type : 'manual_journal'
    const referenceType =
      typeRaw === 'receipt' || typeRaw === 'payment' || typeRaw === 'manual_journal'
        ? typeRaw
        : 'manual_journal'
    const result = await prisma.journalLine.deleteMany({
      where: { referenceId: ref, referenceType },
    })
    if (!result.count) return fail(res, 'القيد غير موجود', 404)
    return ok(res, { deleted: result.count })
  }),
)

accountsRouter.get(
  '/:id/children-summary',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const parentId = Number(paramId(req))
    if (!parentId) return fail(res, 'معرّف غير صالح')

    const branchWhere = await accountsScopeWhere(req.user!)
    const parent = await prisma.account.findFirst({
      where: { id: parentId, ...branchWhere },
    })
    if (!parent) return fail(res, 'الحساب غير موجود', 404)

    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : null
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : null

    const all = await prisma.account.findMany({
      where: branchWhere,
      orderBy: { code: 'asc' },
    })
    const childrenOf = (id: number) => all.filter((a) => a.parentId === id)
    const hasChildren = (id: number) => all.some((a) => a.parentId === id)

    /** كل الحسابات تحت الأب بأي عمق (بدون الأب نفسه) */
    const collectDescendants = (rootId: number): typeof all => {
      const out: typeof all = []
      for (const child of childrenOf(rootId)) {
        out.push(child)
        out.push(...collectDescendants(child.id))
      }
      return out
    }

    /**
     * صفوف الجدول = الحسابات الفرعية (أو الأوراق) تحت الشجرة.
     * لا نعرض حسابات رئيسي وسيطة مثل «الأصول المتداولة» — فقط الفروع النهائية المرتبطة بالأب.
     */
    const descendants = collectDescendants(parentId)
    const leafRows = descendants.filter(
      (a) => a.accountLevel === 'فرعي' || !hasChildren(a.id),
    )

    const datePeriod =
      from && to
        ? { journalDate: { gte: from, lte: to } }
        : to
          ? { journalDate: { lte: to } }
          : from
            ? { journalDate: { gte: from } }
            : {}

    const dateClosing = to
      ? { journalDate: { lte: to } }
      : from
        ? { journalDate: { lte: from } }
        : {}

    const leafIds = leafRows.map((a) => a.id)
    const [periodGroups, closingGroups] = leafIds.length
      ? await Promise.all([
          prisma.journalLine.groupBy({
            by: ['accountId'],
            where: { accountId: { in: leafIds }, ...datePeriod },
            _sum: { debit: true, credit: true },
          }),
          prisma.journalLine.groupBy({
            by: ['accountId'],
            where: { accountId: { in: leafIds }, ...dateClosing },
            _sum: { debit: true, credit: true },
          }),
        ])
      : [[], []]

    const periodById = new Map(
      periodGroups.map((g) => [
        g.accountId,
        { debit: g._sum.debit ?? 0, credit: g._sum.credit ?? 0 },
      ]),
    )
    const closingById = new Map(
      closingGroups.map((g) => [
        g.accountId,
        (g._sum.debit ?? 0) - (g._sum.credit ?? 0),
      ]),
    )

    const rows = []
    let totalDebit = 0
    let totalCredit = 0
    let totalBalance = 0

    for (const leaf of leafRows) {
      const period = periodById.get(leaf.id) ?? { debit: 0, credit: 0 }
      const balance = closingById.get(leaf.id) ?? 0
      // لا نعرض الحسابات ذات الرصيد صفر
      if (balance === 0) continue
      totalDebit += period.debit
      totalCredit += period.credit
      totalBalance += balance
      rows.push({
        id: leaf.id,
        code: leaf.code,
        name_ar: leaf.nameAr,
        account_level: leaf.accountLevel,
        debit: period.debit,
        credit: period.credit,
        balance,
      })
    }

    return ok(res, {
      parent: mapAccount(parent),
      from,
      to,
      list: rows,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance: totalBalance,
      },
    })
  }),
)

accountsRouter.get(
  '/:id/balance',
  asyncHandler(async (req, res) => {
    const id = Number(paramId(req))
    if (!id) return fail(res, 'معرّف غير صالح')
    const before =
      typeof req.query.before === 'string' && req.query.before
        ? req.query.before
        : null
    const balance = await getAccountBalance(id, before)
    return ok(res, { balance, accountId: id, before })
  }),
)

const accountBody = z.object({
  code: z.string().min(1).optional(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable().optional(),
  parent_id: z.number().nullable().optional(),
  account_level: z.enum(['رئيسي', 'فرعي']).optional(),
  financial_statement: z.string().nullable().optional(),
})

accountsRouter.post(
  '/',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = accountBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const parentId = body.data.parent_id ?? null
    const branchId = branchIdOnCreate(req.user!)
    const level =
      body.data.account_level ?? (parentId ? 'فرعي' : 'رئيسي')

    if (level === 'فرعي' && !parentId) {
      return fail(res, 'الحساب الفرعي يجب أن يرتبط بحساب أب')
    }

    let code = body.data.code
    if (!code) {
      if (parentId) {
        const parent = await prisma.account.findUnique({ where: { id: parentId } })
        const siblings = await prisma.account.count({
          where: { parentId, branchId },
        })
        code = `${parent?.code ?? ''}${String(siblings + 1).padStart(2, '0')}`
      } else {
        const roots = await prisma.account.count({ where: { parentId: null, branchId } })
        code = String(roots + 1)
      }
    }

    const existing = await prisma.account.findFirst({ where: { code, branchId } })
    if (existing) return fail(res, 'رقم الحساب مستخدم مسبقاً', 409)

    if (parentId) {
      const parentAccount = await prisma.account.findUnique({ where: { id: parentId } })
      if (!parentAccount) return fail(res, 'حساب الأب غير موجود', 404)
      if (!sameLedgerBranch(parentAccount.branchId, branchId)) {
        return fail(res, 'حساب الأب لا ينتمي لنفس دليل الحسابات', 400)
      }
    }

    const creator = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, username: true },
    })
    const account = await prisma.account.create({
      data: {
        code,
        nameAr: body.data.name_ar,
        nameEn: body.data.name_en ?? null,
        parentId,
        accountLevel: level,
        financialStatement: body.data.financial_statement ?? null,
        branchId,
        createdByName: creator?.name || creator?.username || null,
      },
      include: accountInclude,
    })
    const parent = parentId
      ? await prisma.account.findUnique({ where: { id: parentId } })
      : null
    return ok(res, { account: mapAccount(account, parent?.nameAr ?? null) }, 201)
  }),
)

accountsRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(paramId(req))
    if (!id) return fail(res, 'معرّف غير صالح')
    const body = accountBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const prev = await prisma.account.findUnique({ where: { id } })
    if (!prev) return fail(res, 'الحساب غير موجود', 404)
    if (!(await assertAccountInUserLedger(req.user!, prev))) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const parentId =
      body.data.parent_id !== undefined ? body.data.parent_id : prev.parentId
    const level =
      body.data.account_level !== undefined
        ? body.data.account_level
        : prev.accountLevel

    if (level === 'فرعي' && !parentId) {
      return fail(res, 'الحساب الفرعي يجب أن يرتبط بحساب أب')
    }

    if (parentId) {
      const parentAccount = await prisma.account.findUnique({ where: { id: parentId } })
      if (!parentAccount) return fail(res, 'حساب الأب غير موجود', 404)
      if (!sameLedgerBranch(parentAccount.branchId, prev.branchId)) {
        return fail(res, 'حساب الأب لا ينتمي لنفس دليل الحسابات', 400)
      }
    }

    if (body.data.code && body.data.code !== prev.code) {
      const clash = await prisma.account.findFirst({
        where: { code: body.data.code, branchId: prev.branchId },
      })
      if (clash && clash.id !== id) {
        return fail(res, 'رقم الحساب مستخدم مسبقاً', 409)
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        code: body.data.code ?? prev.code,
        nameAr: body.data.name_ar,
        nameEn: body.data.name_en !== undefined ? body.data.name_en : prev.nameEn,
        parentId,
        accountLevel: level,
        financialStatement:
          body.data.financial_statement !== undefined
            ? body.data.financial_statement
            : prev.financialStatement,
      },
    })
    const parent = account.parentId
      ? await prisma.account.findUnique({ where: { id: account.parentId } })
      : null
    return ok(res, { account: mapAccount(account, parent?.nameAr ?? null) })
  }),
)

accountsRouter.get(
  '/statement/:id',
  asyncHandler(async (req, res) => {
    const accountId = Number(paramId(req))
    if (!accountId) return fail(res, 'معرّف غير صالح')
    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) return fail(res, 'الحساب غير موجود', 404)
    if (!(await assertAccountInUserLedger(req.user!, account))) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const lines = await prisma.journalLine.findMany({
      where: { accountId },
      orderBy: [{ journalDate: 'asc' }, { id: 'asc' }],
      include: { account: true },
    })
    let balance = 0
    const list = lines.map((l) => {
      balance += l.debit - l.credit
      return {
        id: l.id,
        journal_date: l.journalDate,
        account_name: l.account.nameAr,
        debit: l.debit,
        credit: l.credit,
        balance,
        notes: l.notes,
        reference_type: l.referenceType,
        reference_id: l.referenceId,
      }
    })
    return ok(res, { list })
  }),
)
