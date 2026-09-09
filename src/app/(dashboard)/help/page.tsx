const SECTIONS = [
  {
    title: "1. Add assets to the Library",
    body: [
      "Go to Asset Library. Video and audio are added as links (paste a Vimeo URL) — nothing to upload there. Images, documents, business cards, and your company logo are uploaded as files.",
      "Choose My library for something only you'll use, or Company library for anything the whole team should be able to pick from when building a package. Only admins can add to the company library.",
    ],
  },
  {
    title: "2. Create a package",
    body: [
      "Go to New Package. Enter the prospect's name, company, and email (email is optional — the app never sends anything on its own).",
      "For each slot (video, audio, business card, magazine, up to 4 brochures), pick an asset from your library or the company library. Any slot can be left blank — the desk-scene page only shows what you filled in.",
      "Write the letter body as plain text — it's shown as a readable note below the desk scene, not squeezed onto the photo.",
      "Click Create Package to get a unique link.",
    ],
  },
  {
    title: "3. Send it yourself",
    body: [
      "The app doesn't email the prospect. Copy the link from the package page (or from My Sites) and send it yourself — Outlook, Gmail, whatever you already use.",
    ],
  },
  {
    title: "4. See what the prospect did",
    body: [
      "Go to My Sites to see every package you've sent, whether it's been opened, and how many times.",
      "Open a specific package to see its full activity log — page views and which individual items (video, audio, business card, magazine, each brochure) were opened or played, with timestamps.",
    ],
  },
  {
    title: "5. Team (admins only)",
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
      <h2 className="text-xl font-semibold text-neutral-900">Help</h2>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        How to build and send an Online Shock-and-Awe package, end to end.
      </p>
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-sm text-neutral-600">
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
