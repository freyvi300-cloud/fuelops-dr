import { getSystemSettings } from "@/lib/system-settings"
import OcrTestClient         from "@/components/ocr-test/ocr-test-client"

export const dynamic = "force-dynamic"

export default async function OcrTestPage() {
  const settings = await getSystemSettings()

  return (
    <OcrTestClient
      activeProvider={settings.ocrProvider}
      openaiKeySet={Boolean(process.env.OPENAI_API_KEY)}
      geminiKeySet={Boolean(process.env.GEMINI_API_KEY)}
      ocrEnabled={settings.ocrEnabled}
      ocrMinConfidence={settings.ocrMinConfidence}
    />
  )
}
