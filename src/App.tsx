import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { Shell } from './components/Shell'
import { RequireAuth } from './components/utils'
import { AppProvider } from './context/AppContext'
import { DriverTrackingPage } from './pages/driver/DriverTrackingPage'
import { PublicTripTrackPage } from './pages/public/PublicTripTrackPage'
import { OfficeAccountingPage } from './pages/office/OfficeAccountingPage'
import { OfficeStatementPage } from './pages/office/OfficeStatementPage'
import { OfficeBookingsPage } from './pages/office/OfficeBookingsPage'
import { OfficeCustomersPage } from './pages/office/OfficeCustomersPage'
import { OfficeHome } from './pages/office/OfficeHome'
import { OfficeReportsPage } from './pages/office/OfficeReportsPage'
import { OfficePaymentsReportPage } from './pages/office/OfficePaymentsReportPage'
import { OfficeStaffPage } from './pages/office/OfficeStaffPage'
import { OfficePermissionsPage } from './pages/office/OfficePermissionsPage'
import { OfficeTrackingPage } from './pages/office/OfficeTrackingPage'
import { BrandProvider } from './context/BrandContext'
import { renderAdminPortalRoutes } from './routes/AdminPortalRoutes'

export default function App() {
  return (
    <BrandProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/track/:token" element={<PublicTripTrackPage />} />

            <Route
              path="/driver"
              element={
                <RequireAuth roles={['driver']}>
                  <DriverTrackingPage />
                </RequireAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAuth roles={['admin']}>
                  <Shell />
                </RequireAuth>
              }
            >
              {renderAdminPortalRoutes(true)}
            </Route>

            <Route
              path="/branch"
              element={
                <RequireAuth roles={['branch_admin']}>
                  <Shell />
                </RequireAuth>
              }
            >
              {renderAdminPortalRoutes(false)}
            </Route>

            <Route
              path="/office"
              element={
                <RequireAuth roles={['office_manager', 'booking_clerk', 'accountant']}>
                  <Shell />
                </RequireAuth>
              }
            >
              <Route index element={<OfficeHome />} />
              <Route path="staff" element={<OfficeStaffPage />} />
              <Route path="permissions" element={<OfficePermissionsPage />} />
              <Route path="bookings" element={<OfficeBookingsPage />} />
              <Route path="tracking" element={<OfficeTrackingPage />} />
              <Route path="customers" element={<OfficeCustomersPage />} />
              <Route path="accounting" element={<OfficeAccountingPage />} />
              <Route path="statement" element={<OfficeStatementPage />} />
              <Route path="reports" element={<OfficeReportsPage />} />
              <Route path="payments-report" element={<OfficePaymentsReportPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </BrandProvider>
  )
}