import { useEffect, useState } from "react";
import api from '../../../../api/accountingApi';

type Account = {
  id: number;
  name_ar: string;
  parent_id: number | null;
};

const TransitAccountsSettings = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [cardIncome, setCardIncome] = useState<number | "">("");
  const [courierCommission, setCourierCommission] = useState<number | "">("");
  const [transferGuarantee, setTransferGuarantee] = useState<number | "">("");
  const [currencyExchange, setCurrencyExchange] = useState<number | "">("");
  const [customerGuarantee, setCustomerGuarantee] = useState<number | "">("");
  const [customerCredit, setCustomerCredit] = useState<number | "">("");
  const [couponDiscount, setCouponDiscount] = useState<number | "">("");

  useEffect(() => {
    (async () => {
      const res = await (api as any).accounts.getAccounts();

      const subs = (res.list || []).filter(
        (a: Account) => a.parent_id !== null
      );

      setAccounts(subs);
    })();

    (async () => {
      const res = await api.get("/settings/transit-accounts");
      const d = res.data?.data || {};
      setCardIncome(d.card_income_account || d.commission_income_account || "");
      setCourierCommission(d.courier_commission_account || "");
      setTransferGuarantee(d.transfer_guarantee_account || "");
      setCurrencyExchange(d.currency_exchange_account || "");
      setCustomerGuarantee(d.customer_guarantee_account || "");
      setCustomerCredit(d.customer_credit_account || "");
      setCouponDiscount(d.coupon_discount_account || "");
    })();
  }, []);

  const save = async () => {
    const payload = {
      card_income_account: cardIncome || null,
      courier_commission_account: courierCommission || null,
      transfer_guarantee_account: transferGuarantee || null,
      currency_exchange_account: currencyExchange || null,
      customer_guarantee_account: customerGuarantee || null,
      customer_credit_account: customerCredit || null,
      coupon_discount_account: couponDiscount || null,
    };

    try {
      await api.post("/settings/transit-accounts", payload);
      alert("تم حفظ الإعدادات بنجاح");
    } catch {
      alert("فشل حفظ الإعدادات");
    }
  };

  const Field = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number | "";
    onChange: (v: number | "") => void;
  }) => (
    <div className="acc-card border rounded-xl p-4 space-y-2 shadow-sm">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <select
        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        value={value}
        onChange={(e) =>
          e.target.value ? onChange(Number(e.target.value)) : onChange("")
        }
      >
        <option value="">اختر حساب</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name_ar}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <h2 className="text-lg font-bold acc-link">
        الحسابات الوسيطة (Transit)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
        <Field
          label="حساب وسيط إيرادات الكروت"
          value={cardIncome}
          onChange={setCardIncome}
        />
        <Field
          label="حساب وسيط عمولات الموصلين"
          value={courierCommission}
          onChange={setCourierCommission}
        />

        <Field
          label="حساب وسيط دعم التسويق والعروض"
          value={couponDiscount}
          onChange={setCouponDiscount}
        />
        <Field
          label="حساب وسيط اعتماد الحوالات"
          value={transferGuarantee}
          onChange={setTransferGuarantee}
        />
        <Field
          label="حساب وسيط مصارفة العملة"
          value={currencyExchange}
          onChange={setCurrencyExchange}
        />
        <Field
          label="حساب وسيط تأمين العملاء"
          value={customerGuarantee}
          onChange={setCustomerGuarantee}
        />

        <Field
          label="حساب وسيط اعتماد العملاء"
          value={customerCredit}
          onChange={setCustomerCredit}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="acc-btn acc-btn-primary px-6 py-2 rounded-lg"
        >
          حفظ الإعدادات
        </button>
      </div>
    </div>
  );
};

export default TransitAccountsSettings;
