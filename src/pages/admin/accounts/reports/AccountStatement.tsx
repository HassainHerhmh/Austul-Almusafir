import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import * as XLSX from 'xlsx';
import { Search, FileSpreadsheet, Printer } from "lucide-react";

type Account = { id: number; name_ar: string; parent_id?: number | null; account_level?: string; };
type Currency = { id: number; name_ar: string; code: string; };
type Row = {
  id: number; journal_date: string; account_name: string; debit: number; credit: number;
  notes: string; balance: number; reference_type: string; reference_id: any; is_opening?: boolean;
  currency_name?: string; currency_id?: number;
};

const getYemenToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const today = getYemenToday();

const getBalanceStatus = (balance: number) => {
  if (balance > 0) return "عليه";
  if (balance < 0) return "له";
  return "—";
};
const getBalanceStatusClass = (balance: number) =>
  balance > 0
    ? "acc-badge-danger px-2 py-0.5 rounded-md text-[10px] font-black"
    : balance < 0
      ? "acc-badge-success px-2 py-0.5 rounded-md text-[10px] font-black"
      : "acc-badge-primary px-2 py-0.5 rounded-md text-[10px] font-black";

const isOpeningRow = (row: Row | any) => row.account_name === "رصيد سابق" || row.is_opening;
const getDisplayDebit = (row: Row | any) =>
  isOpeningRow(row) ? (row.balance > 0 ? Math.abs(Number(row.balance || 0)) : 0) : Number(row.debit || 0);
const getDisplayCredit = (row: Row | any) =>
  isOpeningRow(row) ? (row.balance < 0 ? Math.abs(Number(row.balance || 0)) : 0) : Number(row.credit || 0);

const AccountStatement: React.FC = () => {
  const [mainAccounts, setMainAccounts] = useState<Account[]>([]);
  const [subAccounts, setSubAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [accountMode, setAccountMode] = useState<"all" | "single">("single");
  const [accountId, setAccountId] = useState("");
  const [mainAccountId, setMainAccountId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [periodType, setPeriodType] = useState<"day" | "from_start" | "month" | "range">("day");
  const [date, setDate] = useState(today);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  void setFromDate;
  void setToDate;

  const [reportMode, setReportMode] = useState<"summary" | "detailed">("detailed");
  const [detailedType, setDetailedType] = useState<"full" | "no_open">("full");
  const [summaryType, setSummaryType] = useState("local");

  const referenceTranslations: { [key: string]: string } = {
    order: 'طلب توصيل',
    journal: 'قيد يومي',
    payment: 'سند صرف',
    receipt: 'سند قبض',
    opening: 'رصيد افتتاحي',
    wassel_order: 'طلب وصل لي',
    manual_order: 'طلب يدوي',
    card_batch: 'تسليم كروت',
  };

  useEffect(() => { loadLookups(); }, []);

  const loadLookups = async () => {
    try {
      const [a, c] = await Promise.all([api.get("/accounts"), api.get("/currencies")]);
      const list = a.data?.list || [];
      setMainAccounts(list.filter((x: Account) => x.account_level === "رئيسي"));
      setSubAccounts(list.filter((x: Account) => x.account_level === "فرعي"));
      setCurrencies(c.data?.currencies || c.data?.list || []);
    } catch (e) { console.error(e); }
  };

  const run = async () => {
    const { from_date, to_date } = {
      day: { from_date: date, to_date: date },
      month: {
        from_date: `${date.split('-')[0]}-${date.split('-')[1]}-01`,
        to_date: `${date.split('-')[0]}-${date.split('-')[1]}-${new Date(Number(date.split('-')[0]), Number(date.split('-')[1]), 0).getDate()}`,
      },
      from_start: { from_date: null, to_date: date },
      range: { from_date: fromDate, to_date: toDate },
    }[periodType];

    try {
      const res = await (api as any).reports.accountStatement({
        currency_id: currencyId ? Number(currencyId) : null,
        from_date, to_date, report_mode: reportMode, summary_type: summaryType, detailed_type: detailedType,
        account_id: accountMode === "single" ? (accountId ? Number(accountId) : null) : null,
        main_account_id: accountMode === "all" ? (mainAccountId ? Number(mainAccountId) : null) : null,
      });
      if (res.success) setRows(res.list || []);
    } catch (e) { setRows([]); }
  };

  const filteredRows = rows.filter(r =>
    r.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reference_id?.toString().includes(searchTerm)
  );

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows.map(r => ({
      'التاريخ': r.journal_date?.slice(0, 10),
      'المستند': referenceTranslations[r.reference_type] || r.reference_type,
      'المرجع': r.reference_id || '',
      'الحساب': r.account_name,
      'مدين': getDisplayDebit(r), 'دائن': getDisplayCredit(r), 'الرصيد': Math.abs(r.balance),
      'الحالة': getBalanceStatus(r.balance), 'البيان': r.notes,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `كشف_حساب_${getYemenToday()}.xlsx`);
  };

  return (
    <div className="acc-shell w-full text-right space-y-4" dir="rtl">
      <div className="acc-report-header flex flex-col md:flex-row justify-between items-center p-4 no-print gap-4">
        <div>
          <h2 className="acc-heading text-xl md:text-2xl">كشف الحساب التحليلي</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 acc-muted" size={16} />
            <input
              type="text"
              placeholder="بحث سريع..."
              className="acc-input pr-10 pl-4 w-48 md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={exportToExcel}
            title="تصدير Excel"
            className="acc-btn acc-btn-outline p-2.5 rounded-xl"
          >
            <FileSpreadsheet size={20} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            title="طباعة PDF"
            className="acc-btn acc-btn-outline p-2.5 rounded-xl"
          >
            <Printer size={20} />
          </button>
        </div>
      </div>

      <div className="acc-filter-panel p-4 no-print space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select className="acc-select" value={accountMode} onChange={(e) => setAccountMode(e.target.value as any)}>
            <option value="single">حساب واحد</option>
            <option value="all">كل الحسابات</option>
          </select>
          {accountMode === "single" ? (
            <select
              className="acc-select border-r-2 border-[var(--primary)] font-bold"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">اختر حساب فرعي...</option>
              {subAccounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
            </select>
          ) : (
            <select
              className="acc-select border-r-2 border-[var(--primary)] font-bold"
              value={mainAccountId}
              onChange={(e) => setMainAccountId(e.target.value)}
            >
              <option value="">اختر حساب رئيسي...</option>
              {mainAccounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
            </select>
          )}
          <select className="acc-select" value={periodType} onChange={(e) => setPeriodType(e.target.value as any)}>
            <option value="day">اليوم</option>
            <option value="month">شهر</option>
            <option value="from_start">من البداية</option>
            <option value="range">فترة</option>
          </select>
          <input type="date" className="acc-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="acc-select font-bold" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
            <option value="">كل العملات</option>
            {currencies.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
          <button type="button" onClick={run} className="acc-btn acc-btn-primary font-bold rounded-xl h-[42px]">
            عرض البيانات
          </button>
        </div>

        <div className="acc-filter-inner flex flex-wrap items-center gap-4 p-3">
          <div className="flex acc-surface p-1 rounded-lg border border-[var(--surface2)]">
            <button
              type="button"
              onClick={() => setReportMode("detailed")}
              className={`acc-tab-btn ${reportMode === "detailed" ? "active" : ""}`}
            >
              تحليلي
            </button>
            <button
              type="button"
              onClick={() => setReportMode("summary")}
              className={`acc-tab-btn ${reportMode === "summary" ? "active" : ""}`}
            >
              تجميعي
            </button>
          </div>
          {reportMode === "detailed" ? (
            <div className="flex gap-4 text-xs font-bold acc-muted">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={detailedType === "full"} onChange={() => setDetailedType("full")} />
                مع الرصيد السابق
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={detailedType === "no_open"} onChange={() => setDetailedType("no_open")} />
                بدون رصيد سابق
              </label>
            </div>
          ) : (
            <select className="acc-select bg-transparent text-xs font-black acc-link outline-none w-auto" value={summaryType} onChange={(e) => setSummaryType(e.target.value)}>
              <option value="local">إجمالي بالعملة المحلية</option>
              <option value="with_move">مع الحركة</option>
              <option value="final">الرصيد النهائي</option>
            </select>
          )}
        </div>
      </div>

      <div className="w-full space-y-8">
        {(() => {
          const grouped = filteredRows.reduce((acc: any, r: any) => {
            const key = r.currency_name || "غير محدد";
            if (!acc[key]) acc[key] = [];
            acc[key].push(r);
            return acc;
          }, {});

          return Object.entries(grouped).map(([currencyName, list]: any) => {
            let tDeb = 0;
            let tCre = 0;
            list.forEach((r: any) => {
              tDeb += getDisplayDebit(r);
              tCre += getDisplayCredit(r);
            });

            return (
              <div key={currencyName} className="acc-table-wrap page-break overflow-hidden">
                <div className="acc-currency-header p-3 px-6 flex justify-between items-center">
                  <h3 className="acc-heading text-lg">العملة: {currencyName}</h3>
                  <span className="text-[10px] acc-badge-primary px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                    {reportMode === "detailed" ? 'Analytical' : 'Summary'}
                  </span>
                </div>
                <table className="acc-table text-center text-[13px]">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>المستند</th>
                      <th>المرجع</th>
                      <th className="text-right">الحساب</th>
                      <th>مدين</th>
                      <th>دائن</th>
                      <th>الرصيد الصافي</th>
                      <th>الحالة</th>
                      <th className="text-right">البيان / ملاحظات التدقيق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r: any, idx: number) => {
                      const isOp = isOpeningRow(r);
                      return (
                        <tr key={idx} className={isOp ? "acc-opening-row" : ""}>
                          <td className="text-xs font-mono">{isOp ? "—" : r.journal_date?.slice(0, 10)}</td>
                          <td className="font-bold">{isOp ? "رصيد سابق" : (referenceTranslations[r.reference_type] || r.reference_type)}</td>
                          <td className="acc-muted">{isOp ? "—" : r.reference_id}</td>
                          <td className="text-right font-black">{r.account_name}</td>
                          <td className="acc-debit">{getDisplayDebit(r).toLocaleString()}</td>
                          <td className="acc-credit">{getDisplayCredit(r).toLocaleString()}</td>
                          <td className="font-black" style={{ color: 'var(--primary)' }}>{Math.abs(r.balance).toLocaleString()}</td>
                          <td>
                            <span className={getBalanceStatusClass(r.balance)}>{getBalanceStatus(r.balance)}</span>
                          </td>
                          <td className="text-right acc-muted font-medium leading-relaxed max-w-[400px] break-words">
                            {r.notes}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-black" style={{ background: 'var(--row-muted-bg)' }}>
                      <td colSpan={4} className="text-left font-black uppercase">إجمالي الرصيد الختامي للعملة:</td>
                      <td className="acc-debit">{tDeb.toLocaleString()}</td>
                      <td className="acc-credit">{tCre.toLocaleString()}</td>
                      <td className="text-xl font-black" style={{ color: 'var(--primary)' }}>{Math.abs(tDeb - tCre).toLocaleString()}</td>
                      <td>
                        <span className={`px-4 py-1 rounded-lg text-white ${tDeb - tCre > 0 ? "acc-badge-danger" : "acc-badge-success"}`}>
                          {tDeb - tCre > 0 ? "إجمالي عليه" : "إجمالي له"}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

export default AccountStatement;
