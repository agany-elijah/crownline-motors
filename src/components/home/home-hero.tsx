import Link from "next/link"
import { ArrowRight, MessageSquareText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { heroAnchorProps } from "@/components/layout/hero-anchor"
import { AnimatedWords, wordsDuration } from "@/components/motion/animated-words"
import { CountUp } from "@/components/motion/count-up"
import { delay } from "@/components/motion/motion"
import { HeroVideo } from "@/components/home/hero-video"
import { HOME_MEDIA } from "@/components/home/home-media"

interface HomeHeroProps {
  businessName: string
  vehicleCount: number
  makeCount: number
  showQuote: boolean
}

/** The positioning statement, one line per phrase. */
const STATEMENT = ["Quality Cars.", "Global Standards.", "Local Commitment."] as const

/** When each line starts: a line begins shortly after the previous one has. */
const LINE_STARTS = STATEMENT.reduce<number[]>((starts, _line, index) => {
  const start = index === 0 ? 260 : starts[index - 1] + wordsDuration(STATEMENT[index - 1]) + 90
  return [...starts, start]
}, [])

const STATEMENT_DONE = LINE_STARTS[2] + wordsDuration(STATEMENT[2])

/** "Crownline Motors" → the lead words and the last, which is set in gold. */
function splitName(name: string) {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? { lead: words.slice(0, -1).join(" "), accent: words[words.length - 1] }
    : { lead: name.trim(), accent: null }
}

/**
 * The homepage's opening screen.
 *
 * Deliberately spare: the dealership's name, the positioning statement, the
 * two actions and three counts — nothing else. The film carries the
 * atmosphere; the words sit on the right, over a glass panel that darkens
 * behind them and clears towards the left, so most of the screen is left to
 * the moving picture.
 *
 *     ┌──────────────────────────────────────────────────────────┐
 *     │  film, frosted lightly             ░░▒▒▓▓ CROWNLINE MOTORS│
 *     │                                   ░░▒▒▓▓  Quality Cars.   │
 *     │                                   ░░▒▒▓▓  Global Standards│
 *     │                                   ░░▒▒▓▓  Local Commitment│
 *     │ ▶                                 ░░▒▒▓▓  [Explore] [Quote]│
 *     └──────────────────────────────────────────────────────────┘
 *
 * Everything animates on first paint rather than on scroll, because it is
 * already on screen: waiting for hydration would leave the most important
 * copy on the site blank on a slow phone.
 */
export function HomeHero({ businessName, vehicleCount, makeCount, showQuote }: HomeHeroProps) {
  const name = splitName(businessName)
  const stats = [
    vehicleCount > 0
      ? { value: vehicleCount, label: vehicleCount === 1 ? "Vehicle for sale" : "Vehicles for sale" }
      : null,
    makeCount > 0 ? { value: makeCount, label: makeCount === 1 ? "Make in stock" : "Makes in stock" } : null,
    { value: 2, label: "Sourcing countries" },
  ].filter((stat) => stat !== null)

  return (
    <section
      {...heroAnchorProps}
      aria-labelledby="home-hero-heading"
      // Pulled up under the fixed header, which is clear over it until the
      // visitor scrolls — see the note on <main> in the public layout.
      className="relative isolate -mt-16 flex min-h-svh flex-col overflow-hidden bg-night text-white md:-mt-20"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* The fallback surface: what shows before the film starts, and in
            place of it when it cannot play. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_25%_45%,oklch(0.8_0.145_85/0.14),transparent_70%)]" />
        <div className="bg-dot-grid absolute inset-0" />

        <HeroVideo sources={HOME_MEDIA.heroVideo.sources} poster={HOME_MEDIA.heroVideo.poster} />

        {/* The glass. A light frost across the whole film, then a deeper
            pane behind the words that clears towards the left — so the copy
            is legible and the picture stays alive where there is none. */}
        <div className="absolute inset-0 bg-night/20 backdrop-blur-[2px]" />
        <div className="hero-glass absolute inset-0 bg-night/55 backdrop-blur-xl backdrop-saturate-125" />
        <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/40 to-transparent lg:bg-gradient-to-l lg:from-night/85 lg:via-night/45 lg:via-45% lg:to-transparent lg:to-75%" />

        {/* Under the header, and into the section below. */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-night/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <Container
        size="wide"
        className="grid flex-1 grid-cols-1 items-end pt-32 pb-28 md:pt-40 lg:grid-cols-12 lg:items-center lg:pb-32"
      >
        <div className="flex flex-col gap-8 lg:col-span-6 lg:col-start-7 lg:items-end lg:text-end">
          <h1 id="home-hero-heading" className="flex flex-col gap-5 lg:items-end">
            <span
              className="load-rise flex items-center gap-3 font-heading text-small font-semibold tracking-[0.32em] uppercase"
              style={delay(120)}
            >
              <span aria-hidden="true" className="h-px w-10 bg-gold lg:order-last" />
              <span>
                <span className="text-white/90">{name.lead}</span>
                {name.accent ? <span className="text-gold"> {name.accent}</span> : null}
              </span>
            </span>
            <span className="flex flex-col text-hero">
              {STATEMENT.map((line, index) => (
                <span key={line} className="block">
                  <AnimatedWords
                    text={line}
                    trigger="load"
                    startDelay={LINE_STARTS[index]}
                    wordClassName={index === 2 ? "text-gold-sheen" : undefined}
                  />
                </span>
              ))}
            </span>
          </h1>

          <div className="load-rise flex flex-wrap gap-3 lg:justify-end" style={delay(STATEMENT_DONE + 120)}>
            <Button render={<Link href="/cars" />} size="xl" className="group/cta">
              Explore cars
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-fast ease-crownline group-hover/cta:translate-x-1"
              />
            </Button>
            {showQuote ? (
              <Button render={<Link href="/get-a-quote" />} variant="outline" size="xl" className="backdrop-blur-md">
                <MessageSquareText aria-hidden="true" className="size-4" />
                Get a quote
              </Button>
            ) : null}
          </div>

          <dl
            className="load-rise grid grid-cols-3 gap-4 border-t border-white/15 pt-7 lg:flex lg:justify-end lg:gap-x-10"
            style={delay(STATEMENT_DONE + 260)}
          >
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex flex-col gap-1 lg:items-end">
                <dt className="order-2 text-small text-white/60">{stat.label}</dt>
                <dd className="order-1 font-heading text-h2 font-bold text-white">
                  <CountUp value={stat.value} startDelay={STATEMENT_DONE + 360 + index * 120} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>

      {/* A cue that there is more below. Decorative, and hidden where the
          hero is already shorter than the screen. */}
      <div
        aria-hidden="true"
        className="load-rise pointer-events-none absolute inset-x-0 bottom-6 hidden flex-col items-center gap-2 text-small text-white/50 lg:flex [@media(max-height:820px)]:hidden"
        style={delay(STATEMENT_DONE + 700)}
      >
        Scroll to explore
        <span className="flex h-9 w-5.5 justify-center rounded-full border border-white/30 pt-2">
          <span className="scroll-cue-dot block h-2 w-1 rounded-full bg-gold" />
        </span>
      </div>
    </section>
  )
}
