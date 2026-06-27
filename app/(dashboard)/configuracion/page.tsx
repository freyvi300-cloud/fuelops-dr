import { Settings, Building2, Droplets, Bell, Shield } from "lucide-react"

// TODO: Connect to a SystemSettings model in the database
// - Persist: businessName, rnc, address, phone, defaultFuelPrice, tankCapacity,
//   lowStockThreshold, timezone, currency
// - Admin-only page (middleware check once auth is wired)

const INPUT = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-sans text-slate-500 bg-slate-50 cursor-not-allowed"
const LABEL = "block text-xs font-medium text-slate-600 mb-1.5"

function SettingsSection({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 bg-slate-50/50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">{title}</p>
          <p className="text-[11px] font-sans text-slate-400">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* Header */}
      <div
        className="bg-white border-b border-slate-100 px-6 py-5 shrink-0"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración</h1>
              <p className="text-xs font-sans text-slate-400 mt-0.5">
                Parámetros generales del sistema FuelOps-DR.
              </p>
            </div>
          </div>
          <button
            disabled
            title="Próximamente"
            className="flex items-center gap-2 bg-blue-600 opacity-60 cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
          >
            Guardar configuración
          </button>
        </div>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-3xl">

        {/* ── Negocio ─────────────────────────────────────────────────────── */}
        <SettingsSection
          icon={Building2}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          title="Información del negocio"
          description="Datos que aparecen en facturas y reportes."
        >
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Nombre del negocio</label>
              <input disabled value="Empresa de Distribución de Diésel" className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>RNC</label>
                <input disabled value="" placeholder="0-00-00000-0" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Teléfono</label>
                <input disabled value="" placeholder="809-000-0000" className={INPUT} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Dirección</label>
              <input disabled value="" placeholder="Calle, ciudad, provincia" className={INPUT} />
            </div>
          </div>
        </SettingsSection>

        {/* ── Combustible ─────────────────────────────────────────────────── */}
        <SettingsSection
          icon={Droplets}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          title="Configuración de combustible"
          description="Parámetros del tanque y precios por defecto."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Precio por galón (RD$)</label>
              <input disabled value="" placeholder="0.00" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Capacidad del tanque (gal)</label>
              <input disabled value="" placeholder="0" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Alerta inventario bajo (%)</label>
              <input disabled value="" placeholder="30" className={INPUT} />
            </div>
          </div>
        </SettingsSection>

        {/* ── Alertas ─────────────────────────────────────────────────────── */}
        <SettingsSection
          icon={Bell}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          title="Notificaciones y alertas"
          description="Cuándo y cómo recibir alertas del sistema."
        >
          <div className="space-y-3">
            {[
              "Alerta de inventario bajo",
              "Facturas vencidas (30 días)",
              "Resumen diario por WhatsApp",
            ].map((label) => (
              <label key={label} className="flex items-center gap-3 cursor-not-allowed opacity-60">
                <div className="w-9 h-5 bg-slate-200 rounded-full relative shrink-0">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
                </div>
                <span className="text-sm font-sans text-slate-600">{label}</span>
                <span className="text-[10px] text-slate-400 font-sans">(Próximamente)</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        {/* ── Acceso ──────────────────────────────────────────────────────── */}
        <SettingsSection
          icon={Shield}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          title="Seguridad y acceso"
          description="Contraseña y sesión del administrador."
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Contraseña actual</label>
              <input disabled type="password" value="••••••••" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Nueva contraseña</label>
              <input disabled type="password" placeholder="••••••••" className={INPUT} />
            </div>
          </div>
          <p className="text-[11px] font-sans text-slate-400 mt-3">
            El cambio de contraseña estará disponible cuando se active la autenticación completa.
          </p>
        </SettingsSection>

        {/* Spacer */}
        <div className="pb-6" />
      </div>
    </div>
  )
}
