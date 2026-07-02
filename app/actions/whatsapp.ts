"use server"

import { prisma }        from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  clearConversation,
  ConversationState,
} from "@/lib/whatsapp/conversation/index"
import type { FlowPayload } from "@/lib/whatsapp/conversation/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingConversation {
  id:          string
  phoneNumber: string
  state:       string
  flowType:    "SUPPLY" | "PAYMENT" | "UNKNOWN"
  // Supply
  gallons?:        number
  customerName?:   string
  truckName?:      string
  pricePerGallon?: number
  paymentType?:    string
  imageUrl?:       string
  confidence?:     number
  // Payment
  paymentAmount?:    number
  paymentBank?:      string | null
  paymentReference?: string | null
  paymentDate?:      string | null
  // Meta
  updatedAt:   string
  expiresAt:   string
}

export interface RecentWhatsAppImage {
  id:           string
  mediaId:      string
  senderPhone:  string
  senderName:   string | null
  storageUrl:   string
  caption:      string | null
  ocrGallons:   number | null
  ocrConfidence: number | null
  ocrQuality:   string | null
  createdAt:    string
}

export interface WhatsAppStats {
  pendingCount:    number
  imagesToday:     number
  imagesThisMonth: number
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPendingConversations(): Promise<PendingConversation[]> {
  const rows = await prisma.whatsAppConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take:    50,
  })

  return rows.map(r => {
    const p = r.payload as unknown as FlowPayload
    return {
      id:              r.id,
      phoneNumber:     r.phoneNumber,
      state:           r.state,
      flowType:        (p.flowType ?? "UNKNOWN") as "SUPPLY" | "PAYMENT" | "UNKNOWN",
      gallons:         p.gallons,
      customerName:    p.customerName,
      truckName:       p.truckName ?? undefined,
      pricePerGallon:  p.pricePerGallon,
      paymentType:     p.paymentType,
      imageUrl:        p.imageUrl,
      confidence:      p.confidence,
      paymentAmount:   p.paymentAmount,
      paymentBank:     p.paymentBank,
      paymentReference: p.paymentReference,
      paymentDate:     p.paymentDate,
      updatedAt:       r.updatedAt.toISOString(),
      expiresAt:       r.expiresAt.toISOString(),
    }
  })
}

export async function getRecentWhatsAppImages(limit = 30): Promise<RecentWhatsAppImage[]> {
  const rows = await prisma.whatsAppImage.findMany({
    orderBy: { createdAt: "desc" },
    take:    limit,
  })
  return rows.map(r => ({
    id:            r.id,
    mediaId:       r.mediaId,
    senderPhone:   r.senderPhone,
    senderName:    r.senderName,
    storageUrl:    r.storageUrl,
    caption:       r.caption,
    ocrGallons:    r.ocrGallons?.toNumber() ?? null,
    ocrConfidence: r.ocrConfidence,
    ocrQuality:    r.ocrQuality,
    createdAt:     r.createdAt.toISOString(),
  }))
}

export async function getWhatsAppStats(): Promise<WhatsAppStats> {
  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [pendingCount, imagesToday, imagesThisMonth] = await Promise.all([
    prisma.whatsAppConversation.count(),
    prisma.whatsAppImage.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.whatsAppImage.count({ where: { createdAt: { gte: monthStart } } }),
  ])

  return { pendingCount, imagesToday, imagesThisMonth }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function cancelConversationAction(
  phoneNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await clearConversation(phoneNumber)
    revalidatePath("/whatsapp")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// Force a specific conversation into WAITING_PAYMENT_TYPE (for admin override)
export async function adminSkipToPaymentType(
  phoneNumber: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const conv = await prisma.whatsAppConversation.findUnique({ where: { phoneNumber } })
    if (!conv) return { ok: false, error: "Conversación no encontrada" }

    await prisma.whatsAppConversation.update({
      where: { phoneNumber },
      data: { state: ConversationState.WAITING_PAYMENT_TYPE },
    })
    revalidatePath("/whatsapp")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
