import { prisma } from '../config'

type OfficeRow = {
  id: string
  name: string
  ledgerAccountId: number | null
  branchId: string | null
}

/** ذمة المكتب المربوطة يدوياً، وإلا ذمة الفرع إن وُجدت */
export async function resolveOfficeLedgerAccountId<T extends OfficeRow>(
  office: T,
): Promise<{ ledgerAccountId: number | null; office: T }> {
  let ledgerAccountId = office.ledgerAccountId
  if (!ledgerAccountId && office.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: office.branchId } })
    if (branch?.ledgerAccountId) ledgerAccountId = branch.ledgerAccountId
  }
  return { ledgerAccountId, office }
}