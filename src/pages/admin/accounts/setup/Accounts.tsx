import { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';
import { serverApi } from '../../../../api/serverApi';
import { DEFAULT_BRANCH_NAME } from "../constants";

type AccountLevel = "رئيسي" | "فرعي";

type Account = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string | null;
  parent_id: number | null;
  account_group_id?: number | null;
  parent_name?: string;
  account_level?: AccountLevel;
  financial_statement?: string;
  created_at?: string;
  created_by?: string;
  branch_name?: string;
  group_name?: string;
  children?: Account[];
};

type AccountGroup = {
  id: number;
  code: string;
  name_ar: string;
  name_en?: string | null;
};

const INITIAL_FORM = {
  parent: "",
  costCenter: "",
  group: "",
  name_ar: "",
  name_en: "",
  level: "رئيسي" as AccountLevel,
  analysis: "عام",
  financial: "الميزانية العمومية",
};

const getRootFinancialStatement = (name: string) => {
  const normalized = name
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "")
    .toLowerCase();

  if (/اصول|خصوم|ملكيه|مطلوبات|التزامات|نقديه|بنوك|صناديق/.test(normalized)) {
    return "الميزانية العمومية";
  }

  if (/ايراد|مصروف|مبيعات|تكلفه|ربح|خسار/.test(normalized)) {
    return "أرباح وخسائر";
  }

  return "الميزانية العمومية";
};

function buildTree(list: Account[]): Account[] {
  const map = new Map<number, Account>();
  list.forEach((a) => map.set(a.id, { ...a, children: [] }));
  const roots: Account[] = [];
  map.forEach((node) => {
    if (node.parent_id != null && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

const FloatingInput = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <div className="relative">
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="acc-input w-full px-3 py-3"
    />
    <label
      className={`absolute right-3 px-1 acc-card  transition-all ${
        value ? "-top-2 text-xs acc-link " : "top-3 text-sm text-gray-500 "
      }`}
    >
      {label}
    </label>
  </div>
);

const FloatingSelect = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) => (
  <div className="relative">
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="acc-select w-full px-3 py-3 disabled:opacity-60"
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>

    <label className="-top-2 absolute right-3 acc-card  px-1 text-xs acc-link ">
      {label}
    </label>
  </div>
);

const TreeNode = ({ node }: { node: Account }) => {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(node.children?.length);
  const isMain = node.account_level === "رئيسي";

  return (
    <div className="mr-4 mt-2">
      <div
        className={`flex cursor-pointer items-center gap-2 hover:acc-link  ${
          isMain ? "font-bold text-gray-800 " : "text-gray-600  italic"
        }`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? <span>{open ? "▼" : "▶"}</span> : <span className="w-4" />}
        <span>{isMain ? "●" : "○"}</span>
        <span>
          {node.code} - {node.name_ar}
        </span>
        {!isMain && (
          <span className="rounded bg-blue-50 dark:bg-blue-900 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-300">
            فرعي
          </span>
        )}
      </div>

      {hasChildren && open && (
        <div className="mr-4 border-r border-dashed border-gray-400  pr-3">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

const Accounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [form, setForm] = useState<{
    parent: string;
    costCenter: string;
    group: string;
    name_ar: string;
    name_en: string;
    level: AccountLevel;
    analysis: string;
    financial: string;
  }>(INITIAL_FORM);

  const loadAccounts = async () => {
    try {
      const res = await serverApi.accounts.list();
      const list = (res.list ?? []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name_ar: a.name_ar,
        name_en: a.name_en ?? null,
        parent_id: a.parent_id ?? null,
        parent_name: a.parent_name ?? null,
        account_level: (a.account_level as AccountLevel) || "رئيسي",
        financial_statement: a.financial_statement ?? undefined,
        created_at: a.created_at,
        branch_name: DEFAULT_BRANCH_NAME,
      }));
      setAccountsList(list);
      setAccounts(buildTree(list));
    } catch {
      const data = await api.accounts.getAccounts();
      setAccounts(data.tree);
      setAccountsList(data.list);
    }
  };

  const loadAccountGroups = async () => {
    const data = await api.accountGroups.getAll();
    setAccountGroups(data.groups || []);
  };

  useEffect(() => {
    Promise.all([loadAccounts(), loadAccountGroups()]).finally(() =>
      setLoading(false)
    );
  }, []);

  const mainAccountsOptions = accountsList
    .filter((a) => a.account_level === "رئيسي" && a.id !== selectedAccountId)
    .map((a) => ({
      value: String(a.id),
      label: `${a.code} - ${a.name_ar}`,
    }));

  const accountGroupOptions = accountGroups.map((group) => ({
    value: String(group.id),
    label: `${group.code} - ${group.name_ar}`,
  }));

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedAccountId(null);
  };

  useEffect(() => {
    const selectedParent = accountsList.find((account) => String(account.id) === form.parent);

    setForm((prev) => {
      const nextFinancial =
        selectedParent?.financial_statement || getRootFinancialStatement(prev.name_ar);

      if (prev.financial === nextFinancial) {
        return prev;
      }

      return {
        ...prev,
        financial: nextFinancial,
      };
    });
  }, [form.parent, form.name_ar, accountsList]);

  const handleRowClick = (row: Account) => {
    setSelectedAccountId(row.id);
    setForm((prev) => ({
      ...prev,
      parent: row.parent_id ? String(row.parent_id) : "",
      group: row.account_group_id ? String(row.account_group_id) : "",
      name_ar: row.name_ar,
      name_en: row.name_en ?? "",
      level: row.account_level ?? "رئيسي",
      financial: row.financial_statement ?? "",
    }));
  };

  const handleUpdate = async () => {
    if (!selectedAccountId) {
      alert("اختر حساب من الجدول أولًا");
      return;
    }

    if (form.level === "فرعي" && !form.parent) {
      alert("الحساب الفرعي يجب أن يرتبط بحساب أب");
      return;
    }

    const payload = {
      name_ar: form.name_ar,
      name_en: form.name_en || null,
      parent_id: form.parent ? Number(form.parent) : null,
      account_group_id: form.group ? Number(form.group) : null,
      account_level: form.level,
      financial_statement: form.financial || null,
    };

    try {
      await serverApi.accounts.update(selectedAccountId, payload);
    } catch {
      await api.accounts.updateAccount(selectedAccountId, payload);
    }

    await loadAccounts();
  };

  const handleAdd = async () => {
    if (!form.name_ar) {
      alert("اسم الحساب مطلوب");
      return;
    }

    if (form.level === "فرعي" && !form.parent) {
      alert("الحساب الفرعي يجب أن يرتبط بحساب أب");
      return;
    }

    const payload = {
      name_ar: form.name_ar,
      name_en: form.name_en || null,
      parent_id: form.parent ? Number(form.parent) : null,
      account_group_id: form.group ? Number(form.group) : null,
      account_level: form.level,
      financial_statement: form.financial || null,
    };

    try {
      await serverApi.accounts.create(payload);
    } catch {
      await api.accounts.createAccount(payload);
    }

    await loadAccounts();
    resetForm();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-right text-xl font-bold ">دليل الحسابات</h2>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 rounded-xl acc-card  p-4">
          <h3 className="mb-3 text-right font-bold ">شجرة الحسابات</h3>
          {loading
            ? <span className="">جاري التحميل...</span>
            : accounts.map((a) => <TreeNode key={a.id} node={a} />)}
        </div>

        <div className="col-span-8 space-y-5 rounded-xl acc-card  p-6">
          <div className="grid grid-cols-3 gap-4">
            <FloatingSelect
              label="حساب الأب"
              value={form.parent}
              onChange={(v) => setForm({ ...form, parent: v })}
              options={mainAccountsOptions}
            />

            <FloatingInput
              label="مركز التكلفة (اختياري)"
              value={form.costCenter}
              onChange={(v) => setForm({ ...form, costCenter: v })}
            />

            <FloatingSelect
              label="مجموعة الحسابات"
              value={form.group}
              onChange={(v) => setForm({ ...form, group: v })}
              options={accountGroupOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FloatingInput
              label="اسم الحساب"
              value={form.name_ar}
              onChange={(v) => setForm({ ...form, name_ar: v })}
            />
            <FloatingInput
              label="الاسم الأجنبي"
              value={form.name_en}
              onChange={(v) => setForm({ ...form, name_en: v })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FloatingSelect
              label="نوع الحساب"
              value={form.level}
              onChange={(v) => setForm({ ...form, level: v as AccountLevel })}
              options={[
                { value: "رئيسي", label: "رئيسي" },
                { value: "فرعي", label: "فرعي" },
              ]}
            />

            <FloatingSelect
              label="التحليل"
              value={form.analysis}
              onChange={(v) => setForm({ ...form, analysis: v })}
              options={[
                { value: "عام", label: "عام" },
                { value: "تحليلي", label: "تحليلي" },
              ]}
            />

            <FloatingSelect
              label="القوائم المالية"
              value={form.financial}
              onChange={(v) => setForm({ ...form, financial: v })}
              options={[
                {
                  value: "الميزانية العمومية",
                  label: "الميزانية العمومية",
                },
                { value: "أرباح وخسائر", label: "أرباح وخسائر" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => void handleUpdate()}
              className="acc-btn acc-btn-primary rounded-lg px-5 py-2"
            >
              تحديث
            </button>
            <button
              onClick={resetForm}
              className="acc-btn acc-btn-outline rounded-lg px-5 py-2"
            >
              مسح الحقول
            </button>
            <button
              onClick={() => void handleAdd()}
              className="acc-btn acc-btn-secondary rounded-lg px-5 py-2"
            >
              إضافة
            </button>
          </div>
        </div>
      </div>

      <div className="acc-table-wrap rounded-xl">
        <table className="acc-table">
          <thead>
            <tr>
              <th className="p-2">الحساب الأب</th>
              <th className="p-2">اسم الحساب</th>
              <th className="p-2">رقم الحساب</th>
              <th className="p-2">الاسم الأجنبي</th>
              <th className="p-2">المستخدم</th>
              <th className="p-2">الفرع</th>
              <th className="p-2">وقت الإدخال</th>
              <th className="p-2">نوع الحساب</th>
              <th className="p-2">مجموعة الحسابات</th>
              <th className="p-2">الحساب الختامي</th>
            </tr>
          </thead>

          <tbody>
            {accountsList.map((row) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                className="cursor-pointer border-b hover:bg-gray-100 dark:hover:bg-slate-800 "
              >
                <td className="p-2">{row.parent_name ?? "—"}</td>
                <td className="p-2">{row.name_ar}</td>
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.name_en ?? "—"}</td>
                <td className="p-2">{row.created_by ?? "—"}</td>
                <td className="p-2">{row.branch_name ?? DEFAULT_BRANCH_NAME}</td>
                <td className="p-2">{row.created_at ?? "—"}</td>
                <td className="p-2">{row.account_level}</td>
                <td className="p-2">{row.group_name ?? "—"}</td>
                <td className="p-2">{row.financial_statement ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Accounts;
