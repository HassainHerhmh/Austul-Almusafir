import { Navigate, Route } from 'react-router-dom'
import Accounting from '../pages/admin/accounts/Accounting'
import Operations from '../pages/admin/accounts/operations'
import CurrencyExchange from '../pages/admin/accounts/operations/CurrencyExchange'
import JournalEntry from '../pages/admin/accounts/operations/JournalEntry'
import PaymentVoucher from '../pages/admin/accounts/operations/PaymentVoucher'
import ReceiptVoucher from '../pages/admin/accounts/operations/ReceiptVoucher'
import AccountReports from '../pages/admin/accounts/reports/AccountReports'
import AccountStatement from '../pages/admin/accounts/reports/AccountStatement'
import AccountCeiling from '../pages/admin/accounts/setup/AccountCeiling'
import AccountGroups from '../pages/admin/accounts/setup/AccountGroups'
import AccountsSetup from '../pages/admin/accounts/setup/Accounts'
import BankGroups from '../pages/admin/accounts/setup/BankGroups'
import Banks from '../pages/admin/accounts/setup/Banks'
import CashBoxGroups from '../pages/admin/accounts/setup/CashBoxGroups'
import CashBoxes from '../pages/admin/accounts/setup/CashBoxes'
import Currencies from '../pages/admin/accounts/setup/Currencies'
import JournalTypes from '../pages/admin/accounts/setup/JournalTypes'
import PaymentTypes from '../pages/admin/accounts/setup/PaymentTypes'
import ReceiptTypes from '../pages/admin/accounts/setup/ReceiptTypes'
import TransitAccountsSettings from '../pages/admin/accounts/setup/TransitAccountsSettings'
import { AdminBookingsPage } from '../pages/admin/AdminBookingsPage'
import { AdminTrackingPage } from '../pages/admin/AdminTrackingPage'
import { AdminHome } from '../pages/admin/AdminHome'
import { AdminReportsPage } from '../pages/admin/AdminReportsPage'
import { AdminJournalReviewPage } from '../pages/admin/AdminJournalReviewPage'
import { BusesPage } from '../pages/admin/BusesPage'
import { DestinationsPage } from '../pages/admin/DestinationsPage'
import { VisaTypesPage } from '../pages/admin/VisaTypesPage'
import { DriversPage } from '../pages/admin/DriversPage'
import { BranchesPage } from '../pages/admin/BranchesPage'
import { OfficesPage } from '../pages/admin/OfficesPage'
import { TripsPage } from '../pages/admin/TripsPage'
import { UsersPage } from '../pages/admin/UsersPage'
import { SettingsPage } from '../pages/admin/SettingsPage'
import { PartnerApiPage } from '../pages/admin/PartnerApiPage'
import { PrintSettingsPage } from '../pages/admin/PrintSettingsPage'

/** مسارات لوحة الإدارة — يجب استدعاؤها كـ {renderAdminPortalRoutes(...)} داخل <Route> وليس كمكوّن */
export function renderAdminPortalRoutes(showAgencyOnly: boolean) {
  return (
    <>
      <Route index element={<AdminHome />} />
      {showAgencyOnly && <Route path="branches" element={<BranchesPage />} />}
      <Route path="offices" element={<OfficesPage />} />
      <Route path="users" element={<UsersPage />} />
      {showAgencyOnly && <Route path="buses" element={<BusesPage />} />}
      {showAgencyOnly && <Route path="drivers" element={<DriversPage />} />}
      <Route path="destinations" element={<DestinationsPage />} />
      <Route path="visa-types" element={<VisaTypesPage />} />
      <Route path="trips" element={<TripsPage />} />
      <Route path="bookings" element={<AdminBookingsPage />} />
      {showAgencyOnly && <Route path="tracking" element={<AdminTrackingPage />} />}

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
        <Route path="journal-review" element={<AdminJournalReviewPage />} />
      </Route>

      <Route path="reports" element={<AdminReportsPage />} />
      {showAgencyOnly && <Route path="partner-api" element={<PartnerApiPage />} />}
      <Route path="settings" element={<SettingsPage />} />
      <Route path="print-settings" element={<PrintSettingsPage />} />
    </>
  )
}