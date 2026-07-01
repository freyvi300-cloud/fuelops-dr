/**
 * FuelOps-DR — WhatsApp Conversation State Machine: Types
 *
 * Adding a new state:
 *   1. Add the value to ConversationState below.
 *   2. Create lib/whatsapp/conversation/states/<your-state>.ts
 *      implementing StateHandler.
 *   3. Register it in machine.ts → HANDLERS.
 *   That's all — no changes to existing code required.
 */

// ─── State enum ───────────────────────────────────────────────────────────────

export const ConversationState = {
  // OCR reading received, waiting for user confirmation or cancellation
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  // User confirmed reading, waiting for customer name
  WAITING_CUSTOMER:     "WAITING_CUSTOMER",
  // Customer selected, waiting for payment type (CASH/CREDIT)
  WAITING_PAYMENT_TYPE: "WAITING_PAYMENT_TYPE",
  // All data collected, showing final summary and waiting for save confirmation
  WAITING_CONFIRM_SAVE: "WAITING_CONFIRM_SAVE",

  // ── Future states (scaffold only — implement when needed) ──────────────────
  WAITING_TRUCK:   "WAITING_TRUCK",
  WAITING_DRIVER:  "WAITING_DRIVER",
  WAITING_PRICE:   "WAITING_PRICE",
} as const

export type ConversationState = typeof ConversationState[keyof typeof ConversationState]

// ─── Payload ──────────────────────────────────────────────────────────────────
// Single payload type carried through the entire supply registration flow.
// Fields are populated progressively as the conversation advances.

export interface SupplyFlowPayload {
  // ── From OCR ──────────────────────────────────────────────────────────────
  mediaId:    string
  imageUrl:   string
  gallons:    number
  confidence: number
  quality:    string     // "buena" | "regular" | "mala"
  ocrNotes:   string
  provider:   string

  // ── Collected during conversation ─────────────────────────────────────────
  customerId?:     string
  customerName?:   string
  truckId?:        string | null
  truckName?:      string | null
  driverId?:       string | null
  paymentType?:    "CASH" | "CREDIT"
  pricePerGallon?: number          // override — if not set, use customer's effective price
}

// ─── Conversation record (as returned from DB) ────────────────────────────────

export interface StoredConversation {
  id:          string
  phoneNumber: string
  state:       ConversationState
  payload:     SupplyFlowPayload
  expiresAt:   Date
}

// ─── State handler interface ──────────────────────────────────────────────────
// Each state module exports one object implementing this interface.

export interface ConversationContext {
  /** Normalized message: trimmed + lowercased */
  message:      string
  /** Original raw message text from the user */
  rawMessage:   string
  phoneNumber:  string
  conversation: StoredConversation
}

export interface StateResult {
  /** WhatsApp reply to send */
  reply: string
  /** Transition to this state. If undefined and endConversation=false, stay in current state. */
  nextState?: ConversationState
  /** Fields to merge into the current payload for the next state */
  nextPayload?: Partial<SupplyFlowPayload>
  /** If true, the conversation record is deleted after sending the reply */
  endConversation: boolean
}

export interface StateHandler {
  readonly state: ConversationState
  handle(ctx: ConversationContext): Promise<StateResult>
}
