import { Outlet, Navigate, useLocation } from "react-router-dom";
import { AppNavLink } from "../../../../components/InAppNavLink";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  BookOpen,
  RefreshCcw,
} from "lucide-react";

const Operations = () => {
  const location = useLocation();

  if (location.pathname.endsWith("/operations")) {
    return <Navigate to="receipt-voucher" replace />;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `acc-subnav-link flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
      isActive ? "active" : ""
    }`;

  return (
    <div className="acc-shell space-y-6" dir="rtl">
      <div className="acc-subnav px-4 py-3 flex flex-wrap gap-4">
        <AppNavLink to="receipt-voucher" className={linkClass}>
          <ArrowUpCircle size={18} />
          سند قبض
        </AppNavLink>

        <AppNavLink to="payment-voucher" className={linkClass}>
          <ArrowDownCircle size={18} />
          سند صرف
        </AppNavLink>

        <AppNavLink to="journal-entry" className={linkClass}>
          <BookOpen size={18} />
          قيد يومي
        </AppNavLink>

        <AppNavLink to="currency-exchange" className={linkClass}>
          <RefreshCcw size={18} />
          مصارفة عملة
        </AppNavLink>
      </div>

      <div className="acc-panel p-6 min-h-[300px]">
        <Outlet />
      </div>
    </div>
  );
};

export default Operations;
