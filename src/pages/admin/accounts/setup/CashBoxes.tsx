import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Types
========================= */
type CashBox = {
  id: number;
  name_ar: string;
  name_en: string | null;
  code: string;
  cashbox_group_name: string;
  account_name: string;
  user_name: string | null;
  branch_name: string | null;
};

type CashBoxGroup = {
  id: number;
  name_ar: string;
};

type Account = {
  id: number;
  code: string;
  name_ar: string;
};

/* =========================
   Component
========================= */
const CashBoxes: React.FC = () => {
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [groups, setGroups] = useState<CashBoxGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    code: "",
    cash_box_group_id: "",
    parent_account_id: "",
  });

  /* =========================
     Load Data
  ========================= */
 const loadCashBoxes = async () => {
  const res = await api.get("/cash-boxes", { params: { search } });
  if (res.data.success) {
    setCashBoxes(res.data.list || res.data.cashBoxes || []);
  }
};


  const loadGroups = async () => {
    const res = await api.get("/cashbox-groups");
    if (res.data.success) setGroups(res.data.groups);
  };

  const loadAccounts = async () => {
    const res = await api.get("/accounts/main-for-cashboxes");
    if (res.data.success) setAccounts(res.data.accounts);
  };

  useEffect(() => {
    loadCashBoxes();
  }, [search]);

  useEffect(() => {
    loadGroups();
    loadAccounts();
  }, []);

  /* =========================
     Save (Add / Edit)
  ========================= */
  const saveCashBox = async () => {
    if (!form.name_ar || !form.cash_box_group_id) {
      alert("يرجى تعبئة الحقول المطلوبة");
      return;
    }

    try {
      if (editId) {
        await api.put(`/cash-boxes/${editId}`, {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          cash_box_group_id: Number(form.cash_box_group_id),
        });
      } else {
        if (!form.parent_account_id) {
          alert("يرجى تعبئة جميع الحقول المطلوبة");
          return;
        }

        const user = JSON.parse(localStorage.getItem("card-platform-user") || "{}");

        await api.post("/cash-boxes", {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          cash_box_group_id: Number(form.cash_box_group_id),
          parent_account_id: Number(form.parent_account_id),
          created_by: user.id || null,
        });
      }

      closeModal();
      loadCashBoxes();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ");
    }
  };

  /* =========================
     Delete
  ========================= */
  const deleteCashBox = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await api.delete(`/cash-boxes/${id}`);
      loadCashBoxes();
    } catch (err: any) {
      alert(err.response?.data?.message || "لا يمكن الحذف");
    }
  };

  /* =========================
     Helpers
  ========================= */
  const openAdd = () => {
    setEditId(null);
    setForm({
      name_ar: "",
      name_en: "",
      code: "",
      cash_box_group_id: "",
      parent_account_id: "",
    });
    setShowModal(true);
  };

  const openEdit = (c: CashBox) => {
    setEditId(c.id);
    setForm({
      name_ar: c.name_ar,
      name_en: c.name_en || "",
      code: c.code,
      cash_box_group_id:
        groups.find((g) => g.name_ar === c.cashbox_group_name)?.id.toString() ||
        "",
      parent_account_id: "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الصناديق النقدية</h1>

      {/* ===== Tools ===== */}
      <div className="flex justify-between items-center">
        <input
          placeholder="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-lg w-64"
        />

        <div className="flex gap-2">
          <button
            onClick={openAdd}
            className="acc-btn acc-btn-primary px-4 py-2 rounded"
          >
            ➕ إضافة
          </button>
          <button
            onClick={loadCashBoxes}
            className="acc-btn acc-btn-primary px-4 py-2 rounded"
          >
            🔄 تحديث
          </button>
          <button
            onClick={() => window.print()}
            className="acc-btn acc-btn-secondary px-4 py-2 rounded"
          >
            🖨️ طباعة
          </button>
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">مجموعة الصناديق</th>
              <th className="border px-3 py-2">الحساب المحاسبي</th>
              <th className="border px-3 py-2">الفرع</th>
              <th className="border px-3 py-2">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {cashBoxes.map((c) => (
              <tr key={c.id}>
                <td className="border px-3 py-2">{c.name_ar}</td>
                <td className="border px-3 py-2">{c.name_en || "-"}</td>
                <td className="border px-3 py-2">{c.code}</td>
                <td className="border px-3 py-2">{c.cashbox_group_name}</td>
                <td className="border px-3 py-2">{c.account_name}</td>
                <td className="border px-3 py-2">
                  {c.branch_name || DEFAULT_BRANCH_NAME}
                </td>
                <td className="border px-3 py-2 space-x-2">
                  <button onClick={() => openEdit(c)}>✏️</button>
                  <button onClick={() => deleteCashBox(c.id)}>🗑️</button>
                </td>
              </tr>
            ))}

            {!cashBoxes.length && (
              <tr>
                <td colSpan={7} className="py-6 text-gray-500">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Modal ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[#eef4ee] p-6 rounded w-[420px] space-y-2">
            <h2 className="text-xl font-bold text-center mb-3">
              {editId ? "تعديل صندوق نقدي" : "إضافة صندوق نقدي"}
            </h2>

            <input
              className="border p-2 w-full rounded"
              placeholder="الاسم"
              value={form.name_ar}
              onChange={(e) =>
                setForm({ ...form, name_ar: e.target.value })
              }
            />

            <input
              className="border p-2 w-full rounded"
              placeholder="الاسم الأجنبي"
              value={form.name_en}
              onChange={(e) =>
                setForm({ ...form, name_en: e.target.value })
              }
            />

            {!editId && (
              <>
                <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-2 text-right text-sm text-gray-500">
                  الرقم يتولد تلقائيًا من تسلسل الحسابات عند الحفظ
                </div>

                <select
                  className="border p-2 w-full rounded"
                  value={form.parent_account_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parent_account_id: e.target.value,
                    })
                  }
                >
                  <option value="" hidden>
                    الحساب المحاسبي (الأب)
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name_ar}
                    </option>
                  ))}
                </select>
              </>
            )}

            <select
              className="border p-2 w-full rounded"
              value={form.cash_box_group_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  cash_box_group_id: e.target.value,
                })
              }
            >
              <option value="" hidden>
                مجموعة الصناديق
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name_ar}
                </option>
              ))}
            </select>

            <div className="flex justify-between pt-2">
              <button onClick={closeModal}>إلغاء</button>
              <button
                onClick={saveCashBox}
                className="acc-btn acc-btn-primary px-4 py-2 rounded"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashBoxes;
