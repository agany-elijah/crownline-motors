import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { AnimatedWords, wordsDuration } from "@/components/motion/animated-words"
import { InView } from "@/components/motion/in-view"
import { delay } from "@/components/motion/motion"
import { HOME_MEDIA } from "@/components/home/home-media"
import { WhatsAppGlyph } from "@/components/shared/whatsapp-glyph"

const LEAD = "Can't find the exact vehicle"
const ACCENT = "you're looking for?"

/**
 * The page's last invitation, for the visitor who has scrolled everything
 * and not found their car: ask for it, message us, or get in touch.
 */
export function FinalCta({
  whatsappUrl,
  showQuote,
}: {
  whatsappUrl: string | null
  showQuote: boolean
}) {
  return (
    <section aria-labelledby="home-final-heading" className="bg-background pt-4 pb-20 md:pb-28">
      <Container size="wide">
        <InView>
          <div className="rv-up" style={delay(0)}>
            <div
              className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-night px-6 py-14 sm:px-12 md:py-20 lg:px-16"
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              <div aria-hidden="true" className="absolute inset-0 -z-10">
                <Image
                  src={HOME_MEDIA.road.src}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 1200px, 100vw"
                  className="object-cover object-center opacity-45"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/30" />
              </div>

              <div className="flex max-w-2xl flex-col gap-6">
                <h2 id="home-final-heading" className="text-h1 text-white">
                  <AnimatedWords text={LEAD} startDelay={200} />{" "}
                  <span className="text-gold">
                    <AnimatedWords text={ACCENT} startDelay={200 + wordsDuration(LEAD)} />
                  </span>
                </h2>
                <p className="rv-up text-body-lg text-white/75" style={delay(700)}>
                  Tell us the make, model, year and budget you have in mind. We will source it from
                  Japan or South Korea and send you a full quotation before you commit to anything.
                </p>

                <div className="rv-up flex flex-wrap gap-3 pt-2" style={delay(850)}>
                  {showQuote ? (
                    <Button render={<Link href="/get-a-quote" />} size="xl" className="group/final">
                      Get a quote
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-fast ease-crownline group-hover/final:translate-x-1"
                      />
                    </Button>
                  ) : null}
                  {whatsappUrl ? (
                    <Button
                      render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                      variant="whatsapp"
                      size="xl"
                    >
                      <WhatsAppGlyph className="size-5" />
                      WhatsApp us
                    </Button>
                  ) : null}
                  <Button render={<Link href="/contact" />} variant="outline" size="xl">
                    <Mail aria-hidden="true" className="size-4" />
                    Contact us
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </InView>
      </Container>
    </section>
  )
}
