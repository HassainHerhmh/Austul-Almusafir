import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { serverApi } from '../../../../api/serverApi';
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
  account_id?: number;
  account_name: string;
  parent_account_id?: number | null;
  parent_account_name?: string | null;
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
  parent_id?: number | null;
  account_level?: string;
};

/** كل حسابات الأصول الأب (رئيسي أو لها أبناء) لاختيار أب الصندوق */
function assetParentAccounts(list: any[]): Account[] {
  const rows = list.map((a) => ({
    id: Number(a.id),
    code: String(a.code ?? ""),
    name_ar: a.name_ar ?? a.nameAr ?? "",
    parent_id: a.parent_id ?? a.parentId ?? null,
    account_level: a.account_level ?? a.accountLevel ?? "",
  }));
  const byId = new Map(rows.map((a) => [a.id, a]));
  const assetsRoot =
    rows.find((a) => a.code === "1") ||
    rows.find((a) => a.name_ar === "الأصول");

  const underAssets = (a: Account) => {
    if (!assetsRoot) return a.code === "1" || a.code.startsWith("1");
    let cur: Account | undefined = a;
    while (cur) {
      if (cur.id === assetsRoot.id) return true;
      cur =
        cur.parent_id != null ? byId.get(Number(cur.parent_id)) : undefined;
    }
    return false;
  };

  const parentIds = new Set(
    rows.map((a) => a.parent_id).filter((id): id is number => id != null),
  );

  const seen = new Set<string>();
  return rows
    .filter(
      (a) =>
        underAssets(a) &&
        (a.account_level === "رئيسي" || parentIds.has(a.id)),
    )
    .filter((a) => {
      const key = a.code || String(a.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, "ar"));
}

function enrichWithParent(
  boxes: CashBox[],
  chart: any[],
): CashBox[] {
  const byId = new Map(chart.map((a) => [Number(a.id), a]));
  return boxes.map((c) => {
    if (c.parent_account_name) return c;
    const leaf =
      (c.account_id != null ? byId.get(Number(c.account_id)) : null) ||
      chart.find(
        (a) =>
          a.name_ar === c.name_ar ||
          a.name_ar === c.account_name ||
          a.code === c.code,
      );
    if (!leaf) return c;
    const parentId = leaf.parent_id ?? leaf.parentId;
    const parent = parentId != null ? byId.get(Number(parentId)) : null;
    if (!parent) return { ...c, account_id: leaf.id, code: leaf.code || c.code };
    return {
      ...c,
      account_id: leaf.id,
      code: leaf.code || c.code,
      account_name: leaf.name_ar,
      parent_account_id: parent.id,
      parent_account_name: `${parent.code} — ${parent.name_ar}`,
    };
  });
}

/* =========================
   Component
========================= */
const CashBoxes: React.FC = () => {
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [groups, setGroups] = useState<CashBoxGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [chart, setChart] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    code: "",
    cash_box_group_id: "",
    parent_account_id: "",
  });

  const loadCashBoxes = async () => {
    const res = await api.get("/cash-boxes", { params: { search } });
    if (!res.data.success) return;
    const list = res.data.list || res.data.cashBoxes || [];
    let chartRows = chart;
    if (!chartRows.length) {
      try {
        const r = await serverApi.accounts.list();
        chartRows = r.list ?? [];
        setChart(chartRows);
        setAccounts(assetParentAccounts(chartRows));
      } catch {
        /* ignore */
      }
    }
    setCashBoxes(enrichWithParent(list, chartRows));
  };

  const loadGroups = async () => {
    const res = await api.get("/cashbox-groups");
    if (res.data.success) setGroups(res.data.groups);
  };

  const loadAccounts = async () => {
    try {
      const res = await serverApi.accounts.list();
      setChart(res.list ?? []);
      setAccounts(assetParentAccounts(res.list ?? []));
    } catch {
      const res = await api.get("/accounts/main-for-cashboxes");
      if (res.data.success) {
        const rows = res.data.accounts || res.data.list || [];
        setAccounts(assetParentAccounts(rows));
      }
    }
  };

  useEffect(() => {
    loadCashBoxes();
  }, [search]);

  useEffect(() => {
    loadGroups();
    loadAccounts().then(() => loadCashBoxes());
  }, []);

  const saveCashBox = async () => {
    if (!form.name_ar || !form.cash_box_group_id) {
      alert("يرجى تعبئة الحقول المطلوبة");
      return;
    }

    try {
      setBusy(true);
      if (editId) {
        await api.put(`/cash-boxes/${editId}`, {
          name_ar: form.name_ar,
          name_en: form.name_en || null,
          cash_box_group_id: Number(form.cash_box_group_id),
        });
      } else {
        if (!form.parent_account_id) {
          alert("يرجى اختيار حساب الأب");
          return;
        }

        const parent = accounts.find(
          (a) => String(a.id) === form.parent_account_id,
        );
        if (!parent) {
          alert("حساب الأب غير موجود");
          return;
        }

        // إنشاء الحساب الفرعي في دليل السيرفر ليظهر في الشجرة والجدول
        const created = await serverApi.accounts.create({
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim() || null,
          parent_id: Number(form.parent_account_id),
          account_level: "فرعي",
          financial_statement: "الميزانية العمومية",
        });
        const account = (created as any).account;
        if (!account?.id) {
          alert("تعذر إنشاء الحساب في الدليل");
          return;
        }

        const user = JSON.parse(
          localStorage.getItem("card-platform-user") || "{}",
        );

        await api.post("/cash-boxes", {
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim() || null,
          cash_box_group_id: Number(form.cash_box_group_id),
          parent_account_id: Number(form.parent_account_id),
          parent_account_name: `${parent.code} — ${parent.name_ar}`,
          account_id: account.id,
          account_code: account.code,
          account_name: account.name_ar,
          created_by: user.id || null,
        });

        await loadAccounts();
      }

      closeModal();
      await loadCashBoxes();
    } catch (err: any) {
      alert(
        err?.message ||
          err.response?.data?.message ||
          "حدث خطأ أثناء الحفظ",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteCashBox = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await api.delete(`/cash-boxes/${id}`);
      loadCashBoxes();
    } catch (err: any) {
      alert(err.response?.data?.message || "لا يمكن الحذف");
    }
  };

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
      parent_account_id: c.parent_account_id
        ? String(c.parent_account_id)
        : "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الصناديق النقدية</h1>

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
            onClick={() => {
              void loadAccounts().then(() => loadCashBoxes());
            }}
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

      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">مجموعة الصناديق</th>
              <th className="border px-3 py-2">حساب الأب</th>
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
                <td className="border px-3 py-2">
                  {c.parent_account_name || "-"}
                </td>
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
                  الرقم يتولد تلقائيًا من تسلسل الحسابات عند الحفظ، ويظهر الصندوق في الدليل تحت حساب الأب
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
                    حساب الأب
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
              <button onClick={closeModal} disabled={busy}>
                إلغاء
              </button>
              <button
                onClick={() => void saveCashBox()}
                disabled={busy}
                className="acc-btn acc-btn-primary px-4 py-2 rounded"
              >
                {busy ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashBoxes;
