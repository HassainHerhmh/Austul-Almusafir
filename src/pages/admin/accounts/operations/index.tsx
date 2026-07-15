import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
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
        <NavLink to="receipt-voucher" className={linkClass}>
          <ArrowUpCircle size={18} />
          سند قبض
        </NavLink>

        <NavLink to="payment-voucher" className={linkClass}>
          <ArrowDownCircle size={18} />
          سند صرف
        </NavLink>

        <NavLink to="journal-entry" className={linkClass}>
          <BookOpen size={18} />
          قيد يومي
        </NavLink>

        <NavLink to="currency-exchange" className={linkClass}>
          <RefreshCcw size={18} />
          مصارفة عملة
        </NavLink>
      </div>

      <div className="acc-panel p-6 min-h-[300px]">
        <Outlet />
      </div>
    </div>
  );
};

export default Operations;
