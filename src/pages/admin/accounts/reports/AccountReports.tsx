import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function AccountReports() {
  const location = useLocation()
  if (location.pathname.endsWith('/reports') || location.pathname.endsWith('/reports/')) {
    return <Navigate to="account-statement" replace />
  }
  return <Outlet />
}
