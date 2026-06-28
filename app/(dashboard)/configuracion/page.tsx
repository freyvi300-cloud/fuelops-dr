import { getSystemSettings } from "@/lib/system-settings"
import SettingsForm          from "@/components/configuracion/settings-form"

export const dynamic = "force-dynamic"

export default async function ConfiguracionPage() {
  const settings = await getSystemSettings()
  return <SettingsForm settings={settings} />
}
