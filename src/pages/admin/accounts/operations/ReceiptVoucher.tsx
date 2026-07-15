import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { serverApi } from '../../../../api/serverApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Receipt Voucher - UI Only
========================= */

type Voucher = {
  id: number;
  voucherNo: string;
  date: string;
  receiptType: "cash" | "bank" | "";
  cashBox?: string;
  bankAccount?: string;
  transferNo?: string;
  currency: string;
  amount: string;
  account: string;
  analyticAccount?: string;
  costCenter?: string;
  notes?: string;
  handling?: string;
  createdAt: string;
  user: string;
  branch: string;
};

/* ===== Lookups ===== */
type CashBox = {
  id: number;
  name_ar: string;
};

type Bank = {
  id: number;
  name_ar: string;
};

type Account = {
  id: number;
  code?: string;
  name_ar: string;
};

type Currency = {
  id: number;
  name_ar: string;
  code: string;
  symbol: string;
  is_local?: number;
};

const formatLocalDateTime = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleString("ar-YE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};


const today = new Date().toLocaleDateString("en-CA");


const ReceiptVoucher: React.FC = () => {
  /* =========================
     State
  ========================= */
  const [showModal, setShowModal] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [date, setDate] = useState(today);
  const [allDates, setAllDates] = useState(false);
  
  const [list, setList] = useState<Voucher[]>([]);
 

  /* ===== بيانات من السيرفر ===== */
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [journalTypes, setJournalTypes] = useState<any[]>([]);

  const [form, setForm] = useState({
    voucherNo: String(list.length + 1),
    date: today, // today = YYYY-MM-DD
    receiptType: "" as "cash" | "bank" | "",
    cashBox: "",
    bankAccount: "",
    transferNo: "",
    currency_id: "", // âœ…
    currency: "ط±ظٹط§ظ„ ظٹظ…ظ†ظٹ",
    amount: "",
    account: "",
    analyticAccount: "",
    costCenter: "",
    handling: "",
    notes: "",
    journalTypeId: "",
  });


  /* =========================
     Load Lookups
  ========================= */

  useEffect(() => {
    fetchCashBoxes();
    fetchBanks();
    fetchAccounts();
    fetchCurrencies();
    fetchJournalTypes();
    loadVouchers(); // ✅ سطر واحد فقط
  }, []);

  const fetchJournalTypes = async () => {
    const res = await api.get("/journal-types");
    const data =
      res.data?.list ||
      res.data?.journalTypes ||
      res.data?.data ||
      res.data ||
      [];
    setJournalTypes(Array.isArray(data) ? data : []);
  };

useEffect(() => {
  if (cashBoxes.length || bankAccounts.length) {
    loadVouchers();
  }
}, [cashBoxes, bankAccounts]);


 const fetchCashBoxes = async () => {
  const res = await api.get("/cash-boxes");

  // دعم كل الأشكال الممكنة
  const data =
    res.data?.list ||
    res.data?.cashBoxes ||
    res.data?.data ||
    res.data ||
    [];

  setCashBoxes(Array.isArray(data) ? data : []);
};


  const fetchBanks = async () => {
    const res = await api.get("/banks");
    if (res.data.success) setBankAccounts(res.data.banks);
  };

   
const fetchAccounts = async () => {
  try {
    const res = await serverApi.accounts.sub();
    const list = (res.list ?? []).map((a: any) => ({
      id: a.id,
      code: a.code,
      name_ar: a.name_ar,
    }));
    const seen = new Set<string>();
    setAccounts(
      list.filter((a: { code?: string; id: number }) => {
        const key = a.code || String(a.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  } catch {
    const res = await api.get("/accounts/sub-for-ceiling");
    const data =
      res.data?.list ||
      res.data?.accounts ||
      res.data?.data ||
      res.data ||
      [];
    setAccounts(Array.isArray(data) ? data : []);
  }
};


 const fetchCurrencies = async () => {
  const res = await api.get("/currencies");

  const data =
    res.data?.currencies ||
    res.data?.list || 
    res.data?.data ||
    res.data ||
    [];

  setCurrencies(Array.isArray(data) ? data : []);
};

useEffect(() => {
  if (!form.currency_id && currencies.length > 0) {
    const defaultCurrency = currencies.find((c) => c.is_local === 1) || currencies[0];
    setForm((prev) => ({
      ...prev,
      currency_id: String(defaultCurrency.id),
      currency: defaultCurrency.name_ar,
    }));
  }
}, [currencies, form.currency_id]);

const getValidatedPayload = () => {
  if (!form.receiptType) {
    alert("اختر نوع السند");
    return null;
  }

  if (form.receiptType === "cash" && !form.cashBox) {
    alert("اختر الصندوق");
    return null;
  }

  if (form.receiptType === "bank" && !form.bankAccount) {
    alert("اختر حساب البنك");
    return null;
  }

  if (!form.account) {
    alert("اختر الحساب");
    return null;
  }

  if (!form.currency_id) {
    alert("اختر العملة");
    return null;
  }

  if (!form.amount || Number(form.amount) <= 0) {
    alert("أدخل مبلغ صحيح");
    return null;
  }

  return {
    voucher_no: form.voucherNo,
    voucher_date: form.date,
    receipt_type: form.receiptType,
    cash_box_account_id:
      form.receiptType === "cash" ? Number(form.cashBox) : null,
    bank_account_id:
      form.receiptType === "bank" ? Number(form.bankAccount) : null,
    transfer_no: form.transferNo || null,
    currency_id: Number(form.currency_id),
    amount: Number(form.amount),
    account_id: Number(form.account),
    analytic_account_id: form.analyticAccount || null,
    cost_center_id: form.costCenter || null,
    journal_type_id: form.journalTypeId ? Number(form.journalTypeId) : null,
    notes: form.notes || null,
    handling: form.handling || 0,
    created_by: 1,
    branch_id: 1,
  };
};

/* =========================
   Load Vouchers From Server
========================= */
const loadVouchers = async () => {
  const res = await api.get("/receipt-vouchers");

  if (res.data.success) {
    setList(
      res.data.list.map((v: any) => {
        const cashBoxName =
          v.cash_box_account_id
            ? cashBoxes.find(c => c.id === v.cash_box_account_id)?.name_ar || ""
            : "";

        const bankAccountName =
          v.bank_account_id
            ? bankAccounts.find(b => b.id === v.bank_account_id)?.name_ar || ""
            : "";

        return {
          id: v.id,
          voucherNo: v.voucher_no,
          date: v.voucher_date.split("T")[0],
          receiptType: v.receipt_type,

          // ✅ أسماء للعرض
          cashBox: cashBoxName, 
          bankAccount: bankAccountName,

          transferNo: v.transfer_no,
          currency: v.currency_name,
          amount: String(v.amount),
          account: v.account_name,

          analyticAccount: v.analytic_account_id,
          costCenter: v.cost_center_id,
          notes: v.notes,
          handling: v.handling,
          createdAt: v.created_at,
     user: v.user_name || "—",     // بدل الرقم
  branch: v.branch_name || DEFAULT_BRANCH_NAME,
        };
      })
    );
  }
};

  /* =========================
     Add Voucher (UI Only)
  ========================= */
 const addVoucher = async () => {
  try {
    const payload = getValidatedPayload();
    if (!payload) return;

    const res = await api.post("/receipt-vouchers", payload);

    if (!res.data.success) {
      alert("فشل حفظ السند");
      return;
    }

    // 🔄 أعد التحميل من السيرفر
    await loadVouchers();

    setShowModal(false);
    setSelectedId(null);

    setForm({
      ...form,
      receiptType: "",
      cashBox: "",
      bankAccount: "",
      transferNo: "",
      currency_id: "",
      amount: "",
      account: "",
      analyticAccount: "",
      costCenter: "",
      handling: "",
      notes: "",
    });
  } catch (err: any) {
    console.error(err);
    alert(err.response?.data?.message || "خطأ في حفظ سند القبض");
  }
};


  /* =========================
     Delete
  ========================= */
  const remove = async () => {
  if (!selectedId) {
    alert("حدد سند أولاً");
    return;
  }

  const confirmDelete = window.confirm("هل أنت متأكد من حذف السند؟");
  if (!confirmDelete) return;

  try {
    const res = await api.delete(`/receipt-vouchers/${selectedId}`);

    if (!res.data.success) {
      alert("فشل حذف السند");
      return;
    }

    // 🔄 إعادة تحميل البيانات من السيرفر
    await loadVouchers();

    setSelectedId(null);
  } catch (err: any) {
    console.error(err);
    alert(err.response?.data?.message || "خطأ في حذف السند");
  }
};

  /*=======================
  تعديل 
  =======================*/
  const updateVoucher = async () => {
  if (!selectedId) return;

  try {
    const payload = getValidatedPayload();
    if (!payload) return;

    const res = await api.put(
      `/receipt-vouchers/${selectedId}`,
      payload
    );

    if (!res.data.success) {
      alert("❌ فشل تعديل السند");
      return;
    }

    await loadVouchers();

    setShowModal(false);
    setSelectedId(null);
  } catch (err: any) {
    console.error(err);
    alert(err.response?.data?.message || "❌ خطأ في تعديل سند القبض");
  }
};

/*================================
=================================*/
const openEdit = () => {
  if (!selectedId) return;

  const v = list.find(x => x.id === selectedId);
  if (!v) return;

  setForm({
    voucherNo: v.voucherNo,
    date: v.date,
    receiptType: v.receiptType,
    cashBox: v.cashBox ? String(
      cashBoxes.find(c => c.name_ar === v.cashBox)?.id || ""
    ) : "",
    bankAccount: v.bankAccount ? String(
      bankAccounts.find(b => b.name_ar === v.bankAccount)?.id || ""
    ) : "",
    transferNo: v.transferNo || "",
    currency_id: currencies.find(c => c.name_ar === v.currency)?.id?.toString() || "",
    currency: v.currency,
    amount: v.amount,
    account: accounts.find(a => a.name_ar === v.account)?.id?.toString() || "",
    analyticAccount: v.analyticAccount || "",
    costCenter: v.costCenter || "",
    handling: v.handling || "",
    notes: v.notes || "",
    journalTypeId: "", // Could be set from v if available in future
  });

  setShowModal(true);
};


  /* =========================
     Filter
  ========================= */
  const filtered = list.filter((x) => {
  const matchSearch =
    (x.voucherNo || "").includes(search) ||
    (x.account || "").includes(search) ||
    (x.notes || "").includes(search) ||
    (x.transferNo || "").includes(search);

  const matchDate =
    allDates || (x.date && x.date.slice(0, 10) === date);

  return matchSearch && matchDate;
});


  return (
    <div className="space-y-4">

      {/* ================= Actions ================= */}
<div className="flex justify-between items-center bg-[#e9efe6] p-4 rounded-lg">
  <div className="flex gap-2">

    {/* إضافة */}
    <button
      onClick={() => {
        setSelectedId(null);
        setShowModal(true);
      }}
      className="btn-green"
    >
      ➕ إضافة
    </button>

    {/* تعديل */}
    <button
      onClick={openEdit}
      disabled={!selectedId}
      className={`btn-gray ${!selectedId ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      ✏️ تعديل
    </button>

    {/* حذف */}
    <button
      onClick={remove}
      disabled={!selectedId}
      className={`btn-red ${!selectedId ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      🗑️ حذف
    </button>

    {/* طباعة */}
    <button className="btn-gray">
      🖨️ طباعة
    </button>

  </div>
</div>


      {/* ================= Filters ================= */}
      <div className="flex justify-between items-center px-2">
        <input
          placeholder="🔍 بحث..."
          className="input w-56 text-right"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <input
            type="date"
            className="input w-40"
            disabled={allDates}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDates}
              onChange={(e) => setAllDates(e.target.checked)}
            />
            كل التواريخ
          </label>
        </div>
      </div>

      {/* ================= Table ================= */}
      {/* ================= Table ================= */}
<div className="acc-table-wrap">
  <table className="acc-table text-center">
    <thead>
      <tr>
        <th className="border border-gray-200 px-2 py-1">رقم السند</th>
        <th className="border border-gray-200 px-2 py-1">التاريخ</th>
        <th className="border border-gray-200 px-2 py-1">نوع القبض</th>
        <th className="border border-gray-200 px-2 py-1">الصندوق / البنك</th>
        <th className="border border-gray-200 px-2 py-1">رقم الحوالة</th>
        <th className="border border-gray-200 px-2 py-1">العملة</th>
        <th className="border border-gray-200 px-2 py-1">المبلغ</th>
        <th className="border border-gray-200 px-2 py-1">الحساب</th>
        <th className="border border-gray-200 px-2 py-1">ملاحظات</th>
        <th className="border border-gray-200 px-2 py-1">وقت الإنشاء</th>
        <th className="border border-gray-200 px-2 py-1">المستخدم</th>
        <th className="border border-gray-200 px-2 py-1">الفرع</th>
      </tr>
    </thead>
    <tbody>
      {filtered.length ? (
        filtered.map((v) => (
          <tr
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            className={`cursor-pointer hover:bg-gray-50 ${
              selectedId === v.id ? "acc-row-selected" : ""
            }`}
          >
            <td className="border border-gray-200 px-2 py-1">{v.voucherNo}</td>
            <td className="border border-gray-200 px-2 py-1">{v.date}</td>
            <td className="border border-gray-200 px-2 py-1">
              {v.receiptType === "cash" ? "نقد" : "بنوك"}
            </td>
            <td className="border border-gray-200 px-2 py-1">
              {v.cashBox || v.bankAccount || "-"}
            </td>
            <td className="border border-gray-200 px-2 py-1">
              {v.transferNo || "-"}
            </td>
            <td className="border border-gray-200 px-2 py-1">{v.currency}</td>
            <td className="border border-gray-200 px-2 py-1">{v.amount}</td>
            <td className="border border-gray-200 px-2 py-1">{v.account}</td>
            <td className="border border-gray-200 px-2 py-1">
              {v.notes || "-"}
            </td>
            <td className="border border-gray-200 px-2 py-1">
              {formatLocalDateTime(v.createdAt)}
            </td>
            <td className="border border-gray-200 px-2 py-1">{v.user}</td>
            <td className="border border-gray-200 px-2 py-1">{v.branch}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={12} className="py-6 text-gray-400 border border-gray-200">
            لا توجد بيانات
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>


      {/* ================= Modal ================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[#eef3ee] w-[760px] rounded-xl p-6 space-y-4">

            <h3 className="text-lg font-bold text-center">
  {selectedId ? "✏️ تعديل سند قبض" : "➕ إضافة سند قبض"}
</h3>


            {/* الصف العلوي */}
            <div className="grid grid-cols-3 gap-4">
              <input disabled className="input bg-gray-100" value={form.voucherNo} />
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <select
                className="input"
                value={form.receiptType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    receiptType: e.target.value as any,
                    cashBox: "",
                    bankAccount: "",
                    transferNo: "",
                  })
                }
              >
                <option value="">-- نوع القبض --</option>
                <option value="cash">نقد</option>
                <option value="bank">بنوك</option>
              </select>
            </div>

            {/* الصندوق / البنك + رقم الحوالة + الحساب */}
            <div className="grid grid-cols-3 gap-4">
              {form.receiptType === "cash" && (
                <select
  className="input"
  value={form.cashBox}
  onChange={(e) =>
    setForm({ ...form, cashBox: e.target.value })
  }
>
  <option value="">-- اختر الصندوق --</option>

  {cashBoxes.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name_ar}
    </option>
  ))}
</select>
              )}

              {form.receiptType === "bank" && (
                <>
                  <select
                    className="input"
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                  >
                    <option value="">-- اختر حساب البنك --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.name_ar}</option>
                    ))}
                  </select>

                  <input
                    placeholder="رقم الحوالة (اختياري)"
                    className="input"
                    value={form.transferNo}
                    onChange={(e) => setForm({ ...form, transferNo: e.target.value })}
                  />
                </>
              )}

              <select
                className="input"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
              >
                <option value="">-- الحساب --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `${a.code} — ` : ''}{a.name_ar}
                  </option>
                ))}
              </select>
            </div>

            {/* العملة / المبلغ / المناولة */} 
            <div className="grid grid-cols-3 gap-4">
            <select
               className="input"
               value={form.currency_id}
                onChange={(e) => setForm({ ...form, currency_id: e.target.value })}
              >
               <option value="">-- العملة --</option>
               {currencies.map((c) => (
               <option key={c.id} value={c.id}>
                {c.name_ar} ({c.code})
               </option>
             ))}
               </select>

              <input
                type="number"
                placeholder="المبلغ"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <input
                placeholder="مناولة"
                className="input"
                value={form.handling}
                onChange={(e) => setForm({ ...form, handling: e.target.value })}
              />
            </div>

            {/* البيان */}
            <textarea
              className="input"
              placeholder="البيان"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {/* خيارات إضافية */}
            <div className="border-t pt-3">
              <button
                onClick={() => setShowExtra(!showExtra)}
                className="w-full acc-link font-semibold flex items-center justify-between"
              >
                <span>الخيارات الإضافية</span>
                <span>{showExtra ? "▾" : "▸"}</span>
              </button>

              {showExtra && (
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <select
                    className="input"
                    value={form.journalTypeId}
                    onChange={e => setForm({ ...form, journalTypeId: e.target.value })}
                  >
                    <option value="">-- نوع السند --</option>
                    {journalTypes.map((jt: any) => (
                      <option key={jt.id} value={jt.id}>
                        {jt.name_ar} {jt.code ? `(${jt.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="الحساب التحليلي"
                    className="input"
                    value={form.analyticAccount}
                    onChange={(e) => setForm({ ...form, analyticAccount: e.target.value })}
                  />
                  <input
                    placeholder="مركز التكلفة"
                    className="input"
                    value={form.costCenter}
                    onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setShowModal(false)} className="btn-gray">إلغاء</button>
              <button
  onClick={selectedId ? updateVoucher : addVoucher}
  className="btn-green"
>
  {selectedId ? "💾 حفظ التعديل" : "➕ إضافة"}
</button>

            </div>
          </div>
        </div>
      )}

      <style>{`
        .input { padding:8px; border-radius:8px; border:1px solid #ccc; background:#fff; }
        .btn-green { background:#14532d; color:#fff; padding:8px 16px; border-radius:8px; }
        .btn-gray { background:#e5e7eb; padding:8px 16px; border-radius:8px; }
        .btn-red { background:#dc2626; color:#fff; padding:8px 16px; border-radius:8px; }
      `}</style>
    </div>
  );
};

export default ReceiptVoucher;
