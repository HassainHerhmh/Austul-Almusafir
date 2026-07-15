import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Types
========================= */
type ReceiptType = {
  id: number;
  code: number;
  name_ar: string;
  name_en: string | null;
  sort_order: number;
  branch_name?: string; // 🆕 اسم الفرع
};

const ReceiptTypes: React.FC = () => {
  const [rows, setRows] = useState<ReceiptType[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState({
    code: "",
    name_ar: "",
    name_en: "",
    sort_order: "",
  });

  /* =========================
     Load Data
  ========================= */
  const loadData = async () => {
    const res = await api.get("/receipt-types", {
      params: { search },
    });

    if (res.data.success) {
      setRows(res.data.list);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  /* =========================
     Add / Update
  ========================= */
  const save = async () => {
    if (!form.name_ar.trim()) {
      alert("الاسم مطلوب");
      return;
    }

    try {
      if (editId) {
        const payload: {
          name_ar: string;
          name_en: string | null;
          sort_order?: number;
        } = {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
        };

        if (form.sort_order.trim()) {
          payload.sort_order = Number(form.sort_order);
        }

        await api.put(`/receipt-types/${editId}`, payload);
      } else {
        await api.post("/receipt-types", {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        });
      }

      setShowModal(false);
      setEditId(null);
      setForm({
        code: "",
        name_ar: "",
        name_en: "",
        sort_order: "",
      });

      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ");
    }
  };

  /* =========================
     Delete
  ========================= */
  const remove = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;

    try {
      await api.delete(`/receipt-types/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "لا يمكن الحذف");
    }
  };

  /* =========================
     Edit
  ========================= */
  const openEdit = (r: ReceiptType) => {
    setEditId(r.id);
    setForm({
      code: String(r.code),
      name_ar: r.name_ar,
      name_en: r.name_en || "",
      sort_order: String(r.sort_order),
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">أنواع سندات القبض</h1>

      {/* ===== Tools ===== */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditId(null);
              setForm({
                code: "",
                name_ar: "",
                name_en: "",
                sort_order: "",
              });
              setShowModal(true);
            }}
            className="acc-btn acc-btn-primary px-4 py-2 rounded"
          >
            ➕ إضافة
          </button>

          <button
            onClick={loadData}
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

        <input
          placeholder="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-lg w-64"
        />
      </div>

      {/* ===== Table ===== */}
      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الترتيب</th>
              <th className="border px-3 py-2">الفرع</th>
              <th className="border px-3 py-2">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={i % 2 === 0 ? "" : "acc-row-alt"}
              >
                <td className="border px-3 py-2">{r.code}</td>
                <td className="border px-3 py-2">{r.name_ar}</td>
                <td className="border px-3 py-2">{r.name_en || "-"}</td>
                <td className="border px-3 py-2">{r.sort_order}</td>
                <td className="border px-3 py-2">
                  {r.branch_name || DEFAULT_BRANCH_NAME}
                </td>
                <td className="border px-3 py-2 space-x-2">
                  <button onClick={() => openEdit(r)}>✏️</button>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-red-600"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-6 text-gray-500">
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
            <h2 className="text-xl font-bold text-center">
              {editId ? "تعديل نوع سند قبض" : "إضافة نوع سند قبض"}
            </h2>

            {!editId && (
              <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-2 text-right text-sm text-gray-500">
                الرقم يتولد تلقائيًا عند الحفظ
              </div>
            )}

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

            <input
              className="border p-2 w-full rounded"
              placeholder="الترتيب (اختياري)"
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: e.target.value })
              }
            />

            <div className="flex justify-between pt-2">
              <button onClick={() => setShowModal(false)}>إلغاء</button>
              <button
                onClick={save}
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

export default ReceiptTypes;
