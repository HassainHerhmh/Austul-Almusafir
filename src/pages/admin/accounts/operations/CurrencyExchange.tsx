import React, { useEffect, useMemo, useState } from "react";
import api from '../../../../api/accountingApi';

type Currency = {
  id: number;
  name_ar: string;
  code: string;
  exchange_rate: number;
  min_rate?: number | null;
  max_rate?: number | null;
  convert_mode?: "multiply" | "divide";
};

type Account = {
  id: number;
  name_ar: string;
};

type Row = {
  id: number;
  date: string;
  type: "buy" | "sell";
  from_text: string;
  to_text: string;
  rate: number;
  notes: string;
};

const today = new Date().toLocaleDateString("en-CA");

const CurrencyExchange: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"buy" | "sell" | "">("");

  const [date, setDate] = useState(today);

  // تفاصيل الشراء / البيع
  const [fromCurrency, setFromCurrency] = useState<number | "">("");
  const [fromRate, setFromRate] = useState("");
  const [fromAmount, setFromAmount] = useState("");

  // تفاصيل القيمة
  const [toCurrency, setToCurrency] = useState<number | "">("");
  const [toRate, setToRate] = useState("");
  const [toAmount, setToAmount] = useState("");

  const [fromAccount, setFromAccount] = useState<number | "">("");
  const [toAccount, setToAccount] = useState<number | "">("");

  const [fromType, setFromType] = useState<"cash" | "account">("cash");
  const [toType, setToType] = useState<"cash" | "account">("cash");
  const [reference, setReference] = useState<number>(() => Date.now());

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const [cRes, aRes] = await Promise.all([
        api.get("/currencies"),
        api.get("/accounts"),
      ]);
      setCurrencies(cRes.data?.currencies || []);
      setAccounts(aRes.data?.list || []);
    })();
  }, []);

  const fromCur = useMemo(
    () => currencies.find((c) => c.id === Number(fromCurrency)),
    [fromCurrency, currencies]
  );

  const toCur = useMemo(
    () => currencies.find((c) => c.id === Number(toCurrency)),
    [toCurrency, currencies]
  );

  // تعبئة سعر الصرف لقسم الشراء فقط
  useEffect(() => {
    if (!fromCur) return;
    setFromRate(String(fromCur.exchange_rate || ""));
  }, [fromCur]);

  // تعبئة سعر الصرف لقسم القيمة فقط
  useEffect(() => {
    if (!toCur) return;
    setToRate(String(toCur.exchange_rate || ""));
  }, [toCur]);

  

  const resetForm = () => {
    setReference(Date.now());
    setMode("");
    setFromCurrency("");
    setToCurrency("");
    setFromRate("");
    setToRate("");
    setFromAmount("");
    setToAmount("");
    setFromAccount("");
    setToAccount("");
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setDate(today);
    setFromType("cash");
    setToType("cash");
  };

const submit = async () => {
  if (!mode || !fromCurrency || !toCurrency || !fromAmount || !fromRate) {
    alert("يرجى إدخال جميع البيانات الأساسية");
    return;
  }
  if (!fromAccount || !toAccount) {
    alert("يرجى اختيار الصندوق/الحساب للطرفين");
    return;
  }

  const payload = {
    reference,
    date,
    type: mode,

    from_currency: fromCurrency,
    from_amount: fromAmount,
    from_rate: fromRate,
    from_account: fromAccount,

    to_currency: toCurrency,
    to_amount: toAmount,
    to_rate: toRate,
    to_account: toAccount,

    customer_name: customerName,
    customer_phone: customerPhone,
    notes,
  };

  try {
    await api.post("/currency-exchange", payload);

    // الإضافة للواجهة بعد نجاح السيرفر فقط
    setRows((p) => [
      {
        id: reference,
        date,
        type: mode,
        from_text: `${fromAmount}`,
        to_text: `${toAmount}`,
        rate: Number(fromRate),
        notes: notes || (mode === "buy" ? "شراء عملة" : "بيع عملة"),
      },
      ...p,
    ]);

    setShowModal(false);
    resetForm();
  } catch (e) {
    alert("فشل حفظ العملية في السيرفر");
  }
};



  
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">مصارفة عملة</h2>
        <button
          onClick={() => setShowModal(true)}
          className="acc-btn acc-btn-primary px-4 py-2 rounded"
        >
          إضافة
        </button>
      </div>

      {/* جدول العمليات */}
      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border px-2 py-1">رقم</th>
              <th className="border px-2 py-1">التاريخ</th>
              <th className="border px-2 py-1">مدين</th>
              <th className="border px-2 py-1">دائن</th>
              <th className="border px-2 py-1">النوع</th>
              <th className="border px-2 py-1">سعر الصرف</th>
              <th className="border px-2 py-1">البيان</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="border px-2 py-1">{r.id}</td>
                  <td className="border px-2 py-1">{r.date}</td>
                  <td className="border px-2 py-1">{r.from_text}</td>
                  <td className="border px-2 py-1">{r.to_text}</td>
                  <td className="border px-2 py-1">
                    {r.type === "buy" ? "شراء" : "بيع"}
                  </td>
                  <td className="border px-2 py-1">{r.rate}</td>
                  <td className="border px-2 py-1">{r.notes}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-gray-400 border">
                  لا توجد عمليات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
    <div className="acc-modal-panel rounded-lg p-4 w-[700px] space-y-3">

      {/* اختيار نوع العملية */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode("buy")}
          className={`p-2 rounded border ${mode === "buy" ? "acc-btn acc-btn-primary" : "acc-btn acc-btn-outline"}`}
        >
          شراء
        </button>
        <button
          onClick={() => setMode("sell")}
          className={`p-2 rounded border ${mode === "sell" ? "acc-btn acc-btn-primary" : "acc-btn acc-btn-outline"}`}
        >
          بيع
        </button>
      </div>

      {/* الهيدر الموحد: رقم السند + العنوان + التاريخ */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border mb-3">
        <div className="text-sm text-gray-600">
          رقم السند: <span className="font-bold">{reference}</span>
        </div>

        <h3 className="font-bold text-lg acc-link">
          {mode === "buy" ? "شراء عملة" : mode === "sell" ? "بيع عملة" : "عملية جديدة"}
        </h3>

        <input
          type="date"
          className="border rounded p-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

     {/* تفاصيل الشراء/البيع */}
<div className="bg-[#eef3ea] p-4 rounded-lg space-y-3">
  <h4 className="font-bold acc-link text-center">
    {mode === "buy" ? "تفاصيل الشراء" : "تفاصيل البيع"}
  </h4>

  <select
    className="input"
    value={fromType}
    onChange={(e) => {
      setFromType(e.target.value as any);
      setFromAccount("");
    }}
  >
    <option value="cash">صندوق</option>
    <option value="account">حساب</option>
  </select>

  <div className="grid grid-cols-2 gap-2">
    <select
      className="input"
      value={fromCurrency}
      onChange={(e) => setFromCurrency(Number(e.target.value))}
    >
      <option value="">العملة</option>
      {currencies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name_ar}
        </option>
      ))}
    </select>

    <select
      className="input"
      value={fromAccount}
      onChange={(e) => setFromAccount(Number(e.target.value))}
    >
      <option value="">
        {fromType === "cash" ? "اختر الصندوق" : "اختر الحساب"}
      </option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name_ar}
        </option>
      ))}
    </select>
  </div>

<div className="grid grid-cols-3 gap-2">
  <input
    className="input"
    placeholder="المبلغ"
    value={fromAmount}
    onChange={(e) => setFromAmount(e.target.value)}
  />
  <input
    className="input"
    placeholder="سعر الصرف"
    value={fromRate}
    onChange={(e) => setFromRate(e.target.value)}
  />
  <input
    className="input bg-gray-100"
    disabled
    value={
      fromAmount && fromRate
        ? (Number(fromAmount) * Number(fromRate)).toFixed(2)
        : ""
    }
    placeholder="المقابل"
  />
</div>

</div>

{/* تفاصيل القيمة */}
<div className="bg-[#eef3ea] p-4 rounded-lg space-y-3">
  <h4 className="font-bold acc-link text-center">تفاصيل القيمة</h4>

  <select
    className="input"
    value={toType}
    onChange={(e) => {
      setToType(e.target.value as any);
      setToAccount("");
    }}
  >
    <option value="cash">صندوق</option>
    <option value="account">حساب</option>
  </select>

  <div className="grid grid-cols-2 gap-2">
    <select
      className="input"
      value={toCurrency}
      onChange={(e) => setToCurrency(Number(e.target.value))}
    >
      <option value="">عملة القيمة</option>
      {currencies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name_ar}
        </option>
      ))}
    </select>

    <select
      className="input"
      value={toAccount}
      onChange={(e) => setToAccount(Number(e.target.value))}
    >
      <option value="">
        {toType === "cash" ? "اختر الصندوق" : "اختر الحساب"}
      </option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name_ar}
        </option>
      ))}
    </select>
  </div>
<div className="grid grid-cols-3 gap-2">
  <input
    className="input"
    placeholder="المبلغ"
    value={toAmount}
    onChange={(e) => setToAmount(e.target.value)}
  />
  <input
    className="input"
    placeholder="سعر الصرف"
    value={toRate}
    onChange={(e) => setToRate(e.target.value)}
  />
  <input
    className="input bg-gray-100"
    disabled
    value={
      toAmount && toRate
        ? (Number(toAmount) * Number(toRate)).toFixed(2)
        : ""
    }
    placeholder="المقابل"
  />
</div>

</div>


            {/* بيانات إضافية */}
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="اسم العميل"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="input"
                placeholder="رقم الهاتف"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <input
              className="input w-full"
              placeholder="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                إلغاء
              </button>
              <button
                onClick={submit}
                className="acc-btn acc-btn-primary px-4 py-2 rounded"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input { padding:10px; border-radius:8px; border:1px solid #ccc; }
      `}</style>
    </div>
  );
};

export default CurrencyExchange;
