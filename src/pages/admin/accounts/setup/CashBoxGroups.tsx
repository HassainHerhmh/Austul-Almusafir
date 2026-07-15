import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Types
========================= */
type CashBoxGroup = {
  id: number;
  name_ar: string;
  name_en: string | null;
  code: number;
  user_name: string | null;
  branch_name: string | null;
};

const CashBoxGroups: React.FC = () => {
  const [groups, setGroups] = useState<CashBoxGroup[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    code: "",
  });

  /* =========================
     Load Data
  ========================= */
  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get("/cashbox-groups", {
        params: { search },
      });
      if (res.data.success) {
        setGroups(res.data.groups);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [search]);

  /* =========================
     Add / Update
  ========================= */
  const saveGroup = async () => {
    if (!form.name_ar || (!editId && !form.code)) {
      alert("الاسم والرقم مطلوبان");
      return;
    }

    try {
      if (editId) {
        // تعديل
        await api.put(`/cashbox-groups/${editId}`, {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
        });
      } else {
        // إضافة
        await api.post("/cashbox-groups", {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          code: Number(form.code),
        });
      }

      setShowModal(false);
      setEditId(null);
      setForm({ name_ar: "", name_en: "", code: "" });
      loadGroups();
    } catch (err: any) {
      alert(err.response?.data?.message || "حدث خطأ");
    }
  };

  /* =========================
     Delete
  ========================= */
  const deleteGroup = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;

    try {
      await api.delete(`/cashbox-groups/${id}`);
      loadGroups();
    } catch (err: any) {
      alert(err.response?.data?.message || "لا يمكن حذف هذه المجموعة");
    }
  };

  /* =========================
     Edit
  ========================= */
  const openEdit = (g: CashBoxGroup) => {
    setEditId(g.id);
    setForm({
      name_ar: g.name_ar,
      name_en: g.name_en || "",
      code: String(g.code),
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">مجموعة الصناديق</h1>

      {/* Tools */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditId(null);
              setForm({ name_ar: "", name_en: "", code: "" });
              setShowModal(true);
            }}
            className="acc-btn acc-btn-primary px-4 py-2 rounded"
          >
            ➕ إضافة
          </button>

          <button
            onClick={loadGroups}
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

      {/* Table */}
      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">الفرع</th>
              <th className="border px-3 py-2">المستخدم</th>
              <th className="border px-3 py-2">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr
                key={g.id}
                className={i % 2 === 0 ? "" : "acc-row-alt"}
              >
                <td className="border px-3 py-2">{g.name_ar}</td>
                <td className="border px-3 py-2">{g.name_en || "-"}</td>
                <td className="border px-3 py-2">{g.code}</td>
                <td className="border px-3 py-2">
                  {g.branch_name || DEFAULT_BRANCH_NAME}
                </td>
                <td className="border px-3 py-2">
                  {g.user_name || "-"}
                </td>
                <td className="border px-3 py-2 space-x-2">
                  <button onClick={() => openEdit(g)}>✏️</button>
                  <button
                    onClick={() => deleteGroup(g.id)}
                    className="text-red-600"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}

            {!groups.length && !loading && (
              <tr>
                <td colSpan={6} className="py-6 text-gray-500">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[#eef4ee] p-6 rounded w-[420px] space-y-3">
            <h2 className="text-xl font-bold text-center">
              {editId ? "تعديل مجموعة صناديق" : "إضافة مجموعة صناديق"}
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

            <input
              className="border p-2 w-full rounded"
              placeholder="الرقم"
              value={form.code}
              disabled={!!editId}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value })
              }
            />

            <div className="flex justify-between pt-2">
              <button onClick={() => setShowModal(false)}>إلغاء</button>
              <button
                onClick={saveGroup}
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

export default CashBoxGroups;
