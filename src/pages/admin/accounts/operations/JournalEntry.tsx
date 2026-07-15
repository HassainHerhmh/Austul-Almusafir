import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Journal Entry
========================= */

type Account = {
  id: number;
  code?: string;
  name_ar: string;
};

type Currency = {
  id: number;
  name_ar: string;
  code: string;
};

type Row = {
  id: number;
  reference_id: number;      // 🔴 مهم
  reference_type?: string;   // اختياري
  journal_date: string;
  amount: number;
  currency_name: string;
  from_account: string;
  to_account: string;
  notes: string;
  user_name: string;
  branch_name: string;
};

const today = new Date().toLocaleDateString("en-CA");

const JournalEntry: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [notes, setNotes] = useState("");

  const [fromAccount, setFromAccount] = useState("");
  const [fromAccountName, setFromAccountName] = useState("");

  const [toAccount, setToAccount] = useState("");
  const [toAccountName, setToAccountName] = useState("");

  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAccounts();
    fetchCurrencies();
    loadRows();
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) setFiltered(rows);
    else {
      setFiltered(
        rows.filter(
          r =>
            r.from_account.includes(q) ||
            r.to_account.includes(q) ||
            (r.notes || "").includes(q)
        )
      );
    }
  }, [search, rows]);

  const fetchAccounts = async () => {
    const res = await api.get("/accounts/sub-for-ceiling");
    const data = res.data?.list || res.data || [];
    setAccounts(Array.isArray(data) ? data : []);
  };

  const fetchCurrencies = async () => {
    const res = await api.get("/currencies");
    const data =
      res.data?.currencies ||
      res.data?.list ||
      res.data?.data ||
      (Array.isArray(res.data) ? res.data : []);
    setCurrencies(Array.isArray(data) ? data : []);
  };

  const loadRows = async () => {
    const res = await api.get("/journal-entries");
    if (res.data?.success) {
      setRows(res.data.list || []);
      setFiltered(res.data.list || []);
    }
  };

  const resetForm = () => {
    setDate(today);
    setAmount("");
    setCurrencyId("");
    setFromAccount("");
    setFromAccountName("");
    setToAccount("");
    setToAccountName("");
    setNotes("");
    setIsEdit(false);
    setSelectedRow(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = () => {
    if (!selectedRow) {
      alert("حدد قيدًا أولاً");
      return;
    }
    setIsEdit(true);
    setShowModal(true);

    setDate(selectedRow.journal_date.slice(0, 10));
    setAmount(String(selectedRow.amount));
    setNotes(selectedRow.notes || "");
    setFromAccountName(selectedRow.from_account);
    setToAccountName(selectedRow.to_account);
  };

const remove = async () => {
  if (!selectedRow) {
    alert("حدد قيدًا أولاً");
    return;
  }

  if (!selectedRow.reference_id) {
    alert("هذا السطر لا يملك رقم سند صالح");
    return;
  }

  if (!window.confirm("هل أنت متأكد من حذف القيد بالكامل؟")) return;

  try {
    await api.delete(
      `/journal-entries/by-ref/${selectedRow.reference_id}`
    );

    await loadRows();
    setSelectedRow(null);

    alert("تم حذف القيد بالكامل");
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء حذف القيد");
  }
};




  const saveEntry = async () => {
    if (!fromAccount || !toAccount || !amount || !currencyId) {
      alert("يرجى إدخال جميع البيانات");
      return;
    }
const refId = Date.now(); // أو uuid()

const base = {
  journal_type_id: 1,
  reference_type: "manual",
  reference_id: refId,          // 🔴 مهم جداً
  journal_date: date,
  currency_id: Number(currencyId),
  notes: notes || "قيد يومي",
  cost_center_id: null,
};


    await api.post("/journal-entries", {
      ...base,
      account_id: Number(fromAccount),
      debit: Number(amount),
      credit: 0,
    });

    await api.post("/journal-entries", {
      ...base,
      account_id: Number(toAccount),
      debit: 0,
      credit: Number(amount),
    });

    await loadRows();
    setShowModal(false);
    resetForm();
  };

  const AccountInput = ({ value, setValue, setId, placeholder }: any) => {
    const [open, setOpen] = useState(false);

    const list =
      value.trim() === ""
        ? accounts
        : accounts.filter(a =>
            a.name_ar.toLowerCase().includes(value.toLowerCase())
          );

    return (
      <div className="relative w-full">
        <input
          className="input w-full"
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
        />

        {open && (
          <div className="absolute z-50 bg-white border rounded-lg mt-1 w-full max-h-48 overflow-y-auto">
            {list.map(a => (
              <div
                key={a.id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setValue(a.name_ar);
                  setId(String(a.id));
                  setOpen(false);
                }}
              >
                {a.name_ar}
              </div>
            ))}

            {list.length === 0 && (
              <div className="px-3 py-2 text-gray-400">
                لا توجد نتائج
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getCode = (id: string) =>
    accounts.find(a => a.id === Number(id))?.code || "";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-[#e9efe6] p-4 rounded-lg">
        <div className="flex gap-2">
          <button onClick={openAdd} className="btn-green">➕ إضافة</button>
          <button onClick={openEdit} className="btn-gray">✏️ تعديل</button>
          <button onClick={remove} className="btn-red">🗑️ حذف</button>
          <button onClick={loadRows} className="btn-gray">🔄 تحديث</button>
        </div>

        <input
          placeholder="🔍 بحث..."
          className="input w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="acc-table-wrap">
  <table className="acc-table text-center">
    <thead>
      <tr>
        <th className="border px-2 py-1">رقم السند</th>
        <th className="border px-2 py-1">التاريخ</th>
        <th className="border px-2 py-1">المبلغ</th>
        <th className="border px-2 py-1">العملة</th>
        <th className="border px-2 py-1">من حساب</th>
        <th className="border px-2 py-1">إلى حساب</th>
        <th className="border px-2 py-1">ملاحظات</th>
        <th className="border px-2 py-1">المستخدم</th>
        <th className="border px-2 py-1">الفرع</th>
      </tr>
    </thead>
    <tbody>
      {filtered.length ? (
        filtered.map(r => (
          <tr
            key={r.id}
            onClick={() => setSelectedRow(r)}
            className={`cursor-pointer ${
              selectedRow?.id === r.id ? "acc-row-selected" : ""
            }`}
          >
            <td className="border px-2 py-1">{r.reference_id}</td>
            <td className="border px-2 py-1">{r.journal_date}</td>
            <td className="border px-2 py-1">{r.amount}</td>
            <td className="border px-2 py-1">{r.currency_name}</td>
            <td className="border px-2 py-1">{r.from_account}</td>
            <td className="border px-2 py-1">{r.to_account}</td>
            <td className="border px-2 py-1">{r.notes}</td>
            <td className="border px-2 py-1">{r.user_name}</td>
            <td className="border px-2 py-1">{r.branch_name || DEFAULT_BRANCH_NAME}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={9} className="py-6 text-gray-400 border">
            لا توجد بيانات
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>


      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="acc-modal-panel w-[720px] rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-center">
              {isEdit ? "تعديل قيد يومي" : "إضافة قيد يومي"}
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="input" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
                <option value="">-- العملة --</option>
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>{c.name_ar} ({c.code})</option>
                ))}
              </select>
              <input className="input" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <AccountInput value={fromAccountName} setValue={setFromAccountName} setId={setFromAccount} placeholder="الحساب المدين" />
                <input disabled className="input mt-1 bg-gray-100" placeholder="كود الحساب" value={getCode(fromAccount)} />
              </div>
              <div>
                <AccountInput value={toAccountName} setValue={setToAccountName} setId={setToAccount} placeholder="الحساب الدائن" />
                <input disabled className="input mt-1 bg-gray-100" placeholder="كود الحساب" value={getCode(toAccount)} />
              </div>
            </div>

            <textarea className="input" placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="btn-gray"
              >
                إلغاء
              </button>
              <button onClick={saveEntry} className="btn-green">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input { padding:10px; border-radius:8px; border:1px solid #ccc; }
        .btn-green { background:#14532d; color:#fff; padding:8px 16px; border-radius:8px; }
        .btn-gray { background:#e5e7eb; padding:8px 16px; border-radius:8px; }
        .btn-red { background:#dc2626; color:#fff; padding:8px 16px; border-radius:8px; }
      `}</style>
    </div>
  );
};

export default JournalEntry;
