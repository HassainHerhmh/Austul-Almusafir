const SCOPE_KEY = 'austul-accounting-scope'

export type AccountingScope =
  | { kind: 'agency' }
  | { kind: 'branch'; branchId: string; branchName: string }

export function getAccountingScope(): AccountingScope {
  try {
    const raw = localStorage.getItem(SCOPE_KEY)
    if (!raw) return { kind: 'agency' }
    const parsed = JSON.parse(raw) as AccountingScope
    if (parsed.kind === 'branch' && parsed.branchId) return parsed
    if (parsed.kind === 'agency') return { kind: 'agency' }
  } catch {
    /* ignore */
  }
  return { kind: 'agency' }
}

/** يُستدعى بعد تسجيل الدخول أو تحديث الجلسة — قبل تحميل بيانات المحاسبة المحلية */
export function setAccountingScopeFromUser(user: {
  role: string
  branchId?: string | null
  branchName?: string | null
}) {
  const next: AccountingScope =
    user.role === 'branch_admin' && user.branchId
      ? {
          kind: 'branch',
          branchId: user.branchId,
          branchName: (user.branchName || '').trim() || 'الفرع',
        }
      : { kind: 'agency' }
  localStorage.setItem(SCOPE_KEY, JSON.stringify(next))
}

export function clearAccountingScope() {
  localStorage.removeItem(SCOPE_KEY)
}

export function accountingStorageKey(): string {
  const scope = getAccountingScope()
  const prefix = 'austul-cards-accounting-v3'
  if (scope.kind === 'branch') return `${prefix}:branch:${scope.branchId}`
  return `${prefix}:agency`
}

/** اسم يُعرض في جداول الصناديق والبنوك (وكالة = الفرع الرئيسي) */
export function accountingBranchLabel(): string {
  const scope = getAccountingScope()
  if (scope.kind === 'branch') return scope.branchName
  return 'الفرع الرئيسي'
}