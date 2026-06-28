import { getPayments, getPaymentStats } from "@/app/actions/payments"
import { getCustomers }                 from "@/app/actions/customers"
import PaymentsClient                   from "@/components/cobros/payments-client"

export const dynamic = "force-dynamic"

export default async function CobrosPage() {
  const [payments, stats, customers] = await Promise.all([
    getPayments(),
    getPaymentStats(),
    getCustomers(),
  ])

  return (
    <PaymentsClient
      payments={payments}
      stats={stats}
      customers={customers}
    />
  )
}
