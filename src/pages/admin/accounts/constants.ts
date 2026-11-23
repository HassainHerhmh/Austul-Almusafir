import { accountingBranchLabel } from '../../../api/accountingScope'

/** للعرض في جداول المحاسبة المحلية — يعكس فرع الجلسة الحالية */
export function defaultBranchDisplayName(): string {
  return accountingBranchLabel()
}

export const DEFAULT_BRANCH_NAME = 'الفرع الرئيسي'
