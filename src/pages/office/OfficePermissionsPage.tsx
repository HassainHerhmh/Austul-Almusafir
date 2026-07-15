import { Fragment, useEffect, useMemo, useState } from 'react'
import { ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import {
  ACTION_LABELS,
  PAGE_ACTIONS,
  createFullAccess,
  normalizePermissions,
  officePermissionSections,
  resolveUserPermissions,
  withAllFlag,
  type PageAction,
  type PagePerm,
  type PermissionSection,
  type UserPermissionsMap,
} from '../../data/permissions'
import type { Role } from '../../types'

function PermissionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="perm-checkbox" title={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="perm-checkmark" />
    </label>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`perm-chevron${open ? ' open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function OfficePermissionsPage() {
  const { state, currentOffice, can, canPage, saveUserPermissions } = useApp()
  const officeId = currentOffice!.id
  const staff = useMemo(
    () => state.users.filter((u) => u.officeId === officeId && u.role !== 'admin'),
    [state.users, officeId],
  )

  const [roleFilter, setRoleFilter] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'staff-group': true })
  const [draft, setDraft] = useState<{ userId: string; permissions: UserPermissionsMap } | null>(
    null,
  )
  const [savedNotice, setSavedNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!selectedUserId && staff[0]) setSelectedUserId(staff[0].id)
  }, [staff, selectedUserId])

  if (!can('manage_office_users') && !canPage('user-permissions', 'view')) {
    return (
      <div className="panel">
        <div className="empty">ليس لديك صلاحية إدارة صلاحيات المستخدمين</div>
      </div>
    )
  }

  const filteredUsers = roleFilter ? staff.filter((u) => u.role === roleFilter) : staff
  const selectedUser = staff.find((u) => u.id === selectedUserId)
  const hasSavedPermissions = !!(
    selectedUser?.permissions && Object.keys(selectedUser.permissions).length
  )

  const currentPermissions = useMemo(() => {
    if (!selectedUser) return createFullAccess()
    if (draft && draft.userId === selectedUserId) return draft.permissions
    const saved = normalizePermissions(selectedUser.permissions, selectedUser.role)
    return resolveUserPermissions(selectedUser.role, saved)
  }, [draft, selectedUserId, selectedUser])

  const updateDraft = (updater: (perms: UserPermissionsMap) => UserPermissionsMap) => {
    setDraft({
      userId: selectedUserId,
      permissions: updater(
        draft?.userId === selectedUserId
          ? { ...draft.permissions }
          : { ...currentPermissions },
      ),
    })
    setSavedNotice('')
  }

  const getPagePerms = (pageId: string): PagePerm =>
    withAllFlag(currentPermissions[pageId] || { view: true, add: true, edit: true, delete: true })

  const setPageAction = (pageId: string, action: PageAction | 'all', value: boolean) => {
    updateDraft((perms) => {
      const next: PagePerm = { ...getPagePerms(pageId), [action]: value }
      if (action === 'all') {
        PAGE_ACTIONS.forEach((a) => {
          next[a] = value
        })
      } else {
        next.all = PAGE_ACTIONS.every((a) => next[a])
      }
      perms[pageId] = next
      return perms
    })
  }

  const setSectionActions = (
    section: PermissionSection,
    action: PageAction | 'all',
    value: boolean,
  ) => {
    const pageIds = section.children ? section.children.map((c) => c.id) : [section.id]
    updateDraft((perms) => {
      pageIds.forEach((pageId) => {
        const next: PagePerm = { ...getPagePerms(pageId), [action]: value }
        if (action === 'all') PAGE_ACTIONS.forEach((a) => { next[a] = value })
        else next.all = PAGE_ACTIONS.every((a) => next[a])
        perms[pageId] = next
      })
      return perms
    })
  }

  const isSectionChecked = (section: PermissionSection, action: PageAction | 'all') => {
    const pageIds = section.children ? section.children.map((c) => c.id) : [section.id]
    return pageIds.every((pageId) => !!getPagePerms(pageId)[action])
  }

  const handleSave = async () => {
    if (!selectedUserId || !draft || draft.userId !== selectedUserId) {
      setSavedNotice('لا توجد تغييرات للحفظ')
      return
    }
    const cleaned: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }> =
      {}
    Object.entries(draft.permissions).forEach(([pageId, pagePerms]) => {
      cleaned[pageId] = {
        view: !!pagePerms.view,
        add: !!pagePerms.add,
        edit: !!pagePerms.edit,
        delete: !!pagePerms.delete,
      }
    })
    setBusy(true)
    const err = await saveUserPermissions(selectedUserId, cleaned)
    setBusy(false)
    if (err) {
      setSavedNotice(err)
      return
    }
    setDraft(null)
    setSavedNotice('تم حفظ الصلاحيات بنجاح')
  }

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId)
    setDraft(null)
    setSavedNotice('')
  }

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role)
    const users = role ? staff.filter((u) => u.role === role) : staff
    if (!users.some((u) => u.id === selectedUserId)) {
      setSelectedUserId(users[0]?.id ?? '')
    }
    setDraft(null)
    setSavedNotice('')
  }

  const renderActionCells = (pageId: string) =>
    (['all', ...PAGE_ACTIONS] as const).map((action) => (
      <td key={action} className="perm-action-cell">
        <PermissionCheckbox
          checked={!!getPagePerms(pageId)[action]}
          label={ACTION_LABELS[action]}
          onChange={(value) => setPageAction(pageId, action, value)}
        />
      </td>
    ))

  const renderSectionActionCells = (section: PermissionSection) =>
    (['all', ...PAGE_ACTIONS] as const).map((action) => (
      <td key={action} className="perm-action-cell">
        <PermissionCheckbox
          checked={isSectionChecked(section, action)}
          label={ACTION_LABELS[action]}
          onChange={(value) => setSectionActions(section, action, value)}
        />
      </td>
    ))

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>صلاحية المستخدمين</h1>
        </div>
      </header>

      <div className="panel perm-filters">
        <div className="form-grid">
          <div className="field">
            <label>فلترة حسب الدور</label>
            <select value={roleFilter} onChange={(e) => handleRoleFilterChange(e.target.value)}>
              <option value="">كل الموظفين</option>
              <option value="office_manager">مدير مكتب</option>
              <option value="booking_clerk">موظف حجز</option>
              <option value="accountant">محاسب</option>
            </select>
          </div>
          <div className="field">
            <label>المستخدم</label>
            <select
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value)}
            >
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {ROLE_LABELS[user.role as Role]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="perm-notice">
        {!selectedUser
          ? 'أضف موظفاً أولاً من صفحة الموظفين.'
          : !hasSavedPermissions
            ? 'لم تُحفظ صلاحيات لهذا المستخدم بعد — الجدول يعرض الافتراضي حسب الدور. عدّل واضغط حفظ لتطبيق التقييد.'
            : 'تم حفظ صلاحيات مخصصة لهذا المستخدم. يمكنك تعديلها وحفظ التغييرات.'}
      </div>

      {selectedUser && (
        <div className="panel table-wrap perm-table-card">
          <table className="data perm-table">
            <thead>
              <tr>
                <th className="perm-page-col">الصفحة</th>
                {(['all', ...PAGE_ACTIONS] as const).map((action) => (
                  <th key={action}>{ACTION_LABELS[action]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {officePermissionSections.map((section) => (
                <Fragment key={section.id}>
                  <tr className="perm-section-row">
                    <td className="perm-page-col">
                      <div className="perm-page-cell">
                        {section.children ? (
                          <button
                            type="button"
                            className="perm-expand-btn"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [section.id]: !prev[section.id],
                              }))
                            }
                            aria-label={expanded[section.id] ? 'طي القسم' : 'فتح القسم'}
                          >
                            <ChevronIcon open={!!expanded[section.id]} />
                          </button>
                        ) : (
                          <span className="perm-expand-spacer" />
                        )}
                        <div>
                          <div className="perm-page-title">{section.label}</div>
                          <div className="perm-page-hint">تحديد القسم كامل</div>
                        </div>
                      </div>
                    </td>
                    {renderSectionActionCells(section)}
                  </tr>
                  {section.children &&
                    expanded[section.id] &&
                    section.children.map((child) => (
                      <tr key={child.id} className="perm-child-row">
                        <td className="perm-page-col">
                          <div className="perm-page-cell perm-page-cell-child">
                            <div>
                              <div className="perm-page-title">{child.label}</div>
                              <div className="perm-page-path">{child.path}</div>
                            </div>
                          </div>
                        </td>
                        {renderActionCells(child.id)}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="actions" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={busy || !selectedUser}
        >
          {busy ? 'جاري الحفظ…' : 'حفظ الصلاحيات'}
        </button>
        {savedNotice && <span className="perm-save-notice">{savedNotice}</span>}
      </div>
    </div>
  )
}
