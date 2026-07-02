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
  // ── Supply flow ───────────────────────────────────────────────────────────
  // OCR reading received, waiting for user confirmation or cancellation
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  // User confirmed reading, waiting for customer name
  WAITING_CUSTOMER:     "WAITING_CUSTOMER",
  // Customer selected, waiting for payment type (CASH/CREDIT)
  WAITING_PAYMENT_TYPE: "WAITING_PAYMENT_TYPE",
  // All data collected, showing final summary and waiting for save confirmation
  WAITING_CONFIRM_SAVE: "WAITING_CONFIRM_SAVE",

  // ── Payment / reconciliation flow ─────────────────────────────────────────
  // Receipt OCR extracted payment data, waiting for customer name
  WAITING_PAYMENT_CUSTOMER: "WAITING_PAYMENT_CUSTOMER",
  // Customer confirmed, waiting for CONFIRMAR / CANCELAR
  WAITING_PAYMENT_CONFIRM:  "WAITING_PAYMENT_CONFIRM",
} as const

export type ConversationState = typeof ConversationState[keyof typeof ConversationState]

// ─── Unified flow payload ─────────────────────────────────────────────────────
// A single JSON blob stored in WhatsAppConversation.payload.
// Fields are populated progressively as the flow advances.

export interface FlowPayload {
  // Discriminator — determines which flow is active
  flowType: "SUPPLY" | "PAYMENT"

  // ── Supply flow: from OCR ────────────────────────────────────────────────
  mediaId?:    string
  imageUrl?:   string
  gallons?:    number
  confidence?: number
  quality?:    string        // "buena" | "regular" | "mala"
  ocrNotes?:   string
  provider?:   string

  // ── Supply flow: collected during conversation ────────────────────────────
  customerId?:     string
  customerName?:   string
  truckId?:        string | null
  truckName?:      string | null
  paymentType?:    "CASH" | "CREDIT"
  pricePerGallon?: number

  // ── Payment flow: from receipt OCR ───────────────────────────────────────
  paymentAmount?:    number
  paymentBank?:      string | null
  paymentReference?: string | null
  paymentDate?:      string | null   // ISO string extracted from receipt
  paymentEmitter?:   string | null   // name of sender from receipt
}

// Backward-compat alias (existing state handlers use SupplyFlowPayload)
export type SupplyFlowPayload = FlowPayload

// ─── Conversation record (as returned from DB) ────────────────────────────────

export interface StoredConversation {
  id:          string
  phoneNumber: string
  state:       ConversationState
  payload:     FlowPayload
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
  nextPayload?: Partial<FlowPayload>
  /** If true, the conversation record is deleted after sending the reply */
  endConversation: boolean
}

export interface StateHandler {
  readonly state: ConversationState
  handle(ctx: ConversationContext): Promise<StateResult>
}
