import { UserCog } from "lucide-react"
import PageShell from "@/components/ui/page-shell"

// TODO: Build Employees module
// - Employee = User with role EMPLOYEE or ADMIN
// - List existing users from the User table
// - Invite by email → sends a link to set their password
// - Roles: ADMIN (full access) / EMPLOYEE (limited — see permissions matrix)
// - Soft-disable: isActive = false (never hard-delete accounts with audit trail)
// - Activity log per employee visible to admin only

export default function EmpleadosPage() {
  return (
    <PageShell
      title="Empleados"
      description="Gestiona el personal con acceso al sistema y sus permisos."
      actionLabel="Agregar empleado"
      icon={UserCog}
      emptyIcon={UserCog}
      emptyTitle="No hay empleados registrados"
      emptyDescription="Agrega empleados para que puedan iniciar sesión y registrar suministros. Cada empleado tendrá un rol con permisos específicos."
    />
  )
}
