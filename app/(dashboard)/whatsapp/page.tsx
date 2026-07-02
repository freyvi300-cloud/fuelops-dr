import {
  getPendingConversations,
  getRecentWhatsAppImages,
  getWhatsAppStats,
} from "@/app/actions/whatsapp"
import WhatsAppInboxClient from "@/components/whatsapp/whatsapp-inbox-client"

export const dynamic = "force-dynamic"

export default async function WhatsAppPage() {
  const [conversations, images, stats] = await Promise.all([
    getPendingConversations(),
    getRecentWhatsAppImages(30),
    getWhatsAppStats(),
  ])

  return (
    <WhatsAppInboxClient
      conversations={conversations}
      images={images}
      stats={stats}
    />
  )
}
