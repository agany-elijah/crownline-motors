import type { AdminPermission } from "@/lib/auth/permissions"
import {
  PASSWORD_SETTINGS_PATH,
  SECURITY_ACTIVITY_PATH,
  SECURITY_SETTINGS_PATH,
  SESSION_SETTINGS_PATH,
  SETTINGS_BASE_PATH,
  TWO_FACTOR_SETTINGS_PATH,
} from "@/lib/constants/settings-nav"
import { adminPath } from "@/lib/constants/admin-routes"

/**
 * Settings search: every setting an operator can look for, and a forgiving
 * matcher that finds it from the words they actually type.
 *
 * Pure and dependency-free, so it runs in the browser on every keystroke and
 * is unit tested directly. Three things make it forgiving:
 *
 *   1. Synonyms. People search for the thing they want to change, not the
 *      label we gave it — "deposit", "number", "hide price", "logo", "2fa".
 *      Each query word is widened to the related words below.
 *   2. Typos. A word within one edit (two, for longer words) of a known word
 *      still matches — "whatsap", "pasword", "trakcing".
 *   3. Partial words. "notif" matches "notifications" as it is typed.
 *
 * Results are ranked, not filtered to exact matches: a query where only some
 * words match still offers its best guess, which is what "predict what I
 * meant" looks like in practice.
 */

export interface SettingsSearchEntry {
  id: string
  title: string
  /** The Settings section it lives in, shown beside the title. */
  section: string
  /** Page path plus `#anchor` — a section id or a field id. */
  href: string
  /** Extra words people might use for it. */
  keywords: string[]
  permission: AdminPermission
}

/** What the browser receives: the permission is checked on the server. */
export type SettingsSearchItem = Omit<SettingsSearchEntry, "permission">

const BUSINESS = "Business information"
const BRANDING = "Website & branding"
const COMMERCE = "Commerce & payments"
const TRACKING = "Orders & tracking"
const CATALOG = "Catalogue display"
const NOTIFICATIONS = "Notifications"
const SEO = "SEO & social"
const SECURITY = "Admin users & security"

const BRANDING_PATH = adminPath("/settings/branding")
const COMMERCE_PATH = adminPath("/settings/commerce")
const TRACKING_PATH = adminPath("/settings/orders-tracking")
const CATALOG_PATH = adminPath("/settings/catalog-display")
const NOTIFICATIONS_PATH = adminPath("/settings/notifications")
const SEO_PATH = adminPath("/settings/seo")

const settings = (entry: Omit<SettingsSearchEntry, "permission">): SettingsSearchEntry => ({
  ...entry,
  permission: "settings:read",
})
const account = (entry: Omit<SettingsSearchEntry, "permission">): SettingsSearchEntry => ({
  ...entry,
  permission: "admin:read",
})

export const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  // ── Business information ────────────────────────────────────────────
  settings({ id: "whatsapp", title: "WhatsApp number", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#whatsappNumber`, keywords: ["whatsapp", "chat", "message", "contact", "mobile", "phone"] }),
  settings({ id: "phone", title: "Primary phone number", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#primaryPhone`, keywords: ["call", "telephone", "contact", "mobile"] }),
  settings({ id: "email", title: "Business email", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#businessEmail`, keywords: ["contact", "mail", "inbox"] }),
  settings({ id: "address", title: "Address / location", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#businessAddress`, keywords: ["location", "map", "office", "showroom", "juba"] }),
  settings({ id: "business-name", title: "Business name", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#businessName`, keywords: ["company", "brand", "rename", "dealership"] }),
  settings({ id: "business-description", title: "Business description", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#businessDescription`, keywords: ["about", "tagline", "summary", "footer"] }),
  settings({ id: "default-country", title: "Default country", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#defaultCountry`, keywords: ["dialling", "code", "country", "south sudan"] }),
  settings({ id: "currency", title: "Currency", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#business-identity`, keywords: ["usd", "dollar", "money"] }),
  settings({ id: "hours", title: "Business hours", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#business-hours`, keywords: ["opening", "closing", "open", "closed", "time", "days", "weekend"] }),
  settings({ id: "social", title: "Social media links", section: BUSINESS, href: `${SETTINGS_BASE_PATH}#social-media`, keywords: ["facebook", "instagram", "tiktok", "youtube", "linkedin", "twitter", "x"] }),

  // ── Website & branding ──────────────────────────────────────────────
  settings({ id: "logos", title: "Logos and icons", section: BRANDING, href: `${BRANDING_PATH}#brand-assets`, keywords: ["logo", "favicon", "icon", "image", "upload", "brand"] }),
  settings({ id: "site-title", title: "Site title", section: BRANDING, href: `${BRANDING_PATH}#siteTitle`, keywords: ["website", "name", "tab", "browser"] }),
  settings({ id: "theme", title: "Default dashboard theme", section: BRANDING, href: `${BRANDING_PATH}#dashboard-theme`, keywords: ["dark", "light", "mode", "appearance", "colour"] }),

  // ── Commerce & payments ─────────────────────────────────────────────
  settings({ id: "payment-schedule", title: "Vehicle payment schedule", section: COMMERCE, href: `${COMMERCE_PATH}#payment-schedule`, keywords: ["deposit", "percentage", "split", "instalment", "mombasa", "final", "balance", "50", "25"] }),

  // ── Orders & tracking ───────────────────────────────────────────────
  settings({ id: "tracking-prefix", title: "Tracking number prefix", section: TRACKING, href: `${TRACKING_PATH}#trackingNumberPrefix`, keywords: ["reference", "clm", "format", "code"] }),
  settings({ id: "tracking-stages", title: "Tracking stages", section: TRACKING, href: `${TRACKING_PATH}#tracking-stages`, keywords: ["timeline", "shipment", "status", "steps", "journey", "rename"] }),
  settings({ id: "delivery-steps", title: "Spare-part delivery steps", section: TRACKING, href: `${TRACKING_PATH}#spare-part-delivery`, keywords: ["parts", "shipping", "how it arrives", "fulfilment"] }),

  // ── Catalogue display ───────────────────────────────────────────────
  settings({ id: "vehicle-visibility", title: "What customers see on vehicles", section: CATALOG, href: `${CATALOG_PATH}#vehicle-visibility`, keywords: ["hide", "show", "price", "mileage", "year", "engine", "location", "cars", "details"] }),
  settings({ id: "part-visibility", title: "What customers see on spare parts", section: CATALOG, href: `${CATALOG_PATH}#spare-part-visibility`, keywords: ["hide", "show", "price", "stock", "brand", "category", "part number", "compatibility"] }),
  settings({ id: "catalog-actions", title: "Website buttons", section: CATALOG, href: `${CATALOG_PATH}#catalog-actions`, keywords: ["get a quote", "whatsapp", "call us", "button", "cta"] }),

  // ── Notifications ───────────────────────────────────────────────────
  settings({ id: "admin-notifications", title: "Admin notifications", section: NOTIFICATIONS, href: `${NOTIFICATIONS_PATH}#admin-notifications`, keywords: ["new quote", "alert", "customer emails", "email"] }),
  settings({ id: "notification-channels", title: "Notification channels", section: NOTIFICATIONS, href: `${NOTIFICATIONS_PATH}#notification-channels`, keywords: ["email", "dashboard", "alerts", "bell"] }),

  // ── SEO & social ────────────────────────────────────────────────────
  settings({ id: "seo-title", title: "Search engine title", section: SEO, href: `${SEO_PATH}#seoDefaultTitle`, keywords: ["google", "meta", "title"] }),
  settings({ id: "seo-description", title: "Search engine description", section: SEO, href: `${SEO_PATH}#seoDefaultDescription`, keywords: ["google", "meta", "description", "snippet"] }),
  settings({ id: "social-sharing", title: "Social sharing image", section: SEO, href: `${SEO_PATH}#social-sharing`, keywords: ["open graph", "og", "preview", "facebook", "share"] }),
  settings({ id: "crawling", title: "Sitemap and indexing", section: SEO, href: `${SEO_PATH}#crawling`, keywords: ["google", "robots", "index", "crawl", "sitemap"] }),

  // ── Admin users & security ──────────────────────────────────────────
  account({ id: "account", title: "Administrator account", section: SECURITY, href: `${SECURITY_SETTINGS_PATH}#account-overview`, keywords: ["profile", "role", "me", "user"] }),
  account({ id: "display-name", title: "Your name", section: SECURITY, href: `${SECURITY_SETTINGS_PATH}#displayName`, keywords: ["profile", "rename", "display"] }),
  account({ id: "change-email", title: "Change email address", section: SECURITY, href: `${SECURITY_SETTINGS_PATH}#account-email`, keywords: ["login", "sign in", "mail"] }),
  account({ id: "two-factor", title: "Two-factor authentication", section: SECURITY, href: `${TWO_FACTOR_SETTINGS_PATH}#two-factor-status`, keywords: ["2fa", "mfa", "otp", "authenticator", "code", "verification"] }),
  account({ id: "require-2fa", title: "Require two-factor for every admin", section: SECURITY, href: `${SESSION_SETTINGS_PATH}#security-controls`, keywords: ["2fa", "enforce", "mandatory", "policy"] }),
  account({ id: "session-timeout", title: "Session timeout", section: SECURITY, href: `${SESSION_SETTINGS_PATH}#sessionTimeoutHours`, keywords: ["logout", "sign out", "expire", "idle", "hours"] }),
  account({ id: "sessions", title: "Active sessions and devices", section: SECURITY, href: `${SESSION_SETTINGS_PATH}#active-sessions`, keywords: ["devices", "logged in", "sign out", "browser"] }),
  account({ id: "login-activity", title: "Recent login activity", section: SECURITY, href: `${SESSION_SETTINGS_PATH}#login-activity`, keywords: ["sign in", "history", "attempts", "failed"] }),
  account({ id: "change-password", title: "Change password", section: SECURITY, href: `${PASSWORD_SETTINGS_PATH}#change-password`, keywords: ["login", "credentials", "reset"] }),
  account({ id: "password-recovery", title: "Password recovery", section: SECURITY, href: `${PASSWORD_SETTINGS_PATH}#password-recovery`, keywords: ["forgot", "reset", "link"] }),
  account({ id: "sign-out-all", title: "Sign out of all sessions", section: SECURITY, href: `${PASSWORD_SETTINGS_PATH}#sign-out-all`, keywords: ["logout", "everywhere", "devices"] }),
  account({ id: "audit-log", title: "Security activity log", section: SECURITY, href: `${SECURITY_ACTIVITY_PATH}#security-activity`, keywords: ["audit", "history", "changes", "who"] }),
]

/** Shown before anything is typed: the settings people come looking for most. */
export const SUGGESTED_SETTINGS = ["whatsapp", "payment-schedule", "vehicle-visibility", "hours", "logos", "two-factor"]

/**
 * Groups of words that mean the same thing to someone looking for a setting.
 * A query word in a group also matches every other word in it.
 */
const SYNONYM_GROUPS: string[][] = [
  ["whatsapp", "wa", "chat", "message", "messaging", "text"],
  ["phone", "telephone", "call", "mobile", "cell", "number", "contact"],
  ["email", "mail", "inbox", "address"],
  ["location", "address", "map", "office", "where"],
  ["hours", "opening", "open", "closing", "closed", "time", "schedule", "days"],
  ["social", "facebook", "instagram", "tiktok", "youtube", "linkedin", "twitter", "x"],
  ["logo", "favicon", "icon", "image", "picture", "brand", "branding"],
  ["theme", "dark", "light", "mode", "appearance", "colour", "color"],
  ["payment", "pay", "deposit", "percentage", "percent", "split", "instalment", "installment", "balance", "money"],
  ["tracking", "track", "shipment", "shipping", "timeline", "stages", "status", "journey", "delivery"],
  ["prefix", "reference", "code", "format"],
  ["hide", "hidden", "show", "visible", "visibility", "display", "see", "catalogue", "catalog"],
  ["price", "cost", "pricing", "amount"],
  ["stock", "inventory", "quantity", "available", "availability"],
  ["car", "cars", "vehicle", "vehicles", "listing"],
  ["part", "parts", "spare", "spares"],
  ["button", "buttons", "cta", "action", "actions", "quote"],
  ["notification", "notifications", "alert", "alerts", "notify", "bell"],
  ["seo", "google", "search", "index", "indexing", "crawl", "robots", "sitemap", "meta"],
  ["share", "sharing", "preview", "og", "graph"],
  ["password", "credentials", "reset", "forgot", "recovery"],
  ["2fa", "mfa", "otp", "two", "factor", "authenticator", "verification", "code"],
  ["session", "sessions", "device", "devices", "logout", "signout", "sign", "login", "signin", "timeout"],
  ["security", "secure", "protection", "audit", "log", "activity", "history"],
  ["account", "profile", "me", "user", "admin", "name"],
  ["business", "company", "dealership", "organisation", "organization"],
  ["description", "about", "summary", "tagline"],
]

const SYNONYMS = new Map<string, Set<string>>()
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const related = SYNONYMS.get(word) ?? new Set<string>()
    group.forEach((other) => related.add(other))
    SYNONYMS.set(word, related)
  }
}

/** Lower case, accents and punctuation removed, split into words. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
}

/** Edit distance with adjacent transpositions, capped: returns `max + 1` once exceeded. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1

  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))

  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }

  return d[a.length][b.length]
}

/** How strongly one query word matches one word of an entry, 0 to 1. */
function wordScore(query: string, word: string): number {
  if (query === word) return 1
  if (query.length >= 2 && word.startsWith(query)) return 0.85
  if (query.length >= 3 && word.includes(query)) return 0.6
  if (query.length >= 4) {
    const allowed = query.length >= 7 ? 2 : 1
    if (editDistance(query, word, allowed) <= allowed) return 0.7
    // A typo in the part typed so far: "notifc" against "notifications".
    if (word.length > query.length && editDistance(query, word.slice(0, query.length), 1) <= 1) return 0.55
  }
  return 0
}

/** The best match for one query word against a list of words, allowing synonyms. */
function bestMatch(query: string, words: string[]): number {
  let best = 0
  for (const word of words) best = Math.max(best, wordScore(query, word))

  const related = SYNONYMS.get(query) ?? findSynonymsByTypo(query)
  if (related) {
    for (const synonym of related) {
      if (synonym === query) continue
      for (const word of words) {
        if (word === synonym) best = Math.max(best, 0.65)
      }
    }
  }

  return best
}

/** Synonyms for a misspelt word: "pasword" still widens to "password"'s group. */
function findSynonymsByTypo(query: string): Set<string> | undefined {
  if (query.length < 4) return undefined
  for (const [word, related] of SYNONYMS) {
    if (word.length >= 4 && editDistance(query, word, 1) <= 1) return related
  }
  return undefined
}

const MIN_SCORE = 0.3

interface ScoredSettingsItem<T extends SettingsSearchItem> {
  entry: T
  index: number
  score: number
}

/**
 * Entries ranked for a query, best first. An empty query returns nothing —
 * the caller shows suggestions instead.
 */
export function searchSettings<T extends SettingsSearchItem>(entries: readonly T[], query: string, limit = 8): T[] {
  const queryWords = [...new Set(tokenize(query))]
  if (queryWords.length === 0) return []

  const scored: ScoredSettingsItem<T>[] = []

  for (const [index, entry] of entries.entries()) {
    const titleWords = tokenize(entry.title)
    const otherWords = [...tokenize(entry.section), ...entry.keywords.flatMap(tokenize)]

    let total = 0
    let matched = 0

    for (const word of queryWords) {
      // A match in the title counts for more than one in the keywords.
      const score = Math.max(bestMatch(word, titleWords) * 1.5, bestMatch(word, otherWords))
      if (score > 0) matched++
      total += score
    }

    if (matched === 0) continue

    // Rewards entries that account for every word the operator typed.
    const coverage = matched / queryWords.length
    scored.push({ entry, index, score: (total / queryWords.length) * (0.5 + coverage / 2) })
  }

  return scored
    // Drops the long tail of one weak partial match, which reads as noise.
    .filter((item) => item.score >= MIN_SCORE)
    // Ties keep the list's own order, which puts the primary setting before
    // the policies around it ("Two-factor authentication" before "Require
    // two-factor").
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.entry)
}
