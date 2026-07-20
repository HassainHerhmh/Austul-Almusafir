import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { serverApi } from '../../../../api/serverApi';
import { DEFAULT_BRANCH_NAME } from "../constants";
import { useBrand } from '../../../../context/BrandContext';
import { printStyledVoucher } from '../../../../print/printStyledVoucher';

type PaymentType = "cash" | "bank" | "";

type Voucher = {
  id: number;
  voucherNo: string;
  date: string;
  paymentType: PaymentType;
  paymentTypeName?: string;
  cashBox?: string;
  bankAccount?: string;
  cashBoxId?: number | null;
  bankAccountId?: number | null;
  transferNo?: string;
  currency: string;
  currencyId?: number | null;
  amount: string;
  account: string;
  accountId?: number | null;
  journalReferenceId?: number | null;
  analyticAccount?: string;
  costCenter?: string;
  notes?: string;
  handling?: string;
  createdAt: string;
  user: string;
  branch: string;
};

type CashBox = {
  id: number;
  name_ar: string;
  account_id?: number | null;
};

type Bank = {
  id: number;
  name_ar: string;
  account_id?: number | null;
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

const today = new Date().toLocaleDateString("en-CA");

const formatLocalDateTime = (dateString: string) => {
  const d = new Date(dateString);

  if (Number.isNaN(d.getTime())) return "-";

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

const getPaymentTypeName = (voucher: Voucher) => {
  if (voucher.paymentTypeName) return voucher.paymentTypeName;
  if (voucher.paymentType === "cash") return "نقد";
  if (voucher.paymentType === "bank") return "بنوك";
  return "-";
};

const PaymentVoucher: React.FC = () => {
  const { name: brandName, logoUrl, phones } = useBrand();
  const [showModal, setShowModal] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [date, setDate] = useState(today);
  const [allDates, setAllDates] = useState(false);

  const [list, setList] = useState<Voucher[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [journalTypes, setJournalTypes] = useState<any[]>([]);

  const [form, setForm] = useState({
    voucherNo: "",
    date: today,
    paymentType: "" as PaymentType,
    cashBox: "",
    bankAccount: "",
    transferNo: "",
    currency_id: "",
    currency: "",
    amount: "",
    account: "",
    analyticAccount: "",
    costCenter: "",
    handling: "",
    notes: "",
    journalTypeId: "",
  });

  const loadVouchers = async () => {
    const res = await api.get("/payment-vouchers");

    if (!res.data.success) return;

    setList(
      res.data.list.map((v: any) => {
        const cashBox = v.cash_box_account_id
          ? cashBoxes.find((c) => c.id === v.cash_box_account_id)
          : undefined;
        const bank = v.bank_account_id
          ? bankAccounts.find((b) => b.id === v.bank_account_id)
          : undefined;
        const acc =
          v.account_id != null
            ? accounts.find((a) => a.id === v.account_id)
            : undefined;

        return {
          id: v.id,
          voucherNo: String(v.voucher_no),
          date: v.voucher_date?.split("T")[0] || "",
          paymentType: v.payment_type,
          paymentTypeName: v.payment_type_name,
          cashBox: cashBox?.name_ar || v.cash_box_name || "",
          bankAccount: bank?.name_ar || v.bank_name || "",
          cashBoxId: v.cash_box_account_id ?? null,
          bankAccountId: v.bank_account_id ?? null,
          transferNo: v.transfer_no,
          currency: v.currency_name || "",
          currencyId: v.currency_id ?? null,
          amount: String(v.amount ?? ""),
          account: acc?.name_ar || v.account_name || "",
          accountId: v.account_id ?? null,
          journalReferenceId: v.journal_reference_id ?? null,
          analyticAccount: v.analytic_account_id,
          costCenter: v.cost_center_id,
          notes: v.notes,
          handling: v.handling,
          createdAt: v.created_at,
          user: v.user_name || "—",
          branch: v.branch_name || DEFAULT_BRANCH_NAME,
        };
      })
    );
  };

  const fetchCashBoxes = async () => {
    const res = await api.get("/cash-boxes");
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
    setBankAccounts(res.data.success ? res.data.banks : []);
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
    fetchCashBoxes();
    fetchBanks();
    fetchAccounts();
    fetchCurrencies();
    fetchJournalTypes();
    loadVouchers();
  }, []);

  useEffect(() => {
    if (cashBoxes.length || bankAccounts.length) {
      loadVouchers();
    }
  }, [cashBoxes, bankAccounts]);

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

  const resetForm = () => {
    const defaultCurrency = currencies.find((c) => c.is_local === 1) || currencies[0];

    setForm({
      voucherNo: "",
      date: today,
      paymentType: "",
      cashBox: "",
      bankAccount: "",
      transferNo: "",
      currency_id: defaultCurrency ? String(defaultCurrency.id) : "",
      currency: defaultCurrency?.name_ar || "",
      amount: "",
      account: "",
      analyticAccount: "",
      costCenter: "",
      handling: "",
      notes: "",
      journalTypeId: "",
    });
  };

  const openAdd = () => {
    setSelectedId(null);
    resetForm();
    setShowModal(true);
  };

  const getValidatedPayload = () => {
    if (!form.paymentType) {
      alert("اختر نوع السند");
      return null;
    }

    if (form.paymentType === "cash" && !form.cashBox) {
      alert("اختر الصندوق");
      return null;
    }

    if (form.paymentType === "bank" && !form.bankAccount) {
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

    const accountId = Number(form.account);
    const currencyId = Number(form.currency_id);
    const selectedAccount = accounts.find((a) => a.id === accountId);
    const selectedCurrency = currencies.find((c) => c.id === currencyId);

    return {
      voucher_no: form.voucherNo,
      voucher_date: form.date,
      payment_type: form.paymentType,
      cash_box_account_id:
        form.paymentType === "cash" ? Number(form.cashBox) : null,
      bank_account_id:
        form.paymentType === "bank" ? Number(form.bankAccount) : null,
      transfer_no: form.transferNo || null,
      currency_id: currencyId,
      currency_name: selectedCurrency?.name_ar || form.currency || null,
      amount: Number(form.amount),
      account_id: accountId,
      account_name: selectedAccount?.name_ar || null,
      analytic_account_id: form.analyticAccount || null,
      cost_center_id: form.costCenter || null,
      journal_type_id: form.journalTypeId ? Number(form.journalTypeId) : 1,
      notes: form.notes || null,
      handling: form.handling || null,
      created_by: 1,
      branch_id: 1,
    };
  };

  const resolveCashOrBankAccountId = (): number | null => {
    if (form.paymentType === "cash") {
      const box = cashBoxes.find((c) => c.id === Number(form.cashBox));
      return box?.account_id ? Number(box.account_id) : null;
    }
    if (form.paymentType === "bank") {
      const bank = bankAccounts.find((b) => b.id === Number(form.bankAccount));
      return bank?.account_id ? Number(bank.account_id) : null;
    }
    return null;
  };

  const addVoucher = async () => {
    try {
      const payload = getValidatedPayload();
      if (!payload) return;

      const cashAccountId = resolveCashOrBankAccountId();
      if (!cashAccountId) {
        alert(
          "تعذر تحديد حساب الصندوق/البنك في الدليل — تأكد أنه مربوط بحساب فرعي من التهيئة",
        );
        return;
      }

      const res = await api.post("/payment-vouchers", payload);
      if (!res.data.success) return alert("فشل حفظ السند");

      const voucherId = res.data.voucher?.id as number | undefined;
      try {
        const posted = await serverApi.accounts.createManualJournal({
          journal_date: payload.voucher_date,
          amount: payload.amount,
          debit_account_id: payload.account_id,
          credit_account_id: cashAccountId,
          notes: payload.notes || "سند صرف",
          reference_type: "payment",
        });
        if (voucherId && posted.referenceId) {
          await api.put(`/payment-vouchers/${voucherId}`, {
            journal_reference_id: posted.referenceId,
          });
        }
      } catch (err: any) {
        alert(
          err?.message ||
            "تم حفظ السند محلياً لكن فشل ترحيله للكشف — راجع حساب الصندوق في الدليل",
        );
      }

      await loadVouchers();
      setShowModal(false);
      setSelectedId(null);
      resetForm();
    } catch (err: any) {
      alert(err.response?.data?.message || "خطأ في حفظ سند الصرف");
    }
  };

  const updateVoucher = async () => {
    if (!selectedId) return;

    try {
      const payload = getValidatedPayload();
      if (!payload) return;

      const cashAccountId = resolveCashOrBankAccountId();
      if (!cashAccountId) {
        alert(
          "تعذر تحديد حساب الصندوق/البنك في الدليل — تأكد أنه مربوط بحساب فرعي من التهيئة",
        );
        return;
      }

      const current = list.find((x) => x.id === selectedId);
      let journalRef = current?.journalReferenceId || null;
      const journalPayload = {
        journal_date: payload.voucher_date,
        amount: payload.amount,
        debit_account_id: payload.account_id,
        credit_account_id: cashAccountId,
        notes: payload.notes || "سند صرف",
        reference_type: "payment" as const,
      };

      if (journalRef) {
        await serverApi.accounts.updateManualJournal(journalRef, journalPayload);
      } else {
        const posted = await serverApi.accounts.createManualJournal(journalPayload);
        journalRef = posted.referenceId;
      }

      const res = await api.put(`/payment-vouchers/${selectedId}`, {
        ...payload,
        journal_reference_id: journalRef,
      });
      if (!res.data.success) return alert("فشل التعديل");

      await loadVouchers();
      setShowModal(false);
      setSelectedId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err?.message || "خطأ في التعديل");
    }
  };

  const remove = async () => {
    if (!selectedId) return alert("حدد سند أولًا");
    if (!window.confirm("هل أنت متأكد من حذف السند؟")) return;

    try {
      const current = list.find((x) => x.id === selectedId);
      if (current?.journalReferenceId) {
        try {
          await serverApi.accounts.deleteManualJournal(
            current.journalReferenceId,
            "payment",
          );
        } catch {
          /* ignore */
        }
      }

      const res = await api.delete(`/payment-vouchers/${selectedId}`);
      if (!res.data.success) return alert("فشل حذف السند");

      await loadVouchers();
      setSelectedId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "خطأ في حذف السند");
    }
  };

  const openEdit = () => {
    if (!selectedId) return;

    const v = list.find((x) => x.id === selectedId);
    if (!v) return;

    const accountId =
      v.accountId != null
        ? String(v.accountId)
        : accounts.find((a) => a.name_ar === v.account)?.id?.toString() || "";
    const currencyId =
      v.currencyId != null
        ? String(v.currencyId)
        : currencies.find((c) => c.name_ar === v.currency)?.id?.toString() ||
          form.currency_id;
    const cashBoxId =
      v.cashBoxId != null
        ? String(v.cashBoxId)
        : v.cashBox
          ? String(cashBoxes.find((c) => c.name_ar === v.cashBox)?.id || "")
          : "";
    const bankAccountId =
      v.bankAccountId != null
        ? String(v.bankAccountId)
        : v.bankAccount
          ? String(bankAccounts.find((b) => b.name_ar === v.bankAccount)?.id || "")
          : "";

    setForm({
      voucherNo: v.voucherNo,
      date: v.date,
      paymentType: v.paymentType,
      cashBox: cashBoxId,
      bankAccount: bankAccountId,
      transferNo: v.transferNo || "",
      currency_id: currencyId,
      currency: v.currency || form.currency,
      amount: v.amount,
      account: accountId,
      analyticAccount: v.analyticAccount || "",
      costCenter: v.costCenter || "",
      handling: v.handling || "",
      notes: v.notes || "",
      journalTypeId: "",
    });

    setShowModal(true);
  };

  const filtered = list.filter((x) => {
    const matchSearch =
      String(x.voucherNo || "").includes(search) ||
      String(x.account || "").includes(search) ||
      String(x.notes || "").includes(search) ||
      String(x.transferNo || "").includes(search) ||
      String(x.amount || "").includes(search);

    const matchDate = allDates || (x.date && x.date.slice(0, 10) === date);
    return matchSearch && matchDate;
  });

  const printSelected = async () => {
    if (!selectedId) {
      alert("اختر سنداً أولاً");
      return;
    }
    const v = list.find((x) => x.id === selectedId);
    if (!v) return;
    const acc =
      (v.accountId != null
        ? accounts.find((a) => a.id === v.accountId)
        : null) || accounts.find((a) => a.name_ar === v.account);
    const accountNo = acc?.code?.trim() || (v.accountId != null ? String(v.accountId) : "—");
    await printStyledVoucher(
      { name: brandName, logoUrl, phones },
      {
        kind: "payment",
        number: v.voucherNo || String(v.id),
        date: (v.date || "").slice(0, 10).split("-").reverse().join("/") || v.date,
        partyLabel: "المستفيد",
        partyName: v.account || "—",
        accountLabel: "رقم الحساب",
        accountValue: accountNo,
        amount: Number(v.amount) || 0,
        currency: v.currency || "ريال سعودي",
        description:
          v.notes ||
          (v.paymentType === "cash"
            ? `صرف نقدي — ${v.cashBox || "صندوق"}`
            : `صرف بنكي — ${v.bankAccount || "بنك"}${v.transferNo ? ` — حوالة ${v.transferNo}` : ""}`),
        note: v.handling ? `عمولة/مناولة: ${v.handling}` : "",
      },
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between rounded-lg bg-[#e9efe6] p-4">
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-green">
            إضافة
          </button>
          <button
            onClick={openEdit}
            disabled={!selectedId}
            className={`btn-gray ${!selectedId ? "cursor-not-allowed opacity-50" : ""}`}
          >
            تعديل
          </button>
          <button
            onClick={remove}
            disabled={!selectedId}
            className={`btn-red ${!selectedId ? "cursor-not-allowed opacity-50" : ""}`}
          >
            حذف
          </button>
          <button
            onClick={() => void printSelected()}
            disabled={!selectedId}
            className={`btn-gray ${!selectedId ? "cursor-not-allowed opacity-50" : ""}`}
          >
            طباعة
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <input
          placeholder="بحث..."
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

      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border border-gray-200 px-2 py-1">رقم السند</th>
              <th className="border border-gray-200 px-2 py-1">التاريخ</th>
              <th className="border border-gray-200 px-2 py-1">نوع الصرف</th>
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
                    {getPaymentTypeName(v)}
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
                <td colSpan={12} className="border border-gray-200 py-6 text-gray-400">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[760px] space-y-4 rounded-xl bg-[#eef3ee] p-6">
            <h3 className="text-center text-lg font-bold">
              {selectedId ? "تعديل سند صرف" : "إضافة سند صرف"}
            </h3>

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
                value={form.paymentType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paymentType: e.target.value as PaymentType,
                    cashBox: "",
                    bankAccount: "",
                    transferNo: "",
                  })
                }
              >
                <option value="">-- نوع الصرف --</option>
                <option value="cash">نقد</option>
                <option value="bank">بنوك</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {form.paymentType === "cash" && (
                <select
                  className="input"
                  value={form.cashBox}
                  onChange={(e) => setForm({ ...form, cashBox: e.target.value })}
                >
                  <option value="">-- اختر الصندوق --</option>
                  {cashBoxes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar}
                    </option>
                  ))}
                </select>
              )}

              {form.paymentType === "bank" && (
                <>
                  <select
                    className="input"
                    value={form.bankAccount}
                    onChange={(e) =>
                      setForm({ ...form, bankAccount: e.target.value })
                    }
                  >
                    <option value="">-- اختر حساب البنك --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name_ar}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="رقم الحوالة (اختياري)"
                    className="input"
                    value={form.transferNo}
                    onChange={(e) =>
                      setForm({ ...form, transferNo: e.target.value })
                    }
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

            <textarea
              className="input w-full"
              placeholder="البيان"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <div className="border-t pt-3">
              <button
                onClick={() => setShowExtra(!showExtra)}
                className="flex w-full items-center justify-between font-semibold acc-link"
              >
                <span>الخيارات الإضافية</span>
                <span>{showExtra ? "▾" : "▸"}</span>
              </button>

              {showExtra && (
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <select
                    className="input"
                    value={form.journalTypeId}
                    onChange={(e) =>
                      setForm({ ...form, journalTypeId: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, analyticAccount: e.target.value })
                    }
                  />
                  <input
                    placeholder="مركز التكلفة"
                    className="input"
                    value={form.costCenter}
                    onChange={(e) =>
                      setForm({ ...form, costCenter: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setShowModal(false)} className="btn-gray">
                إلغاء
              </button>
              <button
                onClick={selectedId ? updateVoucher : addVoucher}
                className="btn-green"
              >
                {selectedId ? "حفظ التعديل" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaymentVoucher;
