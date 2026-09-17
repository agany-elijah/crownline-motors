import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

import { SiteSettingsProvider } from "@/components/shared/site-settings-provider";
import { siteConfig } from "@/config/site";
import { getPublicSiteSettings } from "@/lib/queries/settings.queries";

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
 * Global metadata baseline (brief §18), from Settings → Website & branding
 * and SEO & social.
 *
 * `metadataBase` is what lets every child page emit *absolute* canonical
 * and Open Graph URLs while only declaring relative ones.
 *
 * The title `template` means individual pages set only their own title
 * (e.g. "Toyota Harrier 2021") and get the configured site title appended.
 * `default` is used by pages that set no title at all.
 *
 * `robots` follows the indexing switch. A page that sets its own `robots`
 * replaces this one — every page that does so today sets `noindex`, so
 * switching indexing off can never be undone by a child page.
 *
 * The read is cached under the business-settings tag, so this does not opt
 * public pages into dynamic rendering, and a save in Settings is live on the
 * next request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  const ogImages = settings.seo.ogImageUrl
    ? [{ url: settings.seo.ogImageUrl, width: 1200, height: 630, alt: settings.businessName }]
    : undefined;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: settings.seo.title,
      template: `%s | ${settings.siteTitle}`,
    },
    description: settings.seo.description,
    applicationName: settings.siteTitle,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      siteName: settings.siteTitle,
      title: settings.seo.title,
      description: settings.seo.description,
      url: "/",
      locale: "en_GB",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seo.title,
      description: settings.seo.description,
      images: ogImages,
    },
    robots: settings.seo.indexingEnabled
      ? { index: true, follow: true }
      : { index: false, follow: false },
    icons: settings.branding.faviconUrl
      ? {
          icon: [{ url: settings.branding.faviconUrl, type: "image/png" }],
          apple: [{ url: settings.branding.faviconUrl, type: "image/png" }],
        }
      : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getPublicSiteSettings();

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
      // do it. This suppresses the warning for THIS ELEMENT'S OWN attributes
      // only — one level deep, not a tree-wide switch. The dashboard's own
      // dark class is applied to <html> after hydration for the same reason.
      suppressHydrationWarning
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          One provider for the whole application — public site, dashboard and
          the 404 page alike — so the wordmark and every client component
          reads the same configured name, number and display switches.
        */}
        <SiteSettingsProvider
          value={{
            businessName: settings.businessName,
            whatsappNumber: settings.contact.whatsappNumber,
            defaultCountry: settings.defaultCountry,
            phone: settings.contact.phone,
            callUsEnabled: settings.contact.callUsEnabled,
            logoLightUrl: settings.branding.logoLightUrl,
            logoDarkUrl: settings.branding.logoDarkUrl,
            catalogDisplay: settings.catalogDisplay,
          }}
        >
          {children}
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
