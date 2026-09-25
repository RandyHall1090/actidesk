const GETTING_STARTED_STEPS = [
  "Add a few assets to your Library — at least one video link and one image or document to start.",
  "Create your first package from New Package, using those assets.",
  "Copy the link and send it to yourself (or a colleague) to see what a prospect sees.",
  "Come back to that package's detail page afterward to see the page view logged in Activity.",
];

const SECTIONS: { title: string; body: string[]; video?: { src: string; title: string } }[] = [
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
      "Optionally start from a Template to prefill everything below (see Templates), then adjust anything before saving. If you've set a ★ default template, New Package opens already filled in from it.",
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
    title: "4. Send it",
    body: [
      "ActiDesk never emails a prospect on its own. Copy the link from the package page (or from My Sites) and send it yourself — Outlook, Gmail, whatever you already use.",
      "Using Outlook? The ActiDesk panel inside Outlook builds the package and drops the link straight into your reply — see Using ActiDesk inside Outlook below.",
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
      "Set a favorite as your ★ default: on New Package (or in the Outlook panel), pick the template and click Make this my default. Every new package then starts from it, and List Merge builds every package from it. Click Remove default to go back to starting blank. Your default is yours alone — each rep picks their own.",
    ],
  },
  {
    title: "7. Using ActiDesk inside Outlook",
    video: { src: "https://player.vimeo.com/video/1230105524", title: "ActiDesk: Using ActiDesk in Outlook" },
    body: [
      "One-time setup: sign in to ActiDesk, open Account, and click Connect Outlook — sign in with the same Microsoft work account you use for Outlook. Only you can use your connection.",
      "Your admin makes the ActiDesk button appear in Outlook for everyone (see For admins below). Open any email and click ActiDesk — on the ribbon in classic Outlook, or under Apps in new Outlook and Outlook on the web. The first time, Microsoft may ask you to sign in or approve access; use your work account.",
      "The panel fills in the prospect's name and email from the email you're reading. If you've sent this person a package before, you'll see it listed with whether they opened it and played the video.",
      "Your ★ default template is already loaded. Change the template, the layout, or any asset if you like — More assets opens the rest of the slots — and edit the letter.",
      "Click Create package. Adjust the link text if you want, then click Reply with this package (when reading an email) or Insert into email (when writing one). Outlook sends it from your own mailbox, so it lands like any other email from you. Copy link and Build another are there too.",
      "If the panel says to connect first, finish the Account → Connect Outlook step above with the same Microsoft account, then reopen the panel.",
    ],
  },
  {
    title: "8. List Merge — one personal package per contact",
    body: [
      "List Merge sends a whole list of your Outlook contacts their own personal package in one go. It builds every package from your ★ default template, so set one first.",
      "Open the List Merge tab in the Outlook panel (or Account → Open List Merge on the web). Search and tick the contacts you want, and write the email text — {{first_name}} and {{full_name}} are filled in for each person, and the same fields work in your template's letter.",
      "Click Create packages, check the links, then click Send. Each email goes from your own mailbox with the subject \"A quick personal note\". On the web page you can untick Review before sending to create and send in one step.",
    ],
  },
  {
    title: "9. Layout Designer (admins only)",
    body: [
      "Go to Templates → Layout Designer to visually place every slot on a desk photo — drag to move, drag the corner handle to resize, type an exact rotation or aspect ratio.",
      "Refine one of the built-in layouts, start fresh on an existing background, or preview a candidate image of your own (that preview stays local — nothing uploads until you save).",
      "Save changes to create your organization's own custom layout — it shows up in the Layout dropdown on New Package and as the default Live Preview on Templates, right alongside the built-in ones.",
    ],
  },
  {
    title: "10. Team (admins only)",
    body: [
      "The Team page lists everyone in your organization and lets admins promote a rep to admin or demote an admin to rep.",
      "New teammates join automatically: anyone who signs up with a matching email domain joins your organization as a rep. Share the signup link shown on the Team page.",
      "Deactivating a rep also disconnects their Outlook.",
    ],
  },
  {
    title: "11. For admins: roll out the Outlook add-in",
    body: [
      "A Microsoft 365 Global or Exchange admin deploys it once for everyone: admin.microsoft.com → Settings → Integrated apps → Upload custom apps → Office Add-in → Provide link to the manifest file, paste https://www.actidesk.ai/outlook-addin/manifest.xml, and click Validate.",
      "Assign it to your sales reps (or the whole organization), accept the permissions, and click Finish deployment. It can take up to 24 hours to reach everyone; reps may need to restart Outlook. Updates reach everyone automatically after that.",
      "Each rep still connects their own Outlook once from Account. The Integrations page shows how many of your active reps have connected.",
    ],
  },
  {
    title: "Account",
    body: [
      "Change your password any time from the Account page — no email round-trip needed since you're already signed in.",
      "Connect or disconnect your Outlook here. Disconnecting stops the Outlook panel and List Merge from working until you reconnect.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Help</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        How to build and send an ActiDesk package, end to end.
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
            title="ActiDesk: Sales Rep Onboarding"
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
            {section.video && (
              <div className="mt-4 aspect-video overflow-hidden rounded-md">
                <iframe
                  src={section.video.src}
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  title={section.video.title}
                />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
