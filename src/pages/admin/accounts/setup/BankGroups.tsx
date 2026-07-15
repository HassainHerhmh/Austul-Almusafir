import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Types
========================= */
type BankGroup = {
  id: number;
  name_ar: string;
  name_en: string;
  code: string;
  user_name?: string;
  branch?: string;
};

/* =========================
   Component
========================= */
const BankGroups: React.FC = () => {
  const [groups, setGroups] = useState<BankGroup[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // ✅ الرقم التلقائي
  const [autoCode, setAutoCode] = useState("");

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
  });

  /* =========================
     Load Data
  ========================= */
  const loadGroups = async () => {
    try {
      const res = await api.get(`/bank-groups?search=${search}`);
      if (res.data.success) setGroups(res.data.groups);
    } catch (err) {
      console.error("Load bank groups error:", err);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [search]);

  /* =========================
     Get Auto Code
  ========================= */
  const loadNextCode = async () => {
    try {
      const res = await api.get("/bank-groups/next-code");

      if (res.data?.success) {
        setAutoCode(String(res.data.nextCode));
      }
    } catch (err) {
      console.error("Load next code error:", err);
    }
  };

  /* =========================
     Reset Form
  ========================= */
  const resetForm = () => {
    setForm({
      name_ar: "",
      name_en: "",
    });

    setAutoCode("");
    setEditId(null);
  };

  /* =========================
     Open Add
  ========================= */
  const openAdd = async () => {
    resetForm();
    await loadNextCode();
    setShowModal(true);
  };

  /* =========================
     Add / Edit
  ========================= */
  const handleSubmit = async () => {
    if (!form.name_ar) {
      alert("الاسم مطلوب");
      return;
    }

    try {
      if (editId) {
        await api.put(`/bank-groups/${editId}`, {
          ...form,
          code: autoCode,
        });
      } else {
        await api.post("/bank-groups", {
          ...form,
          code: autoCode,
        });
      }

      setShowModal(false);
      resetForm();
      loadGroups();
    } catch (err) {
      console.error("Save bank group error:", err);
      alert("حصل خطأ أثناء الحفظ");
    }
  };

  /* =========================
     Edit
  ========================= */
  const handleEdit = (g: BankGroup) => {
    setEditId(g.id);

    setForm({
      name_ar: g.name_ar,
      name_en: g.name_en || "",
    });

    setAutoCode(g.code);

    setShowModal(true);
  };

  /* =========================
     Delete
  ========================= */
  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;

    try {
      await api.delete(`/bank-groups/${id}`);
      loadGroups();
    } catch (err) {
      console.error("Delete bank group error:", err);
      alert("فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area,
          #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            inset: 0;
            padding: 20px;
          }
          #print-area button {
            display: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #000;
            padding: 6px;
            text-align: center;
          }
          th {
            background: #e5e7eb !important;
            color: #000 !important;
          }
        }
      `}</style>

      <h1 className="text-2xl font-bold">مجموعة البنوك</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2"
        />

        <div className="flex gap-2">
          <button
            onClick={openAdd}
            className="acc-btn acc-btn-primary rounded-lg px-4 py-2"
          >
            ➕ إضافة
          </button>

          <button
            onClick={loadGroups}
            className="acc-btn acc-btn-primary rounded-lg px-4 py-2"
          >
            🔄 تحديث
          </button>

          <button
            onClick={() => window.print()}
            className="acc-btn acc-btn-secondary rounded-lg px-4 py-2"
          >
            🖨️ طباعة
          </button>
        </div>
      </div>

      <div
        id="print-area"
        className="acc-table-wrap"
      >
        <table className="acc-table">
          <thead>
            <tr>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">المستخدم</th>
              <th className="border px-3 py-2">اسم الفرع</th>
              <th className="border px-3 py-2">الإجراءات</th>
            </tr>
          </thead>

          <tbody>
            {groups.map((g, index) => (
              <tr
                key={g.id}
                className={index % 2 === 0 ? "" : "acc-row-alt"}
              >
                <td className="border px-3 py-2">{g.name_ar}</td>
                <td className="border px-3 py-2">{g.name_en || "-"}</td>
                <td className="border px-3 py-2 text-center">{g.code}</td>
                <td className="border px-3 py-2">{g.user_name || "-"}</td>
                <td className="border px-3 py-2">{g.branch || DEFAULT_BRANCH_NAME}</td>

                <td className="border px-3 py-2 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(g)}
                      className="acc-link hover:opacity-80"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => handleDelete(g.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!groups.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-[#eef4ee] p-6">

            <h2 className="mb-4 text-center text-xl font-bold">
              {editId ? "تعديل مجموعة بنك" : "إضافة مجموعة بنك"}
            </h2>

            <div className="space-y-3">

              <input
                placeholder="الاسم"
                className="w-full rounded-lg border px-3 py-2"
                value={form.name_ar}
                onChange={(e) =>
                  setForm({ ...form, name_ar: e.target.value })
                }
              />

              <input
                placeholder="الاسم الأجنبي"
                className="w-full rounded-lg border px-3 py-2"
                value={form.name_en}
                onChange={(e) =>
                  setForm({ ...form, name_en: e.target.value })
                }
              />

              {/* الرقم التلقائي */}
              <input
                disabled
                className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-600"
                value={autoCode}
                placeholder="رقم تلقائي"
              />
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setShowModal(false)}>إلغاء</button>

              <button
                onClick={handleSubmit}
                className="acc-btn acc-btn-primary rounded-lg px-6 py-2"
              >
                {editId ? "تعديل" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BankGroups;
