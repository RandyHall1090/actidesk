"use client";

import Link from "next/link";
import Script from "next/script";
import { useSyncExternalStore } from "react";
import { TRACKING_IDS } from "@/lib/marketing";

const CONSENT_KEY = "actidesk-cookie-consent";
type Consent = "accepted" | "declined";

// Kept in memory too, so a browser that blocks localStorage can still
// dismiss the banner for the rest of the visit.
let memoryConsent: Consent | null = null;
const listeners = new Set<() => void>();

function readConsent(): Consent | "unset" {
  if (memoryConsent) return memoryConsent;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "accepted" || stored === "declined") return stored;
  } catch {
    // Storage blocked (private mode, site data disabled): treat as unset.
  }
  return "unset";
}

function writeConsent(value: Consent | null) {
  memoryConsent = value;
  try {
    if (value) window.localStorage.setItem(CONSENT_KEY, value);
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Memory copy above still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// The server can't know the choice; "pending" renders nothing so the banner
// never flashes for a visitor who already chose.
function useConsent() {
  return useSyncExternalStore(subscribe, readConsent, () => "pending" as const);
}

export function ConsentBanner() {
  const consent = useConsent();

  return (
    <>
      {consent === "accepted" && <TrackingTags />}
      {consent === "unset" && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          className="fixed bottom-4 left-4 right-24 z-40 max-w-md rounded-sm border border-steel-line bg-steel p-4 shadow-xl sm:right-auto"
        >
          <p className="text-sm leading-6 text-bone">
            We use cookies to see how visitors use this site and to measure our ads. Accept to allow
            analytics and advertising cookies, or decline and we&apos;ll only use what the site needs to work.{" "}
            <Link href="/privacy" className="text-electric underline hover:text-bone">
              Privacy Policy
            </Link>
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => writeConsent("accepted")}
              className="rounded-sm bg-electric px-4 py-1.5 font-mono-brand text-xs uppercase tracking-wider text-ink hover:bg-electric/90"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => writeConsent("declined")}
              className="rounded-sm border border-steel-line px-4 py-1.5 font-mono-brand text-xs uppercase tracking-wider text-bone hover:border-electric"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  const consent = useConsent();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        writeConsent(null);
        // Tags already running can't be unloaded in place; a reload starts
        // the page clean, and the banner asks again.
        if (consent === "accepted") window.location.reload();
      }}
    >
      Cookie settings
    </button>
  );
}

function TrackingTags() {
  const { ga4, hubspotPortal, metaPixel, linkedinPartner } = TRACKING_IDS;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} />
      <Script id="ga4-init">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`}
      </Script>
      <Script id="hs-script-loader" src={`https://js.hs-scripts.com/${hubspotPortal}.js`} />
      {metaPixel && (
        <Script id="meta-pixel">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
        </Script>
      )}
      {linkedinPartner && (
        <Script id="linkedin-insight">
          {`window._linkedin_partner_id='${linkedinPartner}';window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(window._linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s)})(window.lintrk);`}
        </Script>
      )}
    </>
  );
}
