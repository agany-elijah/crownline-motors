import * as React from "react"

import { Container } from "@/components/layout/container"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

/**
 * The catalogue's opening statement.
 *
 * ── Why this is not the shared PageHeader ─────────────────────────────
 * `PageHeader` is the site's standard left-aligned masthead, and it is
 * still right for How It Works, Contact and the rest. The catalogue is the
 * one page whose whole job is to get a customer to the grid, so it gets a
 * centred, deliberately short band instead: breadcrumbs, one line of
 * positioning, one line of substance, a rule, and then the search. It is
 * roughly two thirds the height of the standard masthead, which on a phone
 * is the difference between the first vehicle card being visible on load
 * and being a scroll away.
 *
 * ── The entrance ──────────────────────────────────────────────────────
 * The three phrases arrive in sequence, followed by the rule drawing
 * itself out from the centre. Handled entirely by the `[data-entrance]`
 * rules in globals.css: a CSS animation, so it costs no client JavaScript,
 * plays on the first paint rather than after hydration, and is skipped
 * outright for a visitor who has asked for reduced motion.
 *
 * The offsets are short on purpose — 90ms apart, each running for the
 * design system's 400ms reveal step. The brief's rule is that a visitor
 * should come away thinking the site feels smooth, not that it has an
 * intro sequence.
 *
 * ── Why the tagline is the h1 ─────────────────────────────────────────
 * It replaces a previous h1 of "Cars", which said nothing a customer or a
 * search engine could use. The keywords the business wants to rank for
 * live in the page title (see the catalogue's `generateMetadata`) and in
 * the supporting line below, which is real visible copy rather than hidden
 * text.
 */

/** The three phrases, each with its own entrance step. */
const PHRASES = ["Quality vehicles.", "Trusted sourcing.", "Seamless delivery."]

/** Milliseconds between one phrase starting and the next. */
const PHRASE_STAGGER_MS = 90

/** Inline style carrying one element's place in the sequence. */
function step(index: number): React.CSSProperties {
  return { "--entrance-delay": `${index * PHRASE_STAGGER_MS}ms` } as React.CSSProperties
}

export function CatalogueMasthead() {
  return (
    <div className="border-b border-border bg-background">
      <Container className="flex flex-col items-center gap-4 py-7 text-center md:gap-6 md:py-11">
        {/*
          Hidden below `sm`, where the vertical budget is the whole point of
          this band and "Home › Cars" is the least of what a customer came
          for. The class sits on the trail itself rather than on a wrapper:
          `Breadcrumbs` renders the BreadcrumbList structured data as a
          sibling of the nav, so the SEO value survives the nav being
          hidden.
        */}
        <Breadcrumbs
          items={[{ label: "Cars" }]}
          className="hidden sm:block [&>ol]:justify-center"
        />

        <h1 className="text-h2 max-w-3xl text-balance">
          {PHRASES.map((phrase, index) => (
            <React.Fragment key={phrase}>
              {/*
                Each phrase is its own inline block so the stagger applies
                per phrase — and because a transform is ignored on a plain
                inline element.
              */}
              <span data-entrance="" style={step(index)} className="inline-block">
                {phrase}
              </span>
              {/*
                The separating space sits *between* the spans, not inside
                them. Trailing whitespace at the end of an inline-block is
                collapsed away by the browser, which ran the phrases
                together as "Quality vehicles.Trusted sourcing." on any
                width wide enough to fit two on one line.
              */}
              {index < PHRASES.length - 1 ? " " : null}
            </React.Fragment>
          ))}
        </h1>

        <span
          aria-hidden="true"
          data-entrance="rule"
          style={step(PHRASES.length)}
          className="block h-px w-16 bg-gold"
        />

        {/*
          The line that carries the search terms the business wants to rank
          for — Japan, Korea, South Sudan, Juba. Kept to one short sentence:
          the brief is explicit that a wall of welcome copy is what makes a
          site read as generic, and on a phone every line here is a line the
          first vehicle is pushed down by.
        */}
        <p
          data-entrance=""
          style={step(PHRASES.length + 1)}
          className="max-w-xl text-body text-muted-foreground"
        >
          Imported from Japan and South Korea, delivered across South Sudan.
        </p>
      </Container>
    </div>
  )
}
