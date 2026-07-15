/**
 * Local mock accounting API — mimics Cards platform accountingApi
 * without a backend. Persists to localStorage.
 */
import { extractList } from '../utils/apiHelper'

const STORAGE_KEY = 'austul-cards-accounting-v3'
const TICKET_REVENUE_ACCOUNT_ID = 16
const OFFICES_RECEIVABLE_PARENT_CODE = '1131'
const USER_KEY = 'card-platform-user'
const BRANCH = 'الفرع الرئيسي'
const USER = 'مدير النظام'

type AccountLevel = 'رئيسي' | 'فرعي'

export type Account = {
  id: number
  code: string
  name_ar: string
  name_en: string | null
  parent_id: number | null
  account_group_id: number | null
  account_level: AccountLevel
  financial_statement: string | null
  children?: Account[]
  parent_name?: string | null
  group_name?: string | null
  created_at: string
  branch_name: string
  created_by?: string | null
}

type AccountGroup = {
  id: number
  code: string
  name_ar: string
  name_en: string | null
  user_name?: string
  branch?: string
}

type Currency = {
  id: number
  name_ar: string
  code: string
  symbol: string
  exchange_rate: number
  min_rate: number | null
  max_rate: number | null
  is_local: 0 | 1
  convert_mode: '*' | '/'
}

type BankGroup = {
  id: number
  code: string
  name_ar: string
  name_en: string | null
  user_name?: string
  branch?: string
}

type Bank = {
  id: number
  name_ar: string
  name_en: string | null
  code: string
  bank_group_id: number
  bank_group_name: string
  account_id: number
  account_name: string
  user_name: string
  branch_name: string
}

type CashboxGroup = {
  id: number
  code: number
  name_ar: string
  name_en: string | null
  user_name: string | null
  branch_name: string | null
}

type CashBox = {
  id: number
  name_ar: string
  name_en: string | null
  code: string
  cash_box_group_id: number
  cashbox_group_name: string
  account_id: number
  account_name: string
  user_name: string | null
  branch_name: string | null
}

type NamedType = {
  id: number
  code: number
  name_ar: string
  name_en: string | null
  sort_order: number
  branch_name?: string
}

type AccountCeiling = {
  id: number
  scope: 'account' | 'group'
  account_id?: number | null
  account_group_id?: number | null
  account_name?: string
  group_name?: string
  currency_id: number
  currency_name: string
  ceiling_amount: number
  account_type: 'debit' | 'credit'
  limit_action: 'block' | 'allow' | 'warn'
  branch_name?: string
}

type ReceiptVoucher = {
  id: number
  voucher_no: string
  voucher_date: string
  receipt_type: string
  cash_box_account_id: number | null
  bank_account_id: number | null
  transfer_no: string | null
  currency_id: number
  currency_name: string
  amount: number
  account_id: number
  account_name: string
  analytic_account_id: any
  cost_center_id: any
  journal_type_id: number | null
  notes: string | null
  handling: any
  created_by: number
  branch_id: number
  user_name: string
  branch_name: string
  created_at: string
}

type PaymentVoucher = {
  id: number
  voucher_no: string
  voucher_date: string
  payment_type: string
  payment_type_name?: string
  cash_box_account_id: number | null
  bank_account_id: number | null
  transfer_no: string | null
  currency_id: number
  currency_name: string
  amount: number
  account_id: number
  account_name: string
  analytic_account_id: any
  cost_center_id: any
  journal_type_id: number | null
  notes: string | null
  handling: any
  created_by: number
  branch_id: number
  user_name: string
  branch_name: string
  created_at: string
  cash_box_name?: string
  bank_name?: string
}

type JournalLine = {
  id: number
  reference_id: number
  reference_type: string
  journal_date: string
  currency_id: number
  account_id: number
  debit: number
  credit: number
  notes: string | null
  journal_type_id: number
  cost_center_id: number | null
  user_name: string
  branch_name: string
  created_at: string
}

type TransitSettings = {
  office_commissions_account: number | null
  ticket_revenue_account: number | null
}

type Store = {
  accounts: Account[]
  accountGroups: AccountGroup[]
  currencies: Currency[]
  bankGroups: BankGroup[]
  banks: Bank[]
  cashboxGroups: CashboxGroup[]
  cashBoxes: CashBox[]
  receiptTypes: NamedType[]
  paymentTypes: NamedType[]
  journalTypes: NamedType[]
  accountCeilings: AccountCeiling[]
  receiptVouchers: ReceiptVoucher[]
  paymentVouchers: PaymentVoucher[]
  journalEntries: JournalLine[]
  transitAccounts: TransitSettings
  nextIds: Record<string, number>
}

/* ========================= Seed ========================= */

const now = () => new Date().toISOString()

function buildSeed(): Store {
  const groups: AccountGroup[] = [
    { id: 1, code: '1', name_ar: 'الأصول', name_en: 'Assets', user_name: USER, branch: BRANCH },
    { id: 2, code: '2', name_ar: 'الخصوم', name_en: 'Liabilities', user_name: USER, branch: BRANCH },
    { id: 3, code: '3', name_ar: 'حقوق الملكية', name_en: 'Equity', user_name: USER, branch: BRANCH },
    { id: 4, code: '4', name_ar: 'الإيرادات', name_en: 'Revenue', user_name: USER, branch: BRANCH },
    { id: 5, code: '5', name_ar: 'المصروفات', name_en: 'Expenses', user_name: USER, branch: BRANCH },
  ]

  const accounts: Account[] = [
    {
      id: 1, code: '1', name_ar: 'الأصول', name_en: 'Assets', parent_id: null,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: null,
    },
    {
      id: 2, code: '11', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', parent_id: 1,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الأصول',
    },
    {
      id: 3, code: '111', name_ar: 'الصناديق', name_en: 'Cash Boxes', parent_id: 2,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الأصول المتداولة',
    },
    {
      id: 4, code: '11101', name_ar: 'صندوق الصندوق الرئيسي', name_en: 'Main Cash', parent_id: 3,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الصناديق',
    },
    {
      id: 5, code: '11102', name_ar: 'صندوق مكتب صنعاء', name_en: 'Sanaa Cash', parent_id: 3,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الصناديق',
    },
    {
      id: 6, code: '112', name_ar: 'البنوك', name_en: 'Banks', parent_id: 2,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الأصول المتداولة',
    },
    {
      id: 7, code: '11201', name_ar: 'بنك الكريمي', name_en: 'Al-Kuraimi', parent_id: 6,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'البنوك',
    },
    {
      id: 8, code: '11202', name_ar: 'بنك التضامن', name_en: 'Tadhamon', parent_id: 6,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'البنوك',
    },
    {
      id: 9, code: '113', name_ar: 'الذمم المدينة', name_en: 'Receivables', parent_id: 2,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الأصول المتداولة',
    },
    {
      id: 10, code: '11301', name_ar: 'عملاء التذاكر', name_en: 'Ticket Customers', parent_id: 9,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الذمم المدينة',
    },
    {
      id: 11, code: '11302', name_ar: 'حساب وسيط إيرادات', name_en: 'Transit Income', parent_id: 9,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الذمم المدينة',
    },
    {
      id: 12, code: '2', name_ar: 'الخصوم', name_en: 'Liabilities', parent_id: null,
      account_group_id: 2, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الخصوم', parent_name: null,
    },
    {
      id: 13, code: '21', name_ar: 'الذمم الدائنة', name_en: 'Payables', parent_id: 12,
      account_group_id: 2, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الخصوم', parent_name: 'الخصوم',
    },
    {
      id: 14, code: '2101', name_ar: 'موردو الوقود', name_en: 'Fuel Suppliers', parent_id: 13,
      account_group_id: 2, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الخصوم', parent_name: 'الذمم الدائنة',
    },
    {
      id: 15, code: '4', name_ar: 'الإيرادات', name_en: 'Revenue', parent_id: null,
      account_group_id: 4, account_level: 'رئيسي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'الإيرادات', parent_name: null,
    },
    {
      id: 16, code: '41', name_ar: 'إيرادات التذاكر', name_en: 'Ticket Revenue', parent_id: 15,
      account_group_id: 4, account_level: 'فرعي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'الإيرادات', parent_name: 'الإيرادات',
    },
    {
      id: 17, code: '5', name_ar: 'المصروفات', name_en: 'Expenses', parent_id: null,
      account_group_id: 5, account_level: 'رئيسي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'المصروفات', parent_name: null,
    },
    {
      id: 18, code: '51', name_ar: 'مصروف الوقود', name_en: 'Fuel Expense', parent_id: 17,
      account_group_id: 5, account_level: 'فرعي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'المصروفات', parent_name: 'المصروفات',
    },
    {
      id: 19, code: '52', name_ar: 'مصروف الرواتب', name_en: 'Salaries', parent_id: 17,
      account_group_id: 5, account_level: 'فرعي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'المصروفات', parent_name: 'المصروفات',
    },
    {
      id: 21, code: '53', name_ar: 'عمولات المكاتب', name_en: 'Office Commissions', parent_id: 17,
      account_group_id: 5, account_level: 'فرعي', financial_statement: 'أرباح وخسائر',
      created_at: now(), branch_name: BRANCH, group_name: 'المصروفات', parent_name: 'المصروفات',
    },
    {
      id: 20, code: '11303', name_ar: 'حساب مصارفة العملة', name_en: 'FX Account', parent_id: 9,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الذمم المدينة',
    },
    {
      id: 30, code: '1131', name_ar: 'ذمم مكاتب السفريات', name_en: 'Travel Offices Receivables', parent_id: 9,
      account_group_id: 1, account_level: 'رئيسي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الذمم المدينة',
    },
    {
      id: 31, code: '1132', name_ar: 'وسيط إيراد التذاكر', name_en: 'Ticket Revenue Transit', parent_id: 9,
      account_group_id: 1, account_level: 'فرعي', financial_statement: 'الميزانية العمومية',
      created_at: now(), branch_name: BRANCH, group_name: 'الأصول', parent_name: 'الذمم المدينة',
    },
  ]

  const currencies: Currency[] = [
    {
      id: 1, name_ar: 'ريال يمني', code: 'YER', symbol: 'ر.ي',
      exchange_rate: 1, min_rate: 1, max_rate: 1, is_local: 1, convert_mode: '*',
    },
    {
      id: 2, name_ar: 'ريال سعودي', code: 'SAR', symbol: 'ر.س',
      exchange_rate: 140, min_rate: 135, max_rate: 145, is_local: 0, convert_mode: '*',
    },
    {
      id: 3, name_ar: 'دولار أمريكي', code: 'USD', symbol: '$',
      exchange_rate: 530, min_rate: 520, max_rate: 540, is_local: 0, convert_mode: '*',
    },
  ]

  const bankGroups: BankGroup[] = [
    { id: 1, code: '1', name_ar: 'بنوك محلية', name_en: 'Local Banks', user_name: USER, branch: BRANCH },
    { id: 2, code: '2', name_ar: 'بنوك تحويل', name_en: 'Transfer Banks', user_name: USER, branch: BRANCH },
  ]

  const banks: Bank[] = [
    {
      id: 1, name_ar: 'بنك الكريمي', name_en: 'Al-Kuraimi', code: 'BK01',
      bank_group_id: 1, bank_group_name: 'بنوك محلية', account_id: 7,
      account_name: 'بنك الكريمي', user_name: USER, branch_name: BRANCH,
    },
    {
      id: 2, name_ar: 'بنك التضامن', name_en: 'Tadhamon', code: 'BK02',
      bank_group_id: 1, bank_group_name: 'بنوك محلية', account_id: 8,
      account_name: 'بنك التضامن', user_name: USER, branch_name: BRANCH,
    },
  ]

  const cashboxGroups: CashboxGroup[] = [
    { id: 1, code: 1, name_ar: 'صناديق المكاتب', name_en: 'Office Cash', user_name: USER, branch_name: BRANCH },
    { id: 2, code: 2, name_ar: 'صناديق الرحلات', name_en: 'Trip Cash', user_name: USER, branch_name: BRANCH },
  ]

  const cashBoxes: CashBox[] = [
    {
      id: 1, name_ar: 'الصندوق الرئيسي', name_en: 'Main Box', code: 'CB01',
      cash_box_group_id: 1, cashbox_group_name: 'صناديق المكاتب',
      account_id: 4, account_name: 'صندوق الصندوق الرئيسي',
      user_name: USER, branch_name: BRANCH,
    },
  ]

  const receiptTypes: NamedType[] = [
    { id: 1, code: 1, name_ar: 'قبض نقدي', name_en: 'Cash Receipt', sort_order: 1, branch_name: BRANCH },
    { id: 2, code: 2, name_ar: 'قبض بنكي', name_en: 'Bank Receipt', sort_order: 2, branch_name: BRANCH },
  ]

  const paymentTypes: NamedType[] = [
    { id: 1, code: 1, name_ar: 'صرف نقدي', name_en: 'Cash Payment', sort_order: 1, branch_name: BRANCH },
    { id: 2, code: 2, name_ar: 'صرف بنكي', name_en: 'Bank Payment', sort_order: 2, branch_name: BRANCH },
  ]

  const journalTypes: NamedType[] = [
    { id: 1, code: 1, name_ar: 'قيد يومي', name_en: 'Journal', sort_order: 1, branch_name: BRANCH },
    { id: 2, code: 2, name_ar: 'قيد افتتاحي', name_en: 'Opening', sort_order: 2, branch_name: BRANCH },
  ]

  const accountCeilings: AccountCeiling[] = []

  const receiptVouchers: ReceiptVoucher[] = []

  const paymentVouchers: PaymentVoucher[] = []

  const journalEntries: JournalLine[] = []

  const maxId = (...lists: Array<Array<{ id: number }>>) =>
    Math.max(0, ...lists.flatMap((list) => list.map((i) => i.id)))

  return {
    accounts,
    accountGroups: groups,
    currencies,
    bankGroups,
    banks,
    cashboxGroups,
    cashBoxes,
    receiptTypes,
    paymentTypes,
    journalTypes,
    accountCeilings,
    receiptVouchers,
    paymentVouchers,
    journalEntries,
    transitAccounts: {
      office_commissions_account: null,
      ticket_revenue_account: null,
    },
    nextIds: {
      accounts: maxId(accounts) + 1,
      accountGroups: maxId(groups) + 1,
      currencies: maxId(currencies) + 1,
      bankGroups: maxId(bankGroups) + 1,
      banks: maxId(banks) + 1,
      cashboxGroups: maxId(cashboxGroups) + 1,
      cashBoxes: maxId(cashBoxes) + 1,
      receiptTypes: maxId(receiptTypes) + 1,
      paymentTypes: maxId(paymentTypes) + 1,
      journalTypes: maxId(journalTypes) + 1,
      accountCeilings: 1,
      receiptVouchers: 1,
      paymentVouchers: 1,
      journalEntries: 1,
    },
  }
}

/* ========================= Persistence ========================= */

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      if (parsed?.accounts?.length) {
        const t = (parsed.transitAccounts || {}) as Record<string, unknown>
        parsed.transitAccounts = {
          office_commissions_account:
            typeof t.office_commissions_account === 'number'
              ? t.office_commissions_account
              : null,
          ticket_revenue_account:
            typeof t.ticket_revenue_account === 'number' ? t.ticket_revenue_account : null,
        }

        // تأكد ظهور عمولات المكاتب تحت المصروفات في الواجهة
        // لا تلمس 1132 إن كان وسيط إيراد التذاكر
        const expenses = parsed.accounts.find((a) => a.code === '5')
        let commission = parsed.accounts.find(
          (a) =>
            a.code === '53' ||
            a.name_ar === 'عمولات المكاتب' ||
            (a.code === '1132' && a.name_ar === 'عمولات المكاتب'),
        )

        // وسيط إيراد التذاكر إن لم يوجد
        const receivables = parsed.accounts.find((a) => a.code === '113')
        const ticketTransit = parsed.accounts.find(
          (a) => a.code === '1132' || a.name_ar === 'وسيط إيراد التذاكر',
        )
        if (!ticketTransit && receivables) {
          const id = Math.max(0, ...parsed.accounts.map((a) => a.id)) + 1
          parsed.accounts.push({
            id,
            code: '1132',
            name_ar: 'وسيط إيراد التذاكر',
            name_en: 'Ticket Revenue Transit',
            parent_id: receivables.id,
            account_group_id: 1,
            account_level: 'فرعي',
            financial_statement: 'الميزانية العمومية',
            created_at: now(),
            branch_name: BRANCH,
            group_name: 'الأصول',
            parent_name: receivables.name_ar,
          })
        }
        if (commission && expenses) {
          commission = {
            ...commission,
            code: '53',
            name_ar: 'عمولات المكاتب',
            name_en: 'Office Commissions',
            parent_id: expenses.id,
            account_level: 'فرعي',
            financial_statement: 'أرباح وخسائر',
            group_name: 'المصروفات',
            parent_name: 'المصروفات',
            account_group_id: 5,
          }
          parsed.accounts = parsed.accounts.map((a) => (a.id === commission!.id ? commission! : a))
        } else if (!commission && expenses) {
          const id = Math.max(0, ...parsed.accounts.map((a) => a.id)) + 1
          parsed.accounts.push({
            id,
            code: '53',
            name_ar: 'عمولات المكاتب',
            name_en: 'Office Commissions',
            parent_id: expenses.id,
            account_group_id: 5,
            account_level: 'فرعي',
            financial_statement: 'أرباح وخسائر',
            created_at: now(),
            branch_name: BRANCH,
            group_name: 'المصروفات',
            parent_name: 'المصروفات',
          })
        }

        saveStore(parsed)
        return parsed
      }
    }
  } catch { /* ignore */ }
  const seed = buildSeed()
  saveStore(seed)
  return seed
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

let store = loadStore()

function persist() {
  saveStore(store)
}

function nextId(key: keyof Store['nextIds']): number {
  const id = store.nextIds[key] ?? 1
  store.nextIds[key] = id + 1
  return id
}

function ok(data: Record<string, any> = {}) {
  return { success: true, ...data }
}

function fail(message: string): never {
  const err: Error & { response?: { data: { success: false; message: string } } } = new Error(message)
  err.response = { data: { success: false, message } }
  throw err
}

function matchSearch(hay: string | null | undefined, q: string) {
  if (!q) return true
  return String(hay || '').toLowerCase().includes(q.toLowerCase())
}

function enrichAccount(a: Account): Account {
  const parent = store.accounts.find((x) => x.id === a.parent_id)
  const group = store.accountGroups.find((x) => x.id === a.account_group_id)
  return {
    ...a,
    parent_name: parent?.name_ar ?? null,
    group_name: group?.name_ar ?? null,
  }
}

function buildAccountTree(list: Account[]): Account[] {
  const map = new Map<number, Account>()
  list.forEach((a) => map.set(a.id, { ...enrichAccount(a), children: [] }))
  const roots: Account[] = []
  map.forEach((node) => {
    if (node.parent_id != null && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function nextAccountCode(parentId: number | null): string {
  if (parentId == null) {
    const roots = store.accounts.filter((a) => a.parent_id == null)
    return String(roots.length + 1)
  }
  const parent = store.accounts.find((a) => a.id === parentId)
  const siblings = store.accounts.filter((a) => a.parent_id === parentId)
  const seq = String(siblings.length + 1).padStart(2, '0')
  return `${parent?.code || ''}${seq}`
}

function accountName(id: number | null | undefined) {
  if (!id) return ''
  return store.accounts.find((a) => a.id === id)?.name_ar || ''
}

function currencyName(id: number | null | undefined) {
  if (!id) return ''
  return store.currencies.find((c) => c.id === id)?.name_ar || ''
}

function parseQuery(url: string): { path: string; params: Record<string, string> } {
  const [pathPart, qs] = url.split('?')
  const path = pathPart.replace(/^\/api/, '').replace(/\/$/, '') || '/'
  const params: Record<string, string> = {}
  if (qs) {
    new URLSearchParams(qs).forEach((v, k) => {
      params[k] = v
    })
  }
  return { path: path.startsWith('/') ? path : `/${path}`, params }
}

function mergeParams(
  url: string,
  config?: { params?: Record<string, any> }
): { path: string; params: Record<string, string> } {
  const parsed = parseQuery(url)
  if (config?.params) {
    Object.entries(config.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) parsed.params[k] = String(v)
    })
  }
  return parsed
}

/* ========================= Route handlers ========================= */

function handleGet(url: string, config?: { params?: Record<string, any> }): any {
  const { path, params } = mergeParams(url, config)
  const search = params.search || ''

  // Accounts
  if (path === '/accounts') {
    const list = store.accounts.map(enrichAccount)
    return ok({ tree: buildAccountTree(list), list })
  }
  if (path === '/accounts/main-for-cashboxes') {
    const accounts = store.accounts
      .filter((a) => a.account_level === 'رئيسي' && /صندوق|نقد|أصول|متداول/i.test(a.name_ar + (a.name_en || '')))
    const fallback = store.accounts.filter((a) => a.account_level === 'رئيسي')
    return ok({ accounts: (accounts.length ? accounts : fallback).map(enrichAccount) })
  }
  if (path === '/accounts/main-for-banks') {
    const accounts = store.accounts
      .filter((a) => a.account_level === 'رئيسي' && /بنك|أصول|متداول/i.test(a.name_ar + (a.name_en || '')))
    const fallback = store.accounts.filter((a) => a.account_level === 'رئيسي')
    return ok({ accounts: (accounts.length ? accounts : fallback).map(enrichAccount) })
  }
  if (path === '/accounts/sub-for-ceiling') {
    const parentIds = new Set(
      store.accounts.map((a) => a.parent_id).filter((id): id is number => id != null),
    )
    const list = store.accounts
      .filter(
        (a) =>
          a.account_level === 'فرعي' ||
          (a.parent_id != null && !parentIds.has(a.id)),
      )
      .map((a) => {
        if (a.account_level !== 'فرعي' && a.parent_id != null && !parentIds.has(a.id)) {
          a.account_level = 'فرعي'
        }
        return enrichAccount(a)
      })
    persist()
    return ok({ list, accounts: list })
  }

  // Account groups
  if (path === '/account-groups') {
    const groups = store.accountGroups.filter(
      (g) => matchSearch(g.name_ar, search) || matchSearch(g.code, search) || matchSearch(g.name_en, search)
    )
    return ok({ groups, list: groups })
  }
  {
    const m = path.match(/^\/account-groups\/(\d+)$/)
    if (m) {
      const g = store.accountGroups.find((x) => x.id === Number(m[1]))
      if (!g) fail('المجموعة غير موجودة')
      return ok({ group: g })
    }
  }

  // Currencies
  if (path === '/currencies') {
    return ok({ currencies: store.currencies, list: store.currencies })
  }

  // Bank groups
  if (path === '/bank-groups/next-code') {
    const maxCode = store.bankGroups.reduce((m, g) => Math.max(m, Number(g.code) || 0), 0)
    return ok({ nextCode: String(maxCode + 1) })
  }
  if (path === '/bank-groups') {
    const groups = store.bankGroups.filter(
      (g) => matchSearch(g.name_ar, search) || matchSearch(g.code, search) || matchSearch(g.name_en, search)
    )
    return ok({ groups, list: groups })
  }
  {
    const m = path.match(/^\/bank-groups\/(\d+)$/)
    if (m) {
      const g = store.bankGroups.find((x) => x.id === Number(m[1]))
      if (!g) fail('مجموعة البنك غير موجودة')
      return ok({ group: g })
    }
  }

  // Banks
  if (path === '/banks') {
    const banks = store.banks.filter(
      (b) =>
        matchSearch(b.name_ar, search) ||
        matchSearch(b.code, search) ||
        matchSearch(b.bank_group_name, search)
    )
    return ok({ banks, list: banks })
  }

  // Cashbox groups
  if (path === '/cashbox-groups') {
    const groups = store.cashboxGroups.filter(
      (g) => matchSearch(g.name_ar, search) || matchSearch(String(g.code), search)
    )
    return ok({ groups, list: groups })
  }

  // Cash boxes
  if (path === '/cash-boxes') {
    const list = store.cashBoxes.filter(
      (c) =>
        matchSearch(c.name_ar, search) ||
        matchSearch(c.code, search) ||
        matchSearch(c.cashbox_group_name, search)
    )
    return ok({ list, cashBoxes: list })
  }

  // Types
  if (path === '/receipt-types') {
    const list = store.receiptTypes.filter((r) => matchSearch(r.name_ar, search))
    return ok({ list })
  }
  if (path === '/payment-types') {
    const list = store.paymentTypes.filter((r) => matchSearch(r.name_ar, search))
    return ok({ list })
  }
  if (path === '/journal-types') {
    const list = store.journalTypes.filter((r) => matchSearch(r.name_ar, search))
    return ok({ list, journalTypes: list })
  }

  // Ceilings
  if (path === '/account-ceilings') {
    return ok({ list: store.accountCeilings })
  }

  // Vouchers
  if (path === '/receipt-vouchers') {
    return ok({ list: store.receiptVouchers })
  }
  if (path === '/payment-vouchers') {
    return ok({ list: store.paymentVouchers })
  }

  // Journal entries (aggregated pairs for UI table)
  if (path === '/journal-entries') {
    const byRef = new Map<number, JournalLine[]>()
    store.journalEntries.forEach((line) => {
      const arr = byRef.get(line.reference_id) || []
      arr.push(line)
      byRef.set(line.reference_id, arr)
    })
    const list = Array.from(byRef.entries()).map(([ref, lines]) => {
      const debitLine = lines.find((l) => l.debit > 0) || lines[0]
      const creditLine = lines.find((l) => l.credit > 0) || lines[1] || lines[0]
      const cur = store.currencies.find((c) => c.id === debitLine.currency_id)
      return {
        id: debitLine.id,
        reference_id: ref,
        reference_type: debitLine.reference_type,
        journal_date: debitLine.journal_date,
        amount: debitLine.debit || creditLine.credit || 0,
        currency_name: cur?.name_ar || '',
        from_account: accountName(debitLine.account_id),
        to_account: accountName(creditLine.account_id),
        notes: debitLine.notes || '',
        user_name: debitLine.user_name,
        branch_name: debitLine.branch_name,
      }
    }).sort((a, b) => String(b.journal_date).localeCompare(String(a.journal_date)))
    return ok({ list })
  }

  // Currency exchange form-data
  if (path === '/currency-exchange/form-data') {
    return ok({
      currencies: store.currencies,
      accounts: store.accounts.filter(
        (a) =>
          a.account_level === 'فرعي' ||
          (a.parent_id != null && !store.accounts.some((x) => x.parent_id === a.id)),
      ),
      cashBoxes: store.cashBoxes,
      type: params.type || '',
    })
  }

  // Transit settings
  if (path === '/settings/transit-accounts') {
    return ok({ data: store.transitAccounts })
  }

  fail(`GET غير مدعوم: ${path}`)
}

function handlePost(url: string, body: any = {}): any {
  const { path } = parseQuery(url)

  if (path === '/accounts') {
    const id = nextId('accounts')
    const parent_id = body.parent_id ?? null
    const group = store.accountGroups.find((g) => g.id === Number(body.account_group_id))
    const acc: Account = {
      id,
      code: body.code || nextAccountCode(parent_id),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      parent_id,
      account_group_id: body.account_group_id ?? null,
      account_level: body.account_level || (parent_id ? 'فرعي' : 'رئيسي'),
      financial_statement: body.financial_statement ?? 'الميزانية العمومية',
      created_at: now(),
      branch_name: BRANCH,
      group_name: group?.name_ar ?? null,
      parent_name: accountName(parent_id) || null,
      created_by: USER,
    }
    store.accounts.push(acc)
    persist()
    return ok({ account: enrichAccount(acc) })
  }

  if (path === '/account-groups') {
    const id = nextId('accountGroups')
    const g: AccountGroup = {
      id,
      code: body.code || String(id),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      user_name: USER,
      branch: BRANCH,
    }
    store.accountGroups.push(g)
    persist()
    return ok({ group: g })
  }

  if (path === '/currencies') {
    const id = nextId('currencies')
    const c: Currency = {
      id,
      name_ar: body.name_ar,
      code: body.code,
      symbol: body.symbol || body.code,
      exchange_rate: Number(body.exchange_rate) || 1,
      min_rate: body.min_rate != null ? Number(body.min_rate) : null,
      max_rate: body.max_rate != null ? Number(body.max_rate) : null,
      is_local: body.is_local === true || body.is_local === 1 ? 1 : 0,
      convert_mode: body.convert_mode === '/' ? '/' : '*',
    }
    if (c.is_local === 1) {
      store.currencies.forEach((x) => { x.is_local = 0 })
    }
    store.currencies.push(c)
    persist()
    return ok({ currency: c })
  }

  if (path === '/bank-groups') {
    const id = nextId('bankGroups')
    const g: BankGroup = {
      id,
      code: body.code || String(id),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      user_name: USER,
      branch: BRANCH,
    }
    store.bankGroups.push(g)
    persist()
    return ok({ group: g })
  }

  if (path === '/banks') {
    const group = store.bankGroups.find((g) => g.id === Number(body.bank_group_id))
    if (!group) fail('مجموعة البنك مطلوبة')
    const parentId = Number(body.parent_account_id)
    const accId = nextId('accounts')
    const code = nextAccountCode(parentId)
    const account: Account = {
      id: accId,
      code,
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      parent_id: parentId,
      account_group_id: 1,
      account_level: 'فرعي',
      financial_statement: 'الميزانية العمومية',
      created_at: now(),
      branch_name: BRANCH,
      group_name: 'الأصول',
      parent_name: accountName(parentId),
    }
    store.accounts.push(account)
    const bank: Bank = {
      id: nextId('banks'),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      code: body.code || `BK${String(store.banks.length + 1).padStart(2, '0')}`,
      bank_group_id: group.id,
      bank_group_name: group.name_ar,
      account_id: accId,
      account_name: body.name_ar,
      user_name: USER,
      branch_name: BRANCH,
    }
    store.banks.push(bank)
    persist()
    return ok({ bank })
  }

  if (path === '/cashbox-groups') {
    const g: CashboxGroup = {
      id: nextId('cashboxGroups'),
      code: Number(body.code) || store.cashboxGroups.length + 1,
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      user_name: USER,
      branch_name: BRANCH,
    }
    store.cashboxGroups.push(g)
    persist()
    return ok({ group: g })
  }

  if (path === '/cash-boxes') {
    const group = store.cashboxGroups.find((g) => g.id === Number(body.cash_box_group_id))
    if (!group) fail('مجموعة الصندوق مطلوبة')
    const parentId = Number(body.parent_account_id)
    const accId = nextId('accounts')
    const account: Account = {
      id: accId,
      code: nextAccountCode(parentId),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      parent_id: parentId,
      account_group_id: 1,
      account_level: 'فرعي',
      financial_statement: 'الميزانية العمومية',
      created_at: now(),
      branch_name: BRANCH,
      group_name: 'الأصول',
      parent_name: accountName(parentId),
    }
    store.accounts.push(account)
    const box: CashBox = {
      id: nextId('cashBoxes'),
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      code: body.code || `CB${String(store.cashBoxes.length + 1).padStart(2, '0')}`,
      cash_box_group_id: group.id,
      cashbox_group_name: group.name_ar,
      account_id: accId,
      account_name: body.name_ar,
      user_name: USER,
      branch_name: BRANCH,
    }
    store.cashBoxes.push(box)
    persist()
    return ok({ cashBox: box })
  }

  if (path === '/receipt-types') {
    const maxCode = store.receiptTypes.reduce((m, r) => Math.max(m, r.code), 0)
    const row: NamedType = {
      id: nextId('receiptTypes'),
      code: body.code != null ? Number(body.code) : maxCode + 1,
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      sort_order: body.sort_order != null ? Number(body.sort_order) : maxCode + 1,
      branch_name: BRANCH,
    }
    store.receiptTypes.push(row)
    persist()
    return ok({ item: row })
  }

  if (path === '/payment-types') {
    const maxCode = store.paymentTypes.reduce((m, r) => Math.max(m, r.code), 0)
    const row: NamedType = {
      id: nextId('paymentTypes'),
      code: body.code != null ? Number(body.code) : maxCode + 1,
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      sort_order: body.sort_order != null ? Number(body.sort_order) : maxCode + 1,
      branch_name: BRANCH,
    }
    store.paymentTypes.push(row)
    persist()
    return ok({ item: row })
  }

  if (path === '/journal-types') {
    const maxCode = store.journalTypes.reduce((m, r) => Math.max(m, r.code), 0)
    const row: NamedType = {
      id: nextId('journalTypes'),
      code: body.code != null ? Number(body.code) : maxCode + 1,
      name_ar: body.name_ar,
      name_en: body.name_en ?? null,
      sort_order: body.sort_order != null ? Number(body.sort_order) : maxCode + 1,
      branch_name: BRANCH,
    }
    store.journalTypes.push(row)
    persist()
    return ok({ item: row })
  }

  if (path === '/account-ceilings') {
    const cur = store.currencies.find((c) => c.id === Number(body.currency_id))
    const ceiling: AccountCeiling = {
      id: nextId('accountCeilings'),
      scope: body.scope || 'account',
      account_id: body.account_id ?? null,
      account_group_id: body.account_group_id ?? null,
      account_name: body.account_id ? accountName(Number(body.account_id)) : undefined,
      group_name: body.account_group_id
        ? store.accountGroups.find((g) => g.id === Number(body.account_group_id))?.name_ar
        : undefined,
      currency_id: Number(body.currency_id),
      currency_name: cur?.name_ar || '',
      ceiling_amount: Number(body.ceiling_amount) || 0,
      account_type: (body.account_nature || body.account_type || 'debit') as 'debit' | 'credit',
      limit_action: (body.exceed_action || body.limit_action || 'block') as 'block' | 'allow' | 'warn',
      branch_name: BRANCH,
    }
    store.accountCeilings.push(ceiling)
    persist()
    return ok({ ceiling })
  }

  if (path === '/receipt-vouchers') {
    const id = nextId('receiptVouchers')
    const v: ReceiptVoucher = {
      id,
      voucher_no: body.voucher_no || `RV-${1000 + id}`,
      voucher_date: body.voucher_date?.includes('T')
        ? body.voucher_date
        : `${body.voucher_date || new Date().toLocaleDateString('en-CA')}T00:00:00.000Z`,
      receipt_type: body.receipt_type,
      cash_box_account_id: body.cash_box_account_id ?? null,
      bank_account_id: body.bank_account_id ?? null,
      transfer_no: body.transfer_no ?? null,
      currency_id: Number(body.currency_id),
      currency_name: currencyName(Number(body.currency_id)),
      amount: Number(body.amount),
      account_id: Number(body.account_id),
      account_name: accountName(Number(body.account_id)),
      analytic_account_id: body.analytic_account_id ?? null,
      cost_center_id: body.cost_center_id ?? null,
      journal_type_id: body.journal_type_id ?? null,
      notes: body.notes ?? null,
      handling: body.handling ?? 0,
      created_by: body.created_by || 1,
      branch_id: body.branch_id || 1,
      user_name: USER,
      branch_name: BRANCH,
      created_at: now(),
    }
    store.receiptVouchers.push(v)
    // journal side-effect
    const cashOrBankAcc =
      v.receipt_type === 'cash'
        ? store.cashBoxes.find((c) => c.id === v.cash_box_account_id)?.account_id
        : store.banks.find((b) => b.id === v.bank_account_id)?.account_id
    if (cashOrBankAcc && v.account_id) {
      const ref = Date.now()
      store.journalEntries.push({
        id: nextId('journalEntries'), reference_id: ref, reference_type: 'receipt',
        journal_date: v.voucher_date.slice(0, 10), currency_id: v.currency_id,
        account_id: cashOrBankAcc, debit: v.amount, credit: 0, notes: v.notes,
        journal_type_id: v.journal_type_id || 1, cost_center_id: null,
        user_name: USER, branch_name: BRANCH, created_at: now(),
      })
      store.journalEntries.push({
        id: nextId('journalEntries'), reference_id: ref, reference_type: 'receipt',
        journal_date: v.voucher_date.slice(0, 10), currency_id: v.currency_id,
        account_id: v.account_id, debit: 0, credit: v.amount, notes: v.notes,
        journal_type_id: v.journal_type_id || 1, cost_center_id: null,
        user_name: USER, branch_name: BRANCH, created_at: now(),
      })
    }
    persist()
    return ok({ voucher: v })
  }

  if (path === '/payment-vouchers') {
    const id = nextId('paymentVouchers')
    const cashBox = store.cashBoxes.find((c) => c.id === Number(body.cash_box_account_id))
    const bank = store.banks.find((b) => b.id === Number(body.bank_account_id))
    const v: PaymentVoucher = {
      id,
      voucher_no: body.voucher_no || `PV-${2000 + id}`,
      voucher_date: body.voucher_date?.includes('T')
        ? body.voucher_date
        : `${body.voucher_date || new Date().toLocaleDateString('en-CA')}T00:00:00.000Z`,
      payment_type: body.payment_type,
      payment_type_name: body.payment_type === 'cash' ? 'صرف نقدي' : 'صرف بنكي',
      cash_box_account_id: body.cash_box_account_id ?? null,
      bank_account_id: body.bank_account_id ?? null,
      transfer_no: body.transfer_no ?? null,
      currency_id: Number(body.currency_id),
      currency_name: currencyName(Number(body.currency_id)),
      amount: Number(body.amount),
      account_id: Number(body.account_id),
      account_name: accountName(Number(body.account_id)),
      analytic_account_id: body.analytic_account_id ?? null,
      cost_center_id: body.cost_center_id ?? null,
      journal_type_id: body.journal_type_id ?? 1,
      notes: body.notes ?? null,
      handling: body.handling ?? null,
      created_by: body.created_by || 1,
      branch_id: body.branch_id || 1,
      user_name: USER,
      branch_name: BRANCH,
      created_at: now(),
      cash_box_name: cashBox?.name_ar,
      bank_name: bank?.name_ar,
    }
    store.paymentVouchers.push(v)
    const cashOrBankAcc =
      v.payment_type === 'cash' ? cashBox?.account_id : bank?.account_id
    if (cashOrBankAcc && v.account_id) {
      const ref = Date.now()
      store.journalEntries.push({
        id: nextId('journalEntries'), reference_id: ref, reference_type: 'payment',
        journal_date: v.voucher_date.slice(0, 10), currency_id: v.currency_id,
        account_id: v.account_id, debit: v.amount, credit: 0, notes: v.notes,
        journal_type_id: v.journal_type_id || 1, cost_center_id: null,
        user_name: USER, branch_name: BRANCH, created_at: now(),
      })
      store.journalEntries.push({
        id: nextId('journalEntries'), reference_id: ref, reference_type: 'payment',
        journal_date: v.voucher_date.slice(0, 10), currency_id: v.currency_id,
        account_id: cashOrBankAcc, debit: 0, credit: v.amount, notes: v.notes,
        journal_type_id: v.journal_type_id || 1, cost_center_id: null,
        user_name: USER, branch_name: BRANCH, created_at: now(),
      })
    }
    persist()
    return ok({ voucher: v })
  }

  if (path === '/journal-entries') {
    const line: JournalLine = {
      id: nextId('journalEntries'),
      reference_id: Number(body.reference_id) || Date.now(),
      reference_type: body.reference_type || 'manual',
      journal_date: body.journal_date || new Date().toLocaleDateString('en-CA'),
      currency_id: Number(body.currency_id) || 1,
      account_id: Number(body.account_id),
      debit: Number(body.debit) || 0,
      credit: Number(body.credit) || 0,
      notes: body.notes ?? null,
      journal_type_id: Number(body.journal_type_id) || 1,
      cost_center_id: body.cost_center_id ?? null,
      user_name: USER,
      branch_name: BRANCH,
      created_at: now(),
    }
    store.journalEntries.push(line)
    persist()
    return ok({ entry: line })
  }

  if (path === '/reports/account-statement') {
    const accountId = body.account_id ? Number(body.account_id) : null
    const mainAccountId = body.main_account_id ? Number(body.main_account_id) : null
    const currencyId = body.currency_id ? Number(body.currency_id) : null
    const fromDate = body.from_date as string | null
    const toDate = body.to_date as string | null

    let accountIds: number[] | null = null
    if (accountId) {
      accountIds = [accountId]
    } else if (mainAccountId) {
      const collect = (pid: number): number[] => {
        const kids = store.accounts.filter((a) => a.parent_id === pid)
        return [pid, ...kids.flatMap((k) => collect(k.id))]
      }
      accountIds = collect(mainAccountId)
    }

    let lines = [...store.journalEntries]
    if (accountIds) lines = lines.filter((l) => accountIds!.includes(l.account_id))
    if (currencyId) lines = lines.filter((l) => l.currency_id === currencyId)
    if (fromDate) lines = lines.filter((l) => l.journal_date >= fromDate)
    if (toDate) lines = lines.filter((l) => l.journal_date <= toDate)
    lines.sort((a, b) => a.journal_date.localeCompare(b.journal_date) || a.id - b.id)

    let balance = 0
    // opening balance (before fromDate)
    if (fromDate) {
      let opening = 0
      store.journalEntries.forEach((l) => {
        if (accountIds && !accountIds.includes(l.account_id)) return
        if (currencyId && l.currency_id !== currencyId) return
        if (l.journal_date >= fromDate) return
        opening += l.debit - l.credit
      })
      balance = opening
    }

    const list: any[] = []
    if (body.detailed_type !== 'no_open' && fromDate) {
      list.push({
        id: 0,
        journal_date: fromDate,
        account_name: 'رصيد سابق',
        debit: 0,
        credit: 0,
        balance,
        notes: '',
        reference_type: 'opening',
        reference_id: null,
        is_opening: true,
        currency_name: currencyId ? currencyName(currencyId) : '',
        currency_id: currencyId,
      })
    }

    lines.forEach((l) => {
      balance += l.debit - l.credit
      list.push({
        id: l.id,
        journal_date: l.journal_date,
        account_name: accountName(l.account_id),
        debit: l.debit,
        credit: l.credit,
        balance,
        notes: l.notes || '',
        reference_type: l.reference_type,
        reference_id: l.reference_id,
        currency_name: currencyName(l.currency_id),
        currency_id: l.currency_id,
      })
    })

    return ok({ list })
  }

  if (path === '/currency-exchange') {
    const ref = Number(body.reference) || Date.now()
    const fromAcc = Number(body.from_account)
    const toAcc = Number(body.to_account)
    const fromAmt = Number(body.from_amount) || 0
    const toAmt = Number(body.to_amount) || fromAmt
    const date = body.date || new Date().toLocaleDateString('en-CA')
    const notes = body.notes || (body.type === 'buy' ? 'شراء عملة' : 'بيع عملة')
    store.journalEntries.push({
      id: nextId('journalEntries'), reference_id: ref, reference_type: 'currency_exchange',
      journal_date: date, currency_id: Number(body.from_currency) || 1,
      account_id: fromAcc, debit: 0, credit: fromAmt, notes,
      journal_type_id: 1, cost_center_id: null, user_name: USER, branch_name: BRANCH, created_at: now(),
    })
    store.journalEntries.push({
      id: nextId('journalEntries'), reference_id: ref, reference_type: 'currency_exchange',
      journal_date: date, currency_id: Number(body.to_currency) || 1,
      account_id: toAcc, debit: toAmt, credit: 0, notes,
      journal_type_id: 1, cost_center_id: null, user_name: USER, branch_name: BRANCH, created_at: now(),
    })
    persist()
    return ok({ reference: ref })
  }

  if (path === '/settings/transit-accounts') {
    store.transitAccounts = {
      office_commissions_account:
        body.office_commissions_account !== undefined
          ? body.office_commissions_account
          : store.transitAccounts.office_commissions_account,
      ticket_revenue_account:
        body.ticket_revenue_account !== undefined
          ? body.ticket_revenue_account
          : store.transitAccounts.ticket_revenue_account,
    }
    persist()
    return ok({ data: store.transitAccounts })
  }

  fail(`POST غير مدعوم: ${path}`)
}

function handlePut(url: string, body: any = {}): any {
  const { path } = parseQuery(url)

  let m = path.match(/^\/accounts\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.accounts.findIndex((a) => a.id === id)
    if (idx < 0) fail('الحساب غير موجود')
    const prev = store.accounts[idx]
    store.accounts[idx] = enrichAccount({
      ...prev,
      name_ar: body.name_ar ?? prev.name_ar,
      name_en: body.name_en !== undefined ? body.name_en : prev.name_en,
      parent_id: body.parent_id !== undefined ? body.parent_id : prev.parent_id,
      account_group_id: body.account_group_id !== undefined ? body.account_group_id : prev.account_group_id,
      account_level: body.account_level ?? prev.account_level,
      financial_statement: body.financial_statement !== undefined ? body.financial_statement : prev.financial_statement,
    })
    persist()
    return ok({ account: store.accounts[idx] })
  }

  m = path.match(/^\/account-groups\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.accountGroups.findIndex((g) => g.id === id)
    if (idx < 0) fail('المجموعة غير موجودة')
    store.accountGroups[idx] = { ...store.accountGroups[idx], ...body, id }
    persist()
    return ok({ group: store.accountGroups[idx] })
  }

  m = path.match(/^\/currencies\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.currencies.findIndex((c) => c.id === id)
    if (idx < 0) fail('العملة غير موجودة')
    const isLocal = body.is_local === true || body.is_local === 1 ? 1 : body.is_local === false || body.is_local === 0 ? 0 : store.currencies[idx].is_local
    if (isLocal === 1) store.currencies.forEach((c) => { c.is_local = 0 })
    store.currencies[idx] = {
      ...store.currencies[idx],
      name_ar: body.name_ar ?? store.currencies[idx].name_ar,
      code: body.code ?? store.currencies[idx].code,
      symbol: body.symbol ?? store.currencies[idx].symbol,
      exchange_rate: body.exchange_rate != null ? Number(body.exchange_rate) : store.currencies[idx].exchange_rate,
      min_rate: body.min_rate !== undefined ? (body.min_rate != null ? Number(body.min_rate) : null) : store.currencies[idx].min_rate,
      max_rate: body.max_rate !== undefined ? (body.max_rate != null ? Number(body.max_rate) : null) : store.currencies[idx].max_rate,
      is_local: isLocal as 0 | 1,
      convert_mode: body.convert_mode === '/' ? '/' : body.convert_mode === '*' ? '*' : store.currencies[idx].convert_mode,
    }
    persist()
    return ok({ currency: store.currencies[idx] })
  }

  m = path.match(/^\/bank-groups\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.bankGroups.findIndex((g) => g.id === id)
    if (idx < 0) fail('مجموعة البنك غير موجودة')
    store.bankGroups[idx] = { ...store.bankGroups[idx], ...body, id }
    persist()
    return ok({ group: store.bankGroups[idx] })
  }

  m = path.match(/^\/cashbox-groups\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.cashboxGroups.findIndex((g) => g.id === id)
    if (idx < 0) fail('المجموعة غير موجودة')
    store.cashboxGroups[idx] = {
      ...store.cashboxGroups[idx],
      name_ar: body.name_ar ?? store.cashboxGroups[idx].name_ar,
      name_en: body.name_en !== undefined ? body.name_en : store.cashboxGroups[idx].name_en,
    }
    persist()
    return ok({ group: store.cashboxGroups[idx] })
  }

  m = path.match(/^\/cash-boxes\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.cashBoxes.findIndex((c) => c.id === id)
    if (idx < 0) fail('الصندوق غير موجود')
    const group = body.cash_box_group_id
      ? store.cashboxGroups.find((g) => g.id === Number(body.cash_box_group_id))
      : null
    store.cashBoxes[idx] = {
      ...store.cashBoxes[idx],
      name_ar: body.name_ar ?? store.cashBoxes[idx].name_ar,
      name_en: body.name_en !== undefined ? body.name_en : store.cashBoxes[idx].name_en,
      cash_box_group_id: group ? group.id : store.cashBoxes[idx].cash_box_group_id,
      cashbox_group_name: group ? group.name_ar : store.cashBoxes[idx].cashbox_group_name,
    }
    persist()
    return ok({ cashBox: store.cashBoxes[idx] })
  }

  for (const key of ['receipt-types', 'payment-types', 'journal-types'] as const) {
    m = path.match(new RegExp(`^\\/${key}\\/(\\d+)$`))
    if (m) {
      const storeKey =
        key === 'receipt-types' ? 'receiptTypes' : key === 'payment-types' ? 'paymentTypes' : 'journalTypes'
      const id = Number(m[1])
      const list = store[storeKey]
      const idx = list.findIndex((r) => r.id === id)
      if (idx < 0) fail('العنصر غير موجود')
      list[idx] = {
        ...list[idx],
        name_ar: body.name_ar ?? list[idx].name_ar,
        name_en: body.name_en !== undefined ? body.name_en : list[idx].name_en,
        sort_order: body.sort_order != null ? Number(body.sort_order) : list[idx].sort_order,
      }
      persist()
      return ok({ item: list[idx] })
    }
  }

  m = path.match(/^\/account-ceilings\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.accountCeilings.findIndex((c) => c.id === id)
    if (idx < 0) fail('التسقيف غير موجود')
    const cur = body.currency_id
      ? store.currencies.find((c) => c.id === Number(body.currency_id))
      : null
    store.accountCeilings[idx] = {
      ...store.accountCeilings[idx],
      currency_id: body.currency_id != null ? Number(body.currency_id) : store.accountCeilings[idx].currency_id,
      currency_name: cur?.name_ar || store.accountCeilings[idx].currency_name,
      ceiling_amount: body.ceiling_amount != null ? Number(body.ceiling_amount) : store.accountCeilings[idx].ceiling_amount,
      account_type: (body.account_nature || body.account_type || store.accountCeilings[idx].account_type) as any,
      limit_action: (body.exceed_action || body.limit_action || store.accountCeilings[idx].limit_action) as any,
    }
    persist()
    return ok({ ceiling: store.accountCeilings[idx] })
  }

  m = path.match(/^\/receipt-vouchers\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.receiptVouchers.findIndex((v) => v.id === id)
    if (idx < 0) fail('السند غير موجود')
    const prev = store.receiptVouchers[idx]
    store.receiptVouchers[idx] = {
      ...prev,
      ...body,
      id,
      currency_name: body.currency_id ? currencyName(Number(body.currency_id)) : prev.currency_name,
      account_name: body.account_id ? accountName(Number(body.account_id)) : prev.account_name,
      voucher_date: body.voucher_date
        ? (body.voucher_date.includes('T') ? body.voucher_date : `${body.voucher_date}T00:00:00.000Z`)
        : prev.voucher_date,
    }
    persist()
    return ok({ voucher: store.receiptVouchers[idx] })
  }

  m = path.match(/^\/payment-vouchers\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.paymentVouchers.findIndex((v) => v.id === id)
    if (idx < 0) fail('السند غير موجود')
    const prev = store.paymentVouchers[idx]
    store.paymentVouchers[idx] = {
      ...prev,
      ...body,
      id,
      currency_name: body.currency_id ? currencyName(Number(body.currency_id)) : prev.currency_name,
      account_name: body.account_id ? accountName(Number(body.account_id)) : prev.account_name,
      voucher_date: body.voucher_date
        ? (body.voucher_date.includes('T') ? body.voucher_date : `${body.voucher_date}T00:00:00.000Z`)
        : prev.voucher_date,
    }
    persist()
    return ok({ voucher: store.paymentVouchers[idx] })
  }

  m = path.match(/^\/journal-entries\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    const idx = store.journalEntries.findIndex((e) => e.id === id)
    if (idx < 0) fail('القيد غير موجود')
    store.journalEntries[idx] = { ...store.journalEntries[idx], ...body, id }
    persist()
    return ok({ entry: store.journalEntries[idx] })
  }

  fail(`PUT غير مدعوم: ${path}`)
}

function handleDelete(url: string): any {
  const { path } = parseQuery(url)

  const delById = <T extends { id: number }>(list: T[], id: number, label: string) => {
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) fail(`${label} غير موجود`)
    list.splice(idx, 1)
    persist()
    return ok()
  }

  let m = path.match(/^\/accounts\/(\d+)$/)
  if (m) {
    const id = Number(m[1])
    if (store.accounts.some((a) => a.parent_id === id)) fail('لا يمكن حذف حساب له حسابات فرعية')
    return delById(store.accounts, id, 'الحساب')
  }

  m = path.match(/^\/account-groups\/(\d+)$/)
  if (m) return delById(store.accountGroups, Number(m[1]), 'المجموعة')

  m = path.match(/^\/currencies\/(\d+)$/)
  if (m) return delById(store.currencies, Number(m[1]), 'العملة')

  m = path.match(/^\/bank-groups\/(\d+)$/)
  if (m) return delById(store.bankGroups, Number(m[1]), 'مجموعة البنك')

  m = path.match(/^\/banks\/(\d+)$/)
  if (m) return delById(store.banks, Number(m[1]), 'البنك')

  m = path.match(/^\/cashbox-groups\/(\d+)$/)
  if (m) return delById(store.cashboxGroups, Number(m[1]), 'المجموعة')

  m = path.match(/^\/cash-boxes\/(\d+)$/)
  if (m) return delById(store.cashBoxes, Number(m[1]), 'الصندوق')

  m = path.match(/^\/receipt-types\/(\d+)$/)
  if (m) return delById(store.receiptTypes, Number(m[1]), 'النوع')

  m = path.match(/^\/payment-types\/(\d+)$/)
  if (m) return delById(store.paymentTypes, Number(m[1]), 'النوع')

  m = path.match(/^\/journal-types\/(\d+)$/)
  if (m) return delById(store.journalTypes, Number(m[1]), 'النوع')

  m = path.match(/^\/account-ceilings\/(\d+)$/)
  if (m) return delById(store.accountCeilings, Number(m[1]), 'التسقيف')

  m = path.match(/^\/receipt-vouchers\/(\d+)$/)
  if (m) return delById(store.receiptVouchers, Number(m[1]), 'السند')

  m = path.match(/^\/payment-vouchers\/(\d+)$/)
  if (m) return delById(store.paymentVouchers, Number(m[1]), 'السند')

  m = path.match(/^\/journal-entries\/by-ref\/(.+)$/)
  if (m) {
    const ref = Number(m[1])
    store.journalEntries = store.journalEntries.filter((e) => e.reference_id !== ref)
    persist()
    return ok()
  }

  m = path.match(/^\/journal-entries\/(\d+)$/)
  if (m) return delById(store.journalEntries, Number(m[1]), 'القيد')

  fail(`DELETE غير مدعوم: ${path}`)
}

/* ========================= Axios-like client ========================= */

type ApiResponse<T = any> = { data: T }

async function request(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  bodyOrConfig?: any,
  maybeConfig?: any
): Promise<ApiResponse> {
  await Promise.resolve() // microtask — async feel
  try {
    let data: any
    if (method === 'get') data = handleGet(url, bodyOrConfig)
    else if (method === 'delete') data = handleDelete(url)
    else if (method === 'post') data = handlePost(url, bodyOrConfig)
    else data = handlePut(url, bodyOrConfig ?? maybeConfig)
    return { data }
  } catch (e) {
    return Promise.reject(e)
  }
}

const api: any = {
  get: (url: string, config?: { params?: Record<string, any> }) => request('get', url, config),
  post: (url: string, body?: any) => request('post', url, body),
  put: (url: string, body?: any) => request('put', url, body),
  delete: (url: string) => request('delete', url),
}

/* ========================= Namespaced helpers ========================= */

api.accounts = {
  getAccounts: async () => {
    const res = await api.get('/accounts')
    return { tree: res.data.tree || [], list: res.data.list || [] }
  },
  createAccount: async (data: any) => (await api.post('/accounts', data)).data,
  updateAccount: async (id: number, data: any) => (await api.put(`/accounts/${id}`, data)).data,
  deleteAccount: async (id: number) => (await api.delete(`/accounts/${id}`)).data,
  getMainForCashboxes: async () => (await api.get('/accounts/main-for-cashboxes')).data,
  getSubAccounts: async () => extractList(await api.get('/accounts/sub-for-ceiling')),
}

api.accountGroups = {
  getAll: async (search = '') => (await api.get('/account-groups', { params: { search } })).data,
  getOne: async (id: number) => (await api.get(`/account-groups/${id}`)).data,
  create: async (data: any) => (await api.post('/account-groups', data)).data,
  update: async (id: number, data: any) => (await api.put(`/account-groups/${id}`, data)).data,
  delete: async (id: number) => (await api.delete(`/account-groups/${id}`)).data,
}

api.currencies = {
  getAll: async () => (await api.get('/currencies')).data,
  create: async (data: any) => (await api.post('/currencies', data)).data,
  update: async (id: number, data: any) => (await api.put(`/currencies/${id}`, data)).data,
  delete: async (id: number) => (await api.delete(`/currencies/${id}`)).data,
}

api.bankGroups = {
  getAll: (search = '') => api.get('/bank-groups', { params: { search } }).then((r: ApiResponse) => r.data),
  getOne: (id: number) => api.get(`/bank-groups/${id}`).then((r: ApiResponse) => r.data),
  create: (payload: any) => api.post('/bank-groups', payload).then((r: ApiResponse) => r.data),
  update: (id: number, payload: any) => api.put(`/bank-groups/${id}`, payload).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/bank-groups/${id}`).then((r: ApiResponse) => r.data),
}

api.banks = {
  getBanks: async (params?: any) => (await api.get('/banks', { params })).data,
  addBank: async (data: any) => (await api.post('/banks', data)).data,
  deleteBank: async (id: number) => (await api.delete(`/banks/${id}`)).data,
}

api.cashboxGroups = {
  getAll: (search = '') => api.get('/cashbox-groups', { params: { search } }).then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/cashbox-groups', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/cashbox-groups/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/cashbox-groups/${id}`).then((r: ApiResponse) => r.data),
}

api.cashBoxes = {
  getAll: (search = '') => api.get('/cash-boxes', { params: { search } }).then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/cash-boxes', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/cash-boxes/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/cash-boxes/${id}`).then((r: ApiResponse) => r.data),
}

api.paymentTypes = {
  getAll: (search = '') => api.get('/payment-types', { params: { search } }).then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/payment-types', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/payment-types/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/payment-types/${id}`).then((r: ApiResponse) => r.data),
}

api.receiptTypes = {
  getAll: (search = '') => api.get('/receipt-types', { params: { search } }).then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/receipt-types', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/receipt-types/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/receipt-types/${id}`).then((r: ApiResponse) => r.data),
}

api.journalTypes = {
  getAll: (search = '') => api.get('/journal-types', { params: { search } }).then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/journal-types', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/journal-types/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/journal-types/${id}`).then((r: ApiResponse) => r.data),
}

api.accountCeilings = {
  getAll: () => api.get('/account-ceilings').then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/account-ceilings', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/account-ceilings/${id}`, data).then((r: ApiResponse) => r.data),
  delete: (id: number) => api.delete(`/account-ceilings/${id}`).then((r: ApiResponse) => r.data),
}

api.receiptVouchers = {
  getAll: () => api.get('/receipt-vouchers').then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/receipt-vouchers', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/receipt-vouchers/${id}`, data).then((r: ApiResponse) => r.data),
  remove: (id: number) => api.delete(`/receipt-vouchers/${id}`).then((r: ApiResponse) => r.data),
}

api.paymentVouchers = {
  getAll: () => api.get('/payment-vouchers').then((r: ApiResponse) => r.data),
  create: (data: any) => api.post('/payment-vouchers', data).then((r: ApiResponse) => r.data),
  update: (id: number, data: any) => api.put(`/payment-vouchers/${id}`, data).then((r: ApiResponse) => r.data),
  remove: (id: number) => api.delete(`/payment-vouchers/${id}`).then((r: ApiResponse) => r.data),
}

api.reports = {
  accountStatement: async (payload: any) => (await api.post('/reports/account-statement', payload)).data,
}

api.currencyExchange = {
  formData: async (type: string) => (await api.get(`/currency-exchange/form-data?type=${type}`)).data,
  execute: async (payload: any) => (await api.post('/currency-exchange', payload)).data,
}

api.transitAccounts = {
  get: async () => (await api.get('/settings/transit-accounts')).data,
  save: async (data: any) => (await api.post('/settings/transit-accounts', data)).data,
}

/* ========================= Named exports ========================= */

export const getJournalEntries = () => api.get('/journal-entries')
export const createJournalEntry = (data: any) => api.post('/journal-entries', data)
export const updateJournalEntry = (id: number, data: any) => api.put(`/journal-entries/${id}`, data)
export const deleteJournalEntry = (id: number) => api.delete(`/journal-entries/${id}`)
export const deleteJournalEntryByRef = (ref: number | string) =>
  api.delete(`/journal-entries/by-ref/${ref}`)

export function getStoredUserId(): number | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const user = JSON.parse(raw)
    return user?.id ?? null
  } catch {
    return null
  }
}

/** Stable numeric ref so booking journal lines can be found/reversed */
function bookingRefId(bookingId: string): number {
  let h = 2166136261
  for (let i = 0; i < bookingId.length; i++) {
    h ^= bookingId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) || 1
}

/** Create (or return) a receivable leaf account under ذمم مكاتب السفريات */
export function ensureOfficeLedgerAccount(officeName: string): number {
  let parent = store.accounts.find((a) => a.code === OFFICES_RECEIVABLE_PARENT_CODE)
  if (!parent) {
    const receivables =
      store.accounts.find((a) => a.code === '113') ||
      store.accounts.find((a) => a.name_ar === 'الذمم المدينة')
    parent = {
      id: nextId('accounts'),
      code: OFFICES_RECEIVABLE_PARENT_CODE,
      name_ar: 'ذمم مكاتب السفريات',
      name_en: 'Travel Offices Receivables',
      parent_id: receivables?.id ?? 9,
      account_group_id: 1,
      account_level: 'رئيسي',
      financial_statement: 'الميزانية العمومية',
      created_at: now(),
      branch_name: BRANCH,
      group_name: 'الأصول',
      parent_name: receivables?.name_ar ?? 'الذمم المدينة',
    }
    store.accounts.push(parent)
  }

  const existing = store.accounts.find(
    (a) => a.parent_id === parent!.id && a.name_ar === officeName,
  )
  if (existing) return existing.id

  const siblings = store.accounts.filter((a) => a.parent_id === parent!.id)
  const seq = siblings.length + 1
  const code = `${OFFICES_RECEIVABLE_PARENT_CODE}${String(seq).padStart(2, '0')}`
  const row: Account = {
    id: nextId('accounts'),
    code,
    name_ar: officeName,
    name_en: officeName,
    parent_id: parent.id,
    account_group_id: 1,
    account_level: 'فرعي',
    financial_statement: 'الميزانية العمومية',
    created_at: now(),
    branch_name: BRANCH,
    group_name: 'الأصول',
    parent_name: parent.name_ar,
  }
  store.accounts.push(row)
  persist()
  return row.id
}

/** Dr مكتب / Cr إيرادات التذاكر when a booking is confirmed */
export function postBookingCharge(input: {
  bookingId: string
  ledgerAccountId: number
  amount: number
  passengerName: string
  seatNumber: number
}): void {
  const ref = bookingRefId(input.bookingId)
  const already = store.journalEntries.some(
    (l) => l.reference_type === 'booking' && l.reference_id === ref,
  )
  if (already || input.amount <= 0 || !input.ledgerAccountId) return

  const journal_date = new Date().toISOString().slice(0, 10)
  const notes = `حجز ${input.passengerName} — مقعد ${input.seatNumber}`

  store.journalEntries.push({
    id: nextId('journalEntries'),
    reference_id: ref,
    reference_type: 'booking',
    journal_date,
    currency_id: 1,
    account_id: input.ledgerAccountId,
    debit: input.amount,
    credit: 0,
    notes,
    journal_type_id: 1,
    cost_center_id: null,
    user_name: USER,
    branch_name: BRANCH,
    created_at: now(),
  })
  store.journalEntries.push({
    id: nextId('journalEntries'),
    reference_id: ref,
    reference_type: 'booking',
    journal_date,
    currency_id: 1,
    account_id: TICKET_REVENUE_ACCOUNT_ID,
    debit: 0,
    credit: input.amount,
    notes,
    journal_type_id: 1,
    cost_center_id: null,
    user_name: USER,
    branch_name: BRANCH,
    created_at: now(),
  })
  persist()
}

/** Remove booking journal lines on cancel */
export function reverseBookingCharge(bookingId: string): void {
  const ref = bookingRefId(bookingId)
  const before = store.journalEntries.length
  store.journalEntries = store.journalEntries.filter(
    (l) => !(l.reference_type === 'booking' && l.reference_id === ref),
  )
  if (store.journalEntries.length !== before) persist()
}

/** Receivable balance (debit − credit) = ما على المكتب لدى الوكالة */
export function getAccountBalance(accountId: number | null | undefined): number {
  if (!accountId) return 0
  return store.journalEntries
    .filter((l) => l.account_id === accountId)
    .reduce((sum, l) => sum + l.debit - l.credit, 0)
}

export { extractList }
export default api
