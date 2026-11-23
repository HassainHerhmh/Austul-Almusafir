import type { AuthUser } from '../middleware/auth'
import { prisma } from '../config'

export type OfficeScope = 'all' | string[]

export async function officeIdsForUser(user: AuthUser): Promise<OfficeScope> {
  if (user.role === 'admin') return 'all'
  if (user.role === 'branch_admin') {
    if (!user.branchId) return []
    const rows = await prisma.office.findMany({
      where: { branchId: user.branchId },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }
  if (user.officeId) return [user.officeId]
  return []
}

export function officeIdWhere(scope: OfficeScope) {
  if (scope === 'all') return {}
  if (scope.length === 0) return { officeId: { in: [] as string[] } }
  return { officeId: { in: scope } }
}

/** فلتر بيانات تملكها الفرع (رحلات، باصات، حسابات...) — الأدمن يرى الكل */
export function branchOwnedWhere(user: AuthUser) {
  if (user.role === 'admin') return {}
  if (user.role === 'branch_admin' && user.branchId) {
    return { branchId: user.branchId }
  }
  return { branchId: '__none__' }
}

/** وجهات/تأشيرات للعرض في المكاتب + الفرع */
export async function catalogListWhere(user: AuthUser) {
  if (user.role === 'admin') return {}
  if (user.role === 'branch_admin' && user.branchId) {
    return { branchId: user.branchId }
  }
  if (user.officeId) {
    const office = await prisma.office.findUnique({
      where: { id: user.officeId },
      select: { branchId: true },
    })
    if (office?.branchId) {
      return { OR: [{ branchId: office.branchId }, { branchId: null }] }
    }
    return { branchId: null }
  }
  return { branchId: '__none__' }
}

/**
 * قائمة الباصات/السائقين للاختيار في الرحلات — مدير الفرع يستخدم أسطول الوكالة (branchId null).
 */
export function fleetListWhere(user: AuthUser) {
  if (user.role === 'admin') return {}
  if (user.role === 'branch_admin') return { branchId: null }
  return branchOwnedWhere(user)
}

/** عند الإنشاء: يُفرض branchId لمدير الفرع */
export function branchIdOnCreate(user: AuthUser, bodyBranchId?: string | null): string | null {
  if (user.role === 'branch_admin') return user.branchId
  return bodyBranchId ?? null
}

/** رحلات: الوكالة ترى الكل · الفرع رحلاته · المكتب يرى المركزية + رحلات فرعه */
/** دليل حسابات: فرع منفصل · مكتب فرع يرى حسابات فرعه · وكالة branchId null */
export async function accountsScopeWhere(user: AuthUser) {
  /** مركز الوكالة فقط — لا يختلط بدليل فروع المكاتب */
  if (user.role === 'admin') return { branchId: null }
  if (user.role === 'branch_admin' && user.branchId) {
    return { branchId: user.branchId }
  }
  if (user.officeId) {
    const office = await prisma.office.findUnique({
      where: { id: user.officeId },
      select: { branchId: true },
    })
    if (office?.branchId) return { branchId: office.branchId }
    return { branchId: null }
  }
  return { branchId: '__none__' }
}

/**
 * رحلات الركاب: مشتركة (كل الفروع + الرئيسي).
 * الحملة: تظهر للوكالة + مدير فرع مكاتبه + المكتب المعيّن لها فقط.
 */
export async function tripsListWhere(user: AuthUser) {
  if (user.role === 'admin') return {}

  if (user.role === 'branch_admin' && user.branchId) {
    const scope = await officeIdsForUser(user)
    const officeIds = scope === 'all' ? [] : scope
    const campaignClause =
      officeIds.length > 0
        ? {
            tripKind: 'campaign' as const,
            campaignOfficeId: { in: officeIds },
          }
        : null
    return {
      OR: [{ tripKind: 'passenger' }, ...(campaignClause ? [campaignClause] : [])],
    }
  }

  if (user.officeId) {
    return {
      OR: [
        { tripKind: 'passenger' },
        { tripKind: 'campaign', campaignOfficeId: user.officeId },
      ],
    }
  }

  return { tripKind: 'passenger' }
}