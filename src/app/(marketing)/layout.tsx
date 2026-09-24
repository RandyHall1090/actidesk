import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Barlow, Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import { ActiDeskCta } from "@/components/marketing/cta-button";
import { MARKETING_SITE_URL } from "@/lib/marketing";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const SITE_TITLE = "ActiDesk — Personalized Prospect Packages for Any Sales Team";
const SITE_DESCRIPTION =
  "Build a personalized, branded prospect page in minutes — video, audio, business card, magazine, and letter on a photoreal desk-scene template — then track exactly what a prospect opens.";

export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: MARKETING_SITE_URL,
    siteName: "ActiDesk",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

const NAV_LINK_CLASS =
  "font-mono-brand text-xs uppercase tracking-wider text-bone-dim hover:text-bone";

// The root layout owns <html>/<body> and the app's own light/dark theme;
// this wrapper is the marketing site's always-dark shell (see
// .marketing-shell in globals.css) so none of it touches the app's pages.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`marketing-shell ${plusJakarta.variable} ${barlow.variable} ${barlowCondensed.variable} flex flex-1 flex-col`}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-steel-line/60 px-6 py-5">
        <Link href="/" className="font-display text-lg font-bold text-bone">
          ACTIDESK
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/#how-it-works" className={`hidden sm:inline ${NAV_LINK_CLASS}`}>
            How it works
          </Link>
          <Link href="/#industries" className={`hidden sm:inline ${NAV_LINK_CLASS}`}>
            Industries
          </Link>
          <Link href="/#pricing" className={`hidden sm:inline ${NAV_LINK_CLASS}`}>
            Pricing
          </Link>
          <Link href="/blog" className={NAV_LINK_CLASS}>
            Blog
          </Link>
          <Link href="/login" className={NAV_LINK_CLASS}>
            Login
          </Link>
          <ActiDeskCta size="compact" />
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-steel-line/60 px-6 py-8 text-center font-mono-brand text-xs text-bone-dim">
        A Securafy product <span className="mx-2">·</span>© {new Date().getFullYear()} ActiDesk
      </footer>
    </div>
  );
}
