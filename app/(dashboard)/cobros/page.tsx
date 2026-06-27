import { CircleDollarSign } from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Collections module
// - Payment model: customerId, amount, method (cash/transfer/check), reference,
//   registeredBy, paymentDate, notes
// - PaymentAllocation model: paymentId, invoiceId, amountApplied
//   (one payment can cover multiple invoices — FIFO auto-allocation)
// - When payment registered: decrement customer.currentBalance
// - Show aging report: 0-30 / 31-60 / 61-90 / 90+ days overdue
// - PDF receipt generation per payment

export default function CobrosPage() {
  return (
    <PageShell
      title="Cobros"
      description="Registra los pagos recibidos de clientes y gestiona cuentas por cobrar."
      actionLabel="Registrar cobro"
      icon={CircleDollarSign}
      emptyIcon={CircleDollarSign}
      emptyTitle="No hay cobros registrados"
      emptyDescription="Cuando un cliente realice un pago, regístralo aquí para actualizar su saldo automáticamente y generar el recibo de pago."
    />
  )
}
