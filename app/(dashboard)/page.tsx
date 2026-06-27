import {
  getDashboardKpis,
  getSalesChartData,
  getInventoryChartData,
  getRecentInvoices,
  getPendingClients,
  getRecentPhotos,
  getAlerts,
} from "@/lib/data/dashboard"

import Header from "@/components/dashboard/header"
import PeriodFilter from "@/components/dashboard/period-filter"
import KpiCards from "@/components/dashboard/kpi-cards"
import SalesChart from "@/components/dashboard/sales-chart"
import InventoryChart from "@/components/dashboard/inventory-chart"
import RecentInvoices from "@/components/dashboard/recent-invoices"
import PendingClients from "@/components/dashboard/pending-clients"
import RecentPhotos from "@/components/dashboard/recent-photos"
import AlertBanners from "@/components/dashboard/alert-banners"

export default async function DashboardPage() {
  const [
    kpis,
    salesData,
    inventoryData,
    recentInvoices,
    pendingClients,
    recentPhotos,
    alerts,
  ] = await Promise.all([
    getDashboardKpis(),
    getSalesChartData(),
    getInventoryChartData(),
    getRecentInvoices(),
    getPendingClients(),
    getRecentPhotos(),
    getAlerts(),
  ])

  return (
    <>
      <Header />

      <main className="flex-1 px-6 py-6 space-y-6 overflow-y-auto bg-slate-50">
        <PeriodFilter />
        <KpiCards kpis={kpis} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SalesChart data={salesData} />
          <InventoryChart data={inventoryData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentInvoices invoices={recentInvoices} />
          <PendingClients clients={pendingClients} />
          <RecentPhotos photos={recentPhotos} />
        </div>

        <AlertBanners alerts={alerts} />

        <p className="text-center text-xs font-sans text-slate-400 pb-2">
          © 2025 FuelOps-DR. Todos los derechos reservados.
        </p>
      </main>
    </>
  )
}
