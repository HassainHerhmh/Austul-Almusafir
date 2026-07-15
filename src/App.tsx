import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { Shell } from './components/Shell'
import { RequireAuth } from './components/utils'
import { AppProvider } from './context/AppContext'
import Accounting from './pages/admin/accounts/Accounting'
import Operations from './pages/admin/accounts/operations'
import CurrencyExchange from './pages/admin/accounts/operations/CurrencyExchange'
import JournalEntry from './pages/admin/accounts/operations/JournalEntry'
import PaymentVoucher from './pages/admin/accounts/operations/PaymentVoucher'
import ReceiptVoucher from './pages/admin/accounts/operations/ReceiptVoucher'
import AccountReports from './pages/admin/accounts/reports/AccountReports'
import AccountStatement from './pages/admin/accounts/reports/AccountStatement'
import AccountCeiling from './pages/admin/accounts/setup/AccountCeiling'
import AccountGroups from './pages/admin/accounts/setup/AccountGroups'
import AccountsSetup from './pages/admin/accounts/setup/Accounts'
import BankGroups from './pages/admin/accounts/setup/BankGroups'
import Banks from './pages/admin/accounts/setup/Banks'
import CashBoxGroups from './pages/admin/accounts/setup/CashBoxGroups'
import CashBoxes from './pages/admin/accounts/setup/CashBoxes'
import Currencies from './pages/admin/accounts/setup/Currencies'
import JournalTypes from './pages/admin/accounts/setup/JournalTypes'
import PaymentTypes from './pages/admin/accounts/setup/PaymentTypes'
import ReceiptTypes from './pages/admin/accounts/setup/ReceiptTypes'
import TransitAccountsSettings from './pages/admin/accounts/setup/TransitAccountsSettings'
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage'
import { AdminHome } from './pages/admin/AdminHome'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'
import { BusesPage } from './pages/admin/BusesPage'
import { DestinationsPage } from './pages/admin/DestinationsPage'
import { DriversPage } from './pages/admin/DriversPage'
import { OfficesPage } from './pages/admin/OfficesPage'
import { TripsPage } from './pages/admin/TripsPage'
import { UsersPage } from './pages/admin/UsersPage'
import { OfficeAccountingPage } from './pages/office/OfficeAccountingPage'
import { OfficeStatementPage } from './pages/office/OfficeStatementPage'
import { OfficeBookingsPage } from './pages/office/OfficeBookingsPage'
import { OfficeCustomersPage } from './pages/office/OfficeCustomersPage'
import { OfficeHome } from './pages/office/OfficeHome'
import { OfficeReportsPage } from './pages/office/OfficeReportsPage'
import { OfficeStaffPage } from './pages/office/OfficeStaffPage'
import { OfficePermissionsPage } from './pages/office/OfficePermissionsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { BrandProvider } from './context/BrandContext'

export default function App() {
  return (
    <BrandProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <RequireAuth roles={['admin']}>
                  <Shell />
                </RequireAuth>
              }
            >
              <Route index element={<AdminHome />} />
              <Route path="offices" element={<OfficesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="buses" element={<BusesPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="destinations" element={<DestinationsPage />} />
              <Route path="trips" element={<TripsPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />

              <Route path="accounts" element={<Accounting />}>
                <Route index element={<Navigate to="setup/accounts" replace />} />
                <Route path="setup/accounts" element={<AccountsSetup />} />
                <Route path="setup/currencies" element={<Currencies />} />
                <Route path="setup/account-groups" element={<AccountGroups />} />
                <Route path="setup/account-ceiling" element={<AccountCeiling />} />
                <Route path="setup/banks" element={<Banks />} />
                <Route path="setup/bank-groups" element={<BankGroups />} />
                <Route path="setup/cash-boxes" element={<CashBoxes />} />
                <Route path="setup/cash-box-groups" element={<CashBoxGroups />} />
                <Route path="setup/receipt-types" element={<ReceiptTypes />} />
                <Route path="setup/payment-types" element={<PaymentTypes />} />
                <Route path="setup/journal-types" element={<JournalTypes />} />
                <Route path="setup/transit-accounts" element={<TransitAccountsSettings />} />
                <Route path="operations" element={<Operations />}>
                  <Route index element={<Navigate to="receipt-voucher" replace />} />
                  <Route path="receipt-voucher" element={<ReceiptVoucher />} />
                  <Route path="payment-voucher" element={<PaymentVoucher />} />
                  <Route path="journal-entry" element={<JournalEntry />} />
                  <Route path="currency-exchange" element={<CurrencyExchange />} />
                </Route>
                <Route path="reports" element={<AccountReports />}>
                  <Route path="account-statement" element={<AccountStatement />} />
                </Route>
              </Route>

              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
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
              <Route path="customers" element={<OfficeCustomersPage />} />
              <Route path="accounting" element={<OfficeAccountingPage />} />
              <Route path="statement" element={<OfficeStatementPage />} />
              <Route path="reports" element={<OfficeReportsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </BrandProvider>
  )
}
