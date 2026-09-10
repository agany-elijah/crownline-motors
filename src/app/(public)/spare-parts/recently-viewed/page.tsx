import type { Metadata } from "next"

import { Section } from "@/components/layout/section"
import { RecentlyViewedList } from "@/components/spare-parts/recently-viewed-list"
import { SparePartsBar } from "@/components/spare-parts/spare-parts-bar"

/**
 * Everything this customer has looked at in the parts catalogue.
 *
 * ── Why this route exists ─────────────────────────────────────────────
 * The strip at the bottom of a part page shows the six most recent and links
 * here for the rest. Without somewhere to land, that link would have to be a
 * control that expanded the strip in place — which is a disclosure widget on
 * the least important band of the page, and which loses the list the moment
 * the customer navigates.
 *
 * ── Why it renders nothing on the server ──────────────────────────────
 * The history lives in the customer's own browser and never reaches us (see
 * `recently-viewed-storage.ts`). There is no query behind this page and no
 * row anywhere with their name on it. Everything below the bar is a client
 * island reading `localStorage`.
 *
 * That makes the route statically renderable — no database, no cookies, no
 * dynamic rendering — which is the cheapest thing this site can serve.
 *
 * ── Why it is not indexed ─────────────────────────────────────────────
 * A crawler has no history, so the only thing a search engine could ever
 * index here is the empty state. `noindex` keeps a permanently-empty page out
 * of the results competing with the catalogue for the terms the business
 * actually wants to rank for; `follow` still lets the crawler use the links
 * back into the catalogue.
 */
export const metadata: Metadata = {
  title: "Recently viewed parts",
  description:
    "The spare parts you have looked at recently, kept in your own browser.",
  robots: { index: false, follow: true },
}

export default function RecentlyViewedPartsPage() {
  return (
    <>
      <SparePartsBar
        backHref="/spare-parts"
        backLabel="Back to spare parts"
        title="Recently viewed"
      />

      <Section spacing="compact" className="pb-16 md:pb-24">
        <RecentlyViewedList />
      </Section>
    </>
  )
}
