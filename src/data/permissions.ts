import type { Role } from '../types'

export type PageAction = 'view' | 'add' | 'edit' | 'delete'
export type PagePerm = Record<PageAction, boolean> & { all?: boolean }
export type UserPermissionsMap = Record<string, PagePerm>

export const PAGE_ACTIONS: PageAction[] = ['view', 'add', 'edit', 'delete']

export const ACTION_LABELS: Record<PageAction | 'all', string> = {
  all: 'الكل',
  view: 'عرض',
  add: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
}

export type PermissionSection = {
  id: string
  label: string
  path?: string
  children?: { id: string; label: string; path: string }[]
}

/** صفحات مكتب السفريات — بنفس أسلوب منصة الكروت */
export const officePermissionSections: PermissionSection[] = [
  { id: 'dashboard', label: 'لوحة المكتب', path: '/office' },
  {
    id: 'staff-group',
    label: 'الموظفون والصلاحيات',
    children: [
      { id: 'staff', label: 'الموظفون', path: '/office/staff' },
      { id: 'user-permissions', label: 'صلاحية المستخدمين', path: '/office/permissions' },
    ],
  },
  { id: 'bookings', label: 'الحجوزات', path: '/office/bookings' },
  { id: 'customers', label: 'العملاء', path: '/office/customers' },
  { id: 'accounting', label: 'المحاسبة', path: '/office/accounting' },
  { id: 'statement', label: 'كشف الحساب', path: '/office/statement' },
  { id: 'reports', label: 'التقارير', path: '/office/reports' },
]

export function getAllPageIds(sections: PermissionSection[] = officePermissionSections): string[] {
  const ids: string[] = []
  sections.forEach((section) => {
    if (section.children) section.children.forEach((child) => ids.push(child.id))
    else ids.push(section.id)
  })
  return ids
}

export function emptyPagePerm(): PagePerm {
  return { view: false, add: false, edit: false, delete: false }
}

export function fullPagePerm(): PagePerm {
  return { view: true, add: true, edit: true, delete: true }
}

export function withAllFlag(pagePerms: PagePerm): PagePerm {
  const all = PAGE_ACTIONS.every((action) => pagePerms[action])
  return { ...pagePerms, all }
}

export function createFullAccess(): UserPermissionsMap {
  const perms: UserPermissionsMap = {}
  getAllPageIds().forEach((id) => {
    perms[id] = withAllFlag(fullPagePerm())
  })
  return perms
}

/** صلاحيات الصفحة الافتراضية حسب الدور قبل الحفظ المخصص */
export function roleDefaultPermissions(role: Role): UserPermissionsMap {
  if (role === 'admin' || role === 'office_manager') return createFullAccess()

  const base: UserPermissionsMap = {}
  getAllPageIds().forEach((id) => {
    base[id] = emptyPagePerm()
  })

  if (role === 'booking_clerk') {
    base.dashboard = { view: true, add: false, edit: false, delete: false }
    base.bookings = { view: true, add: true, edit: true, delete: false }
    base.customers = { view: true, add: true, edit: true, delete: false }
  }

  if (role === 'accountant') {
    base.dashboard = { view: true, add: false, edit: false, delete: false }
    base.accounting = { view: true, add: true, edit: true, delete: false }
    base.statement = { view: true, add: false, edit: false, delete: false }
    base.reports = { view: true, add: false, edit: false, delete: false }
  }

  Object.keys(base).forEach((id) => {
    base[id] = withAllFlag(base[id])
  })
  return base
}

export function normalizePermissions(
  raw: unknown,
  fallbackRole?: Role,
): UserPermissionsMap | null {
  if (!raw || typeof raw !== 'object') return null
  const map = raw as Record<string, Partial<PagePerm>>
  const keys = Object.keys(map)
  if (!keys.length) return null

  const next: UserPermissionsMap = fallbackRole ? roleDefaultPermissions(fallbackRole) : {}
  keys.forEach((pageId) => {
    const p = map[pageId] ?? {}
    next[pageId] = withAllFlag({
      view: !!p.view,
      add: !!p.add,
      edit: !!p.edit,
      delete: !!p.delete,
    })
  })
  return next
}

export function resolveUserPermissions(
  role: Role,
  saved: UserPermissionsMap | null | undefined,
): UserPermissionsMap {
  if (saved && Object.keys(saved).length) {
    const defaults = roleDefaultPermissions(role)
    const merged: UserPermissionsMap = { ...defaults }
    Object.entries(saved).forEach(([id, perms]) => {
      merged[id] = withAllFlag({
        view: !!perms.view,
        add: !!perms.add,
        edit: !!perms.edit,
        delete: !!perms.delete,
      })
    })
    return merged
  }
  return roleDefaultPermissions(role)
}

export function hasPageAction(
  permissions: UserPermissionsMap,
  pageId: string,
  action: PageAction,
): boolean {
  return !!permissions[pageId]?.[action]
}

/** ربط صلاحيات التطبيق القديمة بصفحات المنصة */
export const LEGACY_ACTION_TO_PAGE: Record<string, { page: string; action: PageAction }> = {
  book: { page: 'bookings', action: 'add' },
  cancel_booking: { page: 'bookings', action: 'delete' },
  print_ticket: { page: 'bookings', action: 'view' },
  view_accounts: { page: 'accounting', action: 'view' },
  view_reports: { page: 'reports', action: 'view' },
  manage_office_users: { page: 'staff', action: 'view' },
}

/** كشف الحساب يتبع صلاحية المحاسبة إن لم تُضبط مستقلة */
export function hasStatementAccess(permissions: UserPermissionsMap): boolean {
  return hasPageAction(permissions, 'statement', 'view') || hasPageAction(permissions, 'accounting', 'view')
}
