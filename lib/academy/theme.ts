// ============================================================
// HapiEats Academy — white-label theme sanitization.
// The institution.theme JSONB accepts only a tiny, safe subset:
// two colors + a font-family keyword. Everything is validated
// before it is written OR emitted as an inline CSS variable, so a
// malicious owner can never inject arbitrary CSS/markup via theme.
// ============================================================

export interface InstitutionTheme {
  primary: string
  accent: string
  font: string
}

const DEFAULT_THEME: InstitutionTheme = {
  primary: '#0f172a', // slate-900
  accent: '#f97316', // orange-500
  font: 'sans',
}

// Fonts are mapped to fixed, safe font stacks — the raw value never
// reaches CSS, so no injection is possible through this field.
const FONT_STACKS: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  rounded: "'Nunito', ui-rounded, 'Segoe UI', sans-serif",
  display: "'Playfair Display', Georgia, serif",
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function safeColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  return HEX.test(t) ? t : fallback
}

function safeFontKey(v: unknown): string {
  return typeof v === 'string' && v in FONT_STACKS ? v : DEFAULT_THEME.font
}

/** Coerce arbitrary stored/submitted theme JSON into a validated theme. */
export function sanitizeTheme(raw: unknown): InstitutionTheme {
  const t = (raw ?? {}) as Record<string, unknown>
  return {
    primary: safeColor(t.primary, DEFAULT_THEME.primary),
    accent: safeColor(t.accent, DEFAULT_THEME.accent),
    font: safeFontKey(t.font),
  }
}

/** Build inline CSS-variable style object for a themed shell. Values are pre-validated. */
export function themeVars(raw: unknown): Record<string, string> {
  const t = sanitizeTheme(raw)
  return {
    '--brand-primary': t.primary,
    '--brand-accent': t.accent,
    '--brand-font': FONT_STACKS[t.font] ?? FONT_STACKS.sans,
  }
}

export { DEFAULT_THEME, FONT_STACKS }
