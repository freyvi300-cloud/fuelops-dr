const BANK_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /banreservas?|reservas?|banco\s*de\s*reservas?|b\.?\s*reservas?/i, name: "BanReservas" },
  { pattern: /popular|b\.?\s*popular|bpopular|banco\s*popular/i,                name: "Banco Popular" },
  { pattern: /bhd|bhd\s*le[oó]n|bhdleon/i,                                     name: "BHD León" },
  { pattern: /scotiabank|scotia\b/i,                                             name: "Scotiabank" },
  { pattern: /banistmo/i,                                                        name: "Banistmo" },
  { pattern: /l[oó]pez\s*de\s*haro|banco\s*l[oó]pez/i,                         name: "López de Haro" },
  { pattern: /promerica/i,                                                       name: "Promerica" },
  { pattern: /citibank|citi\b/i,                                                 name: "Citibank" },
  { pattern: /vimenca/i,                                                         name: "Vimenca" },
  { pattern: /jmmb/i,                                                            name: "JMMB" },
  { pattern: /altas\s*cumbres/i,                                                 name: "Altas Cumbres" },
  { pattern: /santa\s*cruz/i,                                                    name: "Banco Santa Cruz" },
]

export function detectBank(
  paymentMethod: string,
  reference?: string | null,
  notes?: string | null,
): string {
  if (paymentMethod === "CASH") return "Efectivo"

  const text = `${reference ?? ""} ${notes ?? ""}`.trim()
  if (!text) return "Banco no identificado"

  for (const { pattern, name } of BANK_PATTERNS) {
    if (pattern.test(text)) return name
  }

  return "Banco no identificado"
}
