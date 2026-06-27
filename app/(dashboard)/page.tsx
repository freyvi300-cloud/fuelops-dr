import Header from "@/components/dashboard/header"
import PeriodFilter from "@/components/dashboard/period-filter"
import KpiCards from "@/components/dashboard/kpi-cards"
import SalesChart from "@/components/dashboard/sales-chart"
import InventoryChart from "@/components/dashboard/inventory-chart"
import RecentInvoices from "@/components/dashboard/recent-invoices"
import PendingClients from "@/components/dashboard/pending-clients"
import RecentPhotos from "@/components/dashboard/recent-photos"
import AlertBanners from "@/components/dashboard/alert-banners"

export default function DashboardPage() {
  return (
    <>
      <Header />

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Period filter */}
        <PeriodFilter />

        {/* KPI Cards */}
        <KpiCards />

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SalesChart />
          <InventoryChart />
        </div>

        {/* Bottom 3-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentInvoices />
          <PendingClients />
          <RecentPhotos />
        </div>

        {/* Alert banners */}
        <AlertBanners />

        <p className="text-center text-xs text-slate-400 pb-2">
          © 2025 FuelOps-DR. Todos los derechos reservados.
        </p>
      </main>
    </>
  )
}
