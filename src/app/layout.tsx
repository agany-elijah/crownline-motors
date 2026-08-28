import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

import { siteConfig } from "@/config/site";

/**
 * Two families, deliberately.
 *
 * Manrope carries the headings: geometric, subtly condensed, and it holds
 * character at display sizes where a neutral grotesque goes generic. Inter
 * carries body and UI text, where its larger x-height wins on small
 * specification tables read on a phone over mobile data.
 *
 * Both are variable fonts, so each ships one file across every weight the
 * scale uses. `display: "swap"` keeps text readable during the font fetch
 * rather than blocking on it — a real consideration on the slower
 * connections the brief calls out (§19).
 *
 * There is intentionally no third (mono) family: reference numbers get
 * `tabular-nums` from Inter instead, which costs no extra download.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Global metadata baseline (brief §18, Stage 4 "global metadata structure").
 *
 * `metadataBase` is what lets every child page emit *absolute* canonical
 * and Open Graph URLs while only declaring relative ones — without it,
 * Next.js warns and OG tags ship with relative paths that crawlers and
 * social scrapers can't resolve.
 *
 * The title `template` means individual pages set only their own title
 * (e.g. "Toyota Harrier 2021") and get the brand suffix appended
 * automatically. `default` is used by pages that set no title at all.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // globals.css sets `scroll-behavior: smooth` on <html>. Next.js needs
      // this attribute to know that is intentional, so it can suppress the
      // smooth scroll during route transitions (where it causes a visible
      // glide instead of landing at the top of the new page).
      data-scroll-behavior="smooth"
      // Browser extensions commonly stamp attributes onto <html> before
      // React hydrates — password managers, dark-mode and proxy add-ons all
      // do it (`data-dm-proxy-injected`, `data-lt-installed`, and similar).
      // React sees markup it did not render and logs a hydration mismatch
      // that no application change can prevent, because the mutation happens
      // in the user's browser.
      //
      // This suppresses the warning for THIS ELEMENT'S OWN attributes only —
      // it is one level deep, not a tree-wide switch, so a genuine mismatch
      // anywhere inside the page still reports normally. That narrowness is
      // why it is the right tool here and would be the wrong one further
      // down the tree.
      suppressHydrationWarning
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
