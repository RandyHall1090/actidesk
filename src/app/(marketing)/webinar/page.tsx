import type { Metadata } from "next";
import { HeroCtas } from "@/components/marketing/cta-button";

export const metadata: Metadata = {
  title: "ActiDesk Live — On-demand Webinar",
  description:
    "Watch STACEY and Randy Hall build a personal prospect desk in a real ActiDesk account, see what the prospect sees, and how every open and play is tracked. About 13 minutes.",
  alternates: { canonical: "/webinar" },
};

// Hidden Vimeo video, embeddable only on actidesk.ai and actiforge.ai.
const VIMEO_SRC = "https://player.vimeo.com/video/1233251370?h=3ea3048ae0&title=0&byline=0&portrait=0";

// Chapter start times match the chapter markers set on the Vimeo video.
const CHAPTERS = [
  { at: "0:00", title: "Introduction", body: "The cold email nobody opens, and the desk a prospect does." },
  { at: "0:56", title: "Why now", body: "Meetings are harder to get, and first impressions happen before the call." },
  { at: "2:28", title: "STACEY in ActiDesk", body: "The assistant that answers your how-to questions while you work." },
  { at: "3:21", title: "Live walkthrough", body: "Build a package, see the prospect's desk, and track every open and play." },
  { at: "8:40", title: "What it costs", body: "Solo, Team and Business plans, add-on reps, and the free trial." },
  { at: "9:59", title: "How ActiDesk compares", body: "Vidyard and BombBomb, in their own words, as of October 2026." },
  { at: "11:36", title: "Getting started", body: "Starting your trial, and the questions we hear most." },
];

export default function WebinarPage() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono-brand text-xs uppercase tracking-[0.2em] text-electric">On-demand webinar</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-bone sm:text-5xl">ActiDesk Live</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-bone-dim">
          STACEY and Randy Hall walk through a real ActiDesk account: building a personal desk for a prospect, what
          the prospect sees, and how you know the moment they look. About 13 minutes, with captions.
        </p>

        <div className="glow-frame relative mt-10 aspect-video overflow-hidden rounded-sm">
          <iframe
            src={VIMEO_SRC}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
            title="ActiDesk Live — On-demand webinar"
          />
        </div>

        <HeroCtas className="mt-10" />

        <h2 className="mt-16 font-display text-2xl font-bold text-bone">What you&apos;ll see</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.at} className="rounded-sm border border-steel-line bg-steel/20 p-5">
              <p className="font-mono-brand text-xs uppercase tracking-wider text-electric">{chapter.at}</p>
              <h3 className="mt-2 font-display text-lg font-bold text-bone">{chapter.title}</h3>
              <p className="mt-1 text-sm leading-6 text-bone-dim">{chapter.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
