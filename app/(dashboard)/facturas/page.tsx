import { Receipt, Sparkles } from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Invoices module
// - Invoice model: saleId, customerId, truckId, invoiceNumber, liters, pricePerLiter,
//   total, paymentType (cash/credit), status (paid/partial/unpaid), createdAt
// - Invoices are AUTO-GENERATED when a supply (suministro) is confirmed
// - No manual creation by employees — only admin can override
// - PDF generation via react-pdf
// - WhatsApp sharing (Phase 3)

export default function FacturasPage() {
  return (
    <PageShell
      title="Facturas"
      description="Historial de facturas generadas automáticamente al confirmar cada suministro."
      actionLabel="Crear factura"
      icon={Receipt}
      emptyIcon={Receipt}
      emptyTitle="No hay facturas generadas"
      emptyDescription="Las facturas se generan automáticamente cuando se confirma un suministro. Registra tu primer suministro para ver facturas aquí."
      badge={{ text: "Auto-generadas", className: "bg-blue-50 text-blue-600 border border-blue-100" }}
    >
      {/* Auto-generation notice */}
      <div className="space-y-5">
        <div
          className="bg-white rounded-2xl border border-blue-100 p-6 flex items-start gap-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm tracking-tight">Facturación automática</p>
            <p className="text-xs font-sans text-slate-500 mt-1 leading-relaxed max-w-xl">
              En FuelOps-DR, los empleados no crean facturas manualmente.
              Cada vez que se confirma un suministro, el sistema genera automáticamente
              la factura, la asocia al cliente y al camión, y actualiza la cuenta por cobrar
              si la venta fue a crédito.
            </p>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16 gap-3"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
            <Receipt className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 text-sm">No hay facturas todavía</p>
          <p className="text-xs font-sans text-slate-400 text-center max-w-xs leading-relaxed">
            Confirma tu primer suministro desde{" "}
            <span className="font-semibold text-blue-600">Registrar suministro</span>{" "}
            para generar la primera factura automáticamente.
          </p>
        </div>
      </div>
    </PageShell>
  )
}
