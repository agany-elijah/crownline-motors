import Link from "next/link"
import { ArrowRight, HelpCircle, Plus } from "lucide-react"

import { Container } from "@/components/layout/container"
import { ShowroomHeading } from "@/components/layout/showroom-heading"
import { InView } from "@/components/motion/in-view"
import { ITEM_STEP_MS, delay } from "@/components/motion/motion"
import { serializeJsonLd } from "@/lib/utils/json-ld"

export interface FaqItem {
  question: string
  answer: string
}

/** Trims a percentage for prose: 50 → "50%", 33.33 → "33.33%". */
function percent(value: number): string {
  return `${Number(value.toFixed(2))}%`
}

/**
 * The questions a first-time buyer asks before sending money abroad.
 *
 * Every answer describes how the platform actually works — the quotation, the
 * staged payments, when tracking starts — and nothing promises a time, a
 * price or a guarantee the business has not given. The payment split comes
 * from Settings, so this page cannot disagree with the orders it describes.
 */
export function buildHomeFaqs({
  businessName,
  paymentSchedule,
}: {
  businessName: string
  paymentSchedule: { initial: number; mombasa: number; final: number }
}): FaqItem[] {
  return [
    {
      question: "Where do your vehicles come from?",
      answer: `${businessName} sources vehicles from auction houses and dealers in Japan and South Korea, then ships them to customers in South Sudan through the port of Mombasa.`,
    },
    {
      question: "Is the price on a listing the final price?",
      answer:
        "The listing shows the price of the vehicle. Before you commit to anything, we send a quotation that sets out the vehicle, shipping, clearing and any other charges, so you know the full cost up front.",
    },
    {
      question: "How do payments work?",
      answer: `Vehicle orders are paid in stages: ${percent(paymentSchedule.initial)} once your order is confirmed, ${percent(paymentSchedule.mombasa)} when the vehicle arrives in Mombasa, and the final ${percent(paymentSchedule.final)} before it is handed over. Your quotation shows the amount of each payment, and every payment is checked and confirmed by our team.`,
    },
    {
      question: "How do I follow my vehicle's journey?",
      answer:
        "You receive a tracking number once your initial payment is confirmed. Enter it on Track My Order at any time to see each stage, where your vehicle is, and the expected delivery window.",
    },
    {
      question: "What if the car I want is not listed?",
      answer:
        "Send us a quote request with the make, model, year and budget you have in mind. We will look for it in Japan and South Korea and reply with a full quotation — there is no commitment until you accept it.",
    },
    {
      question: "Do you also supply spare parts?",
      answer:
        "Yes. Our spare-parts catalogue lists fitment for each part so you can check it suits your make, model and year. Order listed parts, or ask us to source one that is not.",
    },
  ]
}

/**
 * Frequently asked questions, as a single-open accordion.
 *
 * Native `<details>` elements sharing a `name`: keyboard- and screen-reader-
 * accessible with no JavaScript, and opening one closes the last. The height
 * animates where the browser supports animating to `auto`, and simply opens
 * elsewhere. Emitted as FAQPage structured data as well, for search results.
 */
export function HomeFaq({ faqs }: { faqs: FaqItem[] }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  return (
    <section aria-labelledby="home-faq-heading" className="bg-background py-20 md:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <Container size="wide">
        <InView className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="flex flex-col gap-8 lg:col-span-5">
            <ShowroomHeading
              id="home-faq-heading"
              icon={HelpCircle}
              label="Questions"
              lead="Frequently asked"
              accent="questions."
              description="The short answers to what buyers ask us most. Anything else, just ask."
            />
            <Link
              href="/contact"
              className="rv-up group/faq inline-flex w-fit items-center gap-2 py-2 text-small font-semibold text-gold transition-colors duration-fast hover:text-gold-bright"
              style={delay(500)}
            >
              Ask us a question
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-fast ease-crownline group-hover/faq:translate-x-1"
              />
            </Link>
          </div>

          <div className="flex flex-col border-t border-white/10 lg:col-span-7">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                name="home-faq"
                className="faq-item rv-up group/q border-b border-white/10"
                style={delay(300 + index * ITEM_STEP_MS)}
              >
                <summary
                  className={
                    "flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-start " +
                    "font-heading text-title text-foreground transition-colors duration-fast ease-crownline " +
                    "hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring " +
                    "[&::-webkit-details-marker]:hidden"
                  }
                >
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-gold transition-[rotate,background-color,border-color,color] duration-base ease-crownline group-open/q:rotate-45 group-open/q:border-gold group-open/q:bg-gold group-open/q:text-gold-foreground"
                  >
                    <Plus className="size-4" />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-body-lg text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </InView>
      </Container>
    </section>
  )
}
