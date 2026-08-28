/**
 * Marks the element that sits directly beneath the fixed header and is
 * dark enough for the header to drop its background over.
 *
 * SiteHeader looks this element up at runtime rather than deciding from
 * the route. That distinction is the whole point: a route list has to be
 * kept in agreement with what each page actually renders, and when it
 * falls out of step the failure is the worst kind — the header goes
 * transparent over a light page and the navigation turns white on white,
 * silently, with no error anywhere. Reading the DOM means the header can
 * only ever go transparent over something that genuinely exists.
 *
 * Spread onto the hero's outermost element:
 *
 *   <Section {...heroAnchorProps} variant="dark" spacing="none"> … </Section>
 *
 * If nothing on the page carries it, the header stays solid — which is
 * always legible, so the safe state is also the default.
 */
export const HERO_ANCHOR_ATTRIBUTE = "data-hero-anchor"

export const heroAnchorProps = { [HERO_ANCHOR_ATTRIBUTE]: "" } as const
