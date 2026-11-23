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