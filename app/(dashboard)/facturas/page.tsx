import { getInvoices, getInvoiceStats } from "@/app/actions/invoices"
import InvoicesClient from "@/components/facturas/invoices-client"
import { prisma }     from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams

  const [invoices, stats, customers] = await Promise.all([
    getInvoices(q, status),
    getInvoiceStats(),
    prisma.customer.findMany({
      where:   { status: "ACTIVE" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <InvoicesClient
      invoices={invoices}
      stats={stats}
      initialSearch={q ?? ""}
      initialStatus={status ?? "ALL"}
      customers={customers}
    />
  )
}
