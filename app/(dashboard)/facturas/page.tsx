import { getInvoices, getInvoiceStats } from "@/app/actions/invoices"
import InvoicesClient from "@/components/facturas/invoices-client"

export const dynamic = "force-dynamic"

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams

  const [invoices, stats] = await Promise.all([
    getInvoices(q, status),
    getInvoiceStats(),
  ])

  return (
    <InvoicesClient
      invoices={invoices}
      stats={stats}
      initialSearch={q ?? ""}
      initialStatus={status ?? "ALL"}
    />
  )
}
