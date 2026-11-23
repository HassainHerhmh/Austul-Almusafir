import { prisma } from '../config'
import { findOfficeLedgerAccount } from './ledger'

type OfficeRow = {
  id: string
  name: string
  ledgerAccountId: number | null
  branchId: string | null
}

/** ذمة المكتب أولاً، وإلا ذمة الفرع، وإلا البحث باسم المكتب */
export async function resolveOfficeLedgerAccountId<T extends OfficeRow>(
  office: T,
): Promise<{ ledgerAccountId: number | null; office: T }> {
  let ledgerAccountId = office.ledgerAccountId
  if (!ledgerAccountId) {
    ledgerAccountId = await findOfficeLedgerAccount(office.name)
    if (ledgerAccountId) {
      await prisma.office.update({
        where: { id: office.id },
        data: { ledgerAccountId },
      })
      office = { ...office, ledgerAccountId }
    }
  }
  if (!ledgerAccountId && office.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: office.branchId } })
    if (branch?.ledgerAccountId) ledgerAccountId = branch.ledgerAccountId
  }
  return { ledgerAccountId, office }
}