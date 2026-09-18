import * as React from "react"
import Image from "next/image"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Container } from "@/components/layout/container"
import { AnimatedWords } from "@/components/motion/animated-words"
import { delay } from "@/components/motion/motion"
import { cn } from "@/lib/utils"

/**
 * The opening band of a catalogue — Cars, and Spare Parts.
 *
 * ── Why both catalogues share one component ───────────────────────────
 * They are the same object: a photograph, the trail, one line of positioning,
 * one line of substance. Two copies would drift the moment either is touched,
 * and the brief is explicit that the parts section must feel like part of the
 * same company rather than a separate website. The differences between them
 * are content, so they are props.
 *
 * ── Why it is short ───────────────────────────────────────────────────
 * Deliberately about two thirds the height of the standard `PageHeader`. A
 * catalogue's whole job is to get a customer to the grid, and on a phone
 * every line here is a line the first card is pushed down by. It is a band
 * with a photograph behind it, not a full-height hero — that treatment
 * belongs to the homepage, which is the one page whose job is to make an
 * impression rather than to answer a question.
 *
 * ── The photograph ────────────────────────────────────────────────────
 * Sits behind a scrim heavy enough that white text clears WCAG AA over any
 * part of it, so a replacement photograph can never quietly break the
 * contrast of the heading on top. `preload` because this is the LCP element
 * on both pages.
 */
interface CatalogueHeroProps {
  /** Path under /public. */
  imageSrc: string
  /** The single breadcrumb after Home — "Cars", "Spare Parts". */
  breadcrumbLabel: string
  /** Small gold line above the heading. */
  eyebrow: string
  /**
   * The heading, as phrases. Each arrives after the last, and the final one
   * is set in gold — the same treatment the homepage statement gets.
   */
  phrases: readonly string[]
  /** One sentence beneath the rule. Carries the page's search terms. */
  supporting: string
  /**
   * Where the focal point of the photograph sits, as an `object-position`.
   * Defaults to the centre.
   */
  imagePosition?: string
  className?: string
}

/** Milliseconds between one phrase starting and the next. */
const PHRASE_STAGGER_MS = 90

export function CatalogueHero({
  imageSrc,
  breadcrumbLabel,
  eyebrow,
  phrases,
  supporting,
  imagePosition = "center",
  className,
}: CatalogueHeroProps) {
  const afterPhrases = 160 + phrases.length * PHRASE_STAGGER_MS * 3

  return (
    <section
      // Marks the band dark, which is what re-points the button and link
      // treatments in globals.css rather than hand-patching classes here.
      data-tone="dark"
      className={cn("relative isolate overflow-hidden bg-night text-white", className)}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src={imageSrc}
          alt=""
          fill
          preload
          fetchPriority="high"
          sizes="100vw"
          style={{ objectPosition: imagePosition }}
          className="load-settle object-cover"
        />
        {/*
          Two layers, not one: a flat wash that guarantees the contrast floor
          wherever the text falls, and a bottom gradient that carries the band
          into the search bar below it instead of ending on a hard edge.
        */}
        <div className="absolute inset-0 bg-night/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/45 to-night/25" />
      </div>

      <Container className="flex flex-col items-center gap-4 py-10 text-center sm:py-12 md:gap-5 md:py-16">
        {/*
          Hidden below `sm`, where the vertical budget is the whole point of
          this band. The class sits on the trail itself rather than on a
          wrapper: `Breadcrumbs` renders the BreadcrumbList structured data as
          a sibling of the nav, so the SEO value survives the nav being
          hidden.
        */}
        <Breadcrumbs
          items={[{ label: breadcrumbLabel }]}
          className="hidden sm:block [&>ol]:justify-center"
        />

        <p className="load-rise eyebrow text-gold" style={delay(80)}>
          {eyebrow}
        </p>

        <h1 className="text-h2 max-w-3xl text-balance">
          {phrases.map((phrase, index) => (
            <React.Fragment key={phrase}>
              <span className={index === phrases.length - 1 ? "text-gold" : undefined}>
                <AnimatedWords
                  text={phrase}
                  trigger="load"
                  startDelay={160 + index * PHRASE_STAGGER_MS * 3}
                />
              </span>
              {/*
                The separating space sits *between* the spans, not inside
                them. Trailing whitespace at the end of an inline-block is
                collapsed away by the browser, which ran the phrases together
                on any width wide enough to fit two on one line.
              */}
              {index < phrases.length - 1 ? " " : null}
            </React.Fragment>
          ))}
        </h1>

        <span
          aria-hidden="true"
          className="load-rise block h-px w-16 bg-gold"
          style={delay(afterPhrases)}
        />

        <p
          className="load-rise max-w-xl text-body text-white/75"
          style={delay(afterPhrases + 90)}
        >
          {supporting}
        </p>
      </Container>
    </section>
  )
}
