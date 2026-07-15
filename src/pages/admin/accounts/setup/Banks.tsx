import React, { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { serverApi } from '../../../../api/serverApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

/* =========================
   Types
========================= */
type Bank = {
  id: number;
  name_ar: string;
  name_en: string;
  code: string;
  bank_group_name: string;
  account_id?: number;
  account_name: string;
  parent_account_id?: number | null;
  parent_account_name?: string | null;
  user_name: string;
  branch_name: string;
};

type BankGroup = {
  id: number;
  name_ar: string;
};

type Account = {
  id: number;
  code: string;
  name_ar: string;
  parent_id: number | null;
  account_level?: string;
};

function assetParentAccounts(list: any[]): Account[] {
  const rows = list.map((a) => ({
    id: Number(a.id),
    code: String(a.code ?? ""),
    name_ar: a.name_ar ?? a.nameAr ?? "",
    parent_id: (a.parent_id ?? a.parentId ?? null) as number | null,
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

function enrichWithParent(banks: Bank[], chart: any[]): Bank[] {
  const byId = new Map(chart.map((a) => [Number(a.id), a]));
  return banks.map((b) => {
    if (b.parent_account_name) return b;
    const leaf =
      (b.account_id != null ? byId.get(Number(b.account_id)) : null) ||
      chart.find(
        (a) =>
          a.name_ar === b.name_ar ||
          a.name_ar === b.account_name ||
          a.code === b.code,
      );
    if (!leaf) return b;
    const parentId = leaf.parent_id ?? leaf.parentId;
    const parent = parentId != null ? byId.get(Number(parentId)) : null;
    if (!parent) return { ...b, account_id: leaf.id, code: leaf.code || b.code };
    return {
      ...b,
      account_id: leaf.id,
      code: leaf.code || b.code,
      account_name: leaf.name_ar,
      parent_account_id: parent.id,
      parent_account_name: `${parent.code} — ${parent.name_ar}`,
    };
  });
}

const Banks: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankGroups, setBankGroups] = useState<BankGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [chart, setChart] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    bank_group_id: "",
    parent_account_id: "",
  });

  const loadBanks = async () => {
    const data = await api.banks.getBanks({ search });
    if (!data.success) return;
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
    setBanks(enrichWithParent(data.banks || data.list || [], chartRows));
  };

  const loadBankGroups = async () => {
    const data = await api.get("/bank-groups").then((res: { data: any }) => res.data);
    if (data.success) setBankGroups(data.groups);
  };

  const loadAccounts = async () => {
    try {
      const res = await serverApi.accounts.list();
      setChart(res.list ?? []);
      setAccounts(assetParentAccounts(res.list ?? []));
    } catch {
      const data = await api
        .get("/accounts/main-for-banks")
        .then((res: { data: any }) => res.data);
      if (data.success) {
        setAccounts(assetParentAccounts(data.accounts || data.list || []));
      }
    }
  };

  useEffect(() => {
    loadBanks();
  }, [search]);

  useEffect(() => {
    loadBankGroups();
    loadAccounts().then(() => loadBanks());
  }, []);

  const addBank = async () => {
    if (!form.name_ar || !form.bank_group_id || !form.parent_account_id) {
      alert("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }

    const parent = accounts.find((a) => String(a.id) === form.parent_account_id);
    if (!parent) {
      alert("حساب الأب غير موجود");
      return;
    }

    try {
      setBusy(true);
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

      const user = JSON.parse(localStorage.getItem("card-platform-user") || "{}");

      const data = await api.banks.addBank({
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim() || null,
        code: account.code,
        bank_group_id: Number(form.bank_group_id),
        parent_account_id: Number(form.parent_account_id),
        parent_account_name: `${parent.code} — ${parent.name_ar}`,
        account_id: account.id,
        account_code: account.code,
        account_name: account.name_ar,
        created_by: user.id || 1,
      });

      if (!data.success) {
        alert(data.message || "حدث خطأ");
        return;
      }

      setShowModal(false);
      setForm({
        name_ar: "",
        name_en: "",
        bank_group_id: "",
        parent_account_id: "",
      });
      await loadAccounts();
      await loadBanks();
    } catch (err: any) {
      alert(err?.message || err.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const deleteBank = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    await api.banks.deleteBank(id);
    loadBanks();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">دليل البنوك</h1>

      <div className="flex justify-between items-center">
        <input
          placeholder="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-lg w-64"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="acc-btn acc-btn-primary px-4 py-2 rounded"
          >
            ➕ إضافة
          </button>
          <button
            onClick={() => {
              void loadAccounts().then(() => loadBanks());
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
        <table className="acc-table">
          <thead>
            <tr>
              <th className="border px-3 py-2">الاسم</th>
              <th className="border px-3 py-2">الاسم الأجنبي</th>
              <th className="border px-3 py-2">الرقم</th>
              <th className="border px-3 py-2">مجموعة البنوك</th>
              <th className="border px-3 py-2">حساب الأب</th>
              <th className="border px-3 py-2">الفرع</th>
              <th className="border px-3 py-2">المستخدم</th>
              <th className="border px-3 py-2">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b, i) => (
              <tr key={b.id} className={i % 2 === 0 ? "" : "acc-row-alt"}>
                <td className="border px-3 py-2">{b.name_ar}</td>
                <td className="border px-3 py-2">{b.name_en || "-"}</td>
                <td className="border px-3 py-2 text-center">{b.code}</td>
                <td className="border px-3 py-2">{b.bank_group_name}</td>
                <td className="border px-3 py-2">{b.parent_account_name || "-"}</td>
                <td className="border px-3 py-2">{b.branch_name || DEFAULT_BRANCH_NAME}</td>
                <td className="border px-3 py-2">{b.user_name || "-"}</td>
                <td className="border px-3 py-2 text-center">
                  <button
                    onClick={() => deleteBank(b.id)}
                    className="text-red-600"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}

            {!banks.length && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-gray-500">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[#eef4ee] p-6 rounded w-[420px]">
            <h2 className="text-xl font-bold text-center mb-4">إضافة بنك</h2>

            <input
              className="border p-2 w-full mb-2 rounded"
              placeholder="الاسم"
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            />

            <input
              className="border p-2 w-full mb-2 rounded"
              placeholder="الاسم الأجنبي"
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            />

            <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-2 mb-2 text-right text-sm text-gray-500">
              الرقم يتولد تلقائيًا من تسلسل الحسابات، ويظهر البنك في الدليل تحت حساب الأب
            </div>

            <select
              className="border p-2 w-full mb-2 rounded"
              value={form.bank_group_id}
              onChange={(e) =>
                setForm({ ...form, bank_group_id: e.target.value })
              }
            >
              <option value="" disabled hidden>
                مجموعة البنوك
              </option>
              {bankGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name_ar}
                </option>
              ))}
            </select>

            <select
              className="border p-2 w-full mb-4 rounded"
              value={form.parent_account_id}
              onChange={(e) =>
                setForm({ ...form, parent_account_id: e.target.value })
              }
            >
              <option value="" disabled hidden>
                حساب الأب
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name_ar}
                </option>
              ))}
            </select>

            <div className="flex justify-between">
              <button onClick={() => setShowModal(false)} disabled={busy}>
                إلغاء
              </button>
              <button
                onClick={() => void addBank()}
                disabled={busy}
                className="acc-btn acc-btn-primary px-4 py-2 rounded"
              >
                {busy ? "جاري الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banks;
