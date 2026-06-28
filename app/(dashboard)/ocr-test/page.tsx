import { getSystemSettings } from "@/lib/system-settings"
import OcrTestClient         from "@/components/ocr-test/ocr-test-client"

export const dynamic = "force-dynamic"

export default async function OcrTestPage() {
  const apiKeySet = Boolean(process.env.OPENAI_API_KEY)
  const settings  = await getSystemSettings()

  return (
    <OcrTestClient
      apiKeySet={apiKeySet}
      ocrEnabled={settings.ocrEnabled}
      ocrMinConfidence={settings.ocrMinConfidence}
    />
  )
}
