const GETTING_STARTED_STEPS = [
  "Add a few assets to your Library — at least one video link and one image or document to start.",
  "Create your first package from New Package, using those assets.",
  "Copy the link and send it to yourself (or a colleague) to see what a prospect sees.",
  "Come back to that package's detail page afterward to see the page view logged in Activity.",
];

const SECTIONS = [
  {
    title: "1. Add assets to the Library",
    body: [
      "Go to Asset Library. Video and audio are added as links (paste a Vimeo URL) — nothing to upload there. Images, documents (PDFs), business cards, pen photos, and your company logo are uploaded as files.",
      "Choose My library for something only you'll use, or Company library for anything the whole team should be able to pick from when building a package. Any rep can add to the company library — it's not admin-only.",
      "Magazines and brochures are both PDFs, opened in the same in-app page-by-page reader — a magazine shows its real page 1 as the on-desk cover thumbnail, a brochure shows a simple branded card instead.",
    ],
  },
  {
    title: "2. Create a package",
    body: [
      "Go to New Package. Pick a Layout first — this picks which desk photo and slot positions are used; your organization's own saved layout (if it has one) is offered alongside the built-in ones.",
      "Optionally start from a Template to prefill everything below (see Templates), then adjust anything before saving.",
      "Enter the prospect's name, company, and email (email is optional — the app never sends anything on its own).",
      "For each slot — Video, a second Video, Audio, Business Card, Pen, up to 4 Magazines, and up to 4 Brochures — pick an asset from your library or the company library. Any slot can be left blank; the desk-scene page only shows what you filled in, and not every layout has room for every slot (e.g. a denser layout may not offer a 4th magazine).",
      "Write the letter body as plain text — some layouts show it as a real sheet of paper on the desk; others show it as a readable note below the desk scene instead.",
      "Click Create Package to get a unique link.",
    ],
  },
  {
    title: "3. Edit an already-sent package",
    body: [
      "Open the package from My Sites and click Edit. You can change anything — the prospect's info, the layout, any slot, the letter — and the link you already sent keeps working.",
      "The web address itself never changes, and editing never re-notifies your CRM — only creating a brand-new package does that. Only the rep who created a package can edit it.",
    ],
  },
  {
    title: "4. Send it yourself",
    body: [
      "The app doesn't email the prospect. Copy the link from the package page (or from My Sites) and send it yourself — Outlook, Gmail, whatever you already use.",
    ],
  },
  {
    title: "5. See what the prospect did",
    body: [
      "Go to My Sites to see every package you've sent, whether it's been opened, and how many times.",
      "Open a specific package to see its full activity log — page views and which individual items (each video, the audio message, the magazines, each brochure) were opened or played, with timestamps.",
    ],
  },
  {
    title: "6. Templates",
    body: [
      "Go to Templates to save a reusable bundle of asset picks and letter text, so you're not rebuilding the same package from scratch every time.",
      "Any rep can create a template. Mark it Personal to keep it to yourself, or Shared with your team so every rep can see and use it.",
      "You can edit your own templates in place, and Clone any template you can see — yours or a teammate's — into your own independent copy to tweak without touching the original.",
    ],
  },
  {
    title: "7. Layout Designer (admins only)",
    body: [
      "Go to Templates → Layout Designer to visually place every slot on a desk photo — drag to move, drag the corner handle to resize, type an exact rotation or aspect ratio.",
      "Refine one of the built-in layouts, start fresh on an existing background, or preview a candidate image of your own (that preview stays local — nothing uploads until you save).",
      "Save changes to create your organization's own custom layout — it shows up in the Layout dropdown on New Package and as the default Live Preview on Templates, right alongside the built-in ones.",
    ],
  },
  {
    title: "8. Team (admins only)",
    body: [
      "The Team page lists everyone in your organization and lets admins promote a rep to admin or demote an admin to rep.",
      "New teammates join automatically: anyone who signs up with a matching email domain joins your organization as a rep. Share the signup link shown on the Team page.",
    ],
  },
  {
    title: "Account",
    body: [
      "Change your password any time from the Account page — no email round-trip needed since you're already signed in.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Help</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        How to build and send an Online Shock-and-Awe package, end to end.
      </p>

      <section className="mb-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
        <h3 className="mb-1 text-sm font-semibold text-blue-900 dark:text-blue-200">
          New here? Start here
        </h3>
        <p className="mb-3 text-sm text-blue-800 dark:text-blue-300">
          The fastest way to get a feel for the tool is to actually build and send yourself a package. In order:
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-blue-800 dark:text-blue-300">
          {GETTING_STARTED_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="mt-4 aspect-video overflow-hidden rounded-md">
          <iframe
            src="https://player.vimeo.com/video/1227721612?h=5b3830854b"
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            title="Online Shock-and-Awe Portal: Sales Rep Onboarding"
          />
        </div>
      </section>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-sm text-neutral-600 dark:text-neutral-400">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
