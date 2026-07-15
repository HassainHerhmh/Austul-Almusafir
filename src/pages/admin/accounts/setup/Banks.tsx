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
  account_name: string;
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

const Banks: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankGroups, setBankGroups] = useState<BankGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    code: "",
    bank_group_id: "",
    parent_account_id: "",
  });

  const loadBanks = async () => {
    const data = await api.banks.getBanks({ search });
    if (data.success) setBanks(data.banks);
  };

  const loadBankGroups = async () => {
    const data = await api.get("/bank-groups").then((res: { data: any }) => res.data);
    if (data.success) setBankGroups(data.groups);
  };

  const loadAccounts = async () => {
    try {
      const res = await serverApi.accounts.list();
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
    loadAccounts();
  }, []);

  const addBank = async () => {
    if (
      !form.name_ar ||
      !form.code ||
      !form.bank_group_id ||
      !form.parent_account_id
    ) {
      alert("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }

    const user = JSON.parse(localStorage.getItem("card-platform-user") || "{}");

    const data = await api.banks.addBank({
      name_ar: form.name_ar,
      name_en: form.name_en,
      code: form.code,
      bank_group_id: Number(form.bank_group_id),
      parent_account_id: Number(form.parent_account_id),
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
      code: "",
      bank_group_id: "",
      parent_account_id: "",
    });

    loadBanks();
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
            onClick={loadBanks}
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
              <th className="border px-3 py-2">الحساب الرئيسي</th>
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
                <td className="border px-3 py-2">{b.account_name}</td>
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

            <input
              className="border p-2 w-full mb-2 rounded"
              placeholder="الرقم"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />

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
                الحساب الرئيسي
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name_ar}
                </option>
              ))}
            </select>

            <div className="flex justify-between">
              <button onClick={() => setShowModal(false)}>إلغاء</button>
              <button
                onClick={addBank}
                className="acc-btn acc-btn-primary px-4 py-2 rounded"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banks;
