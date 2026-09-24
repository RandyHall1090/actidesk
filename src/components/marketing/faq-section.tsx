const FAQ = [
  {
    question: "Does ActiDesk email the prospect for us?",
    answer:
      "No — a rep sends the link themselves, the same way they'd send any email. With Outlook connected, Outlook sends it from the rep's own mailbox instead; ActiDesk itself never emails a prospect directly.",
  },
  {
    question: "Do I need to connect Outlook to use it?",
    answer:
      "No — Outlook makes creating a package from a contact and sending to a whole list faster, but the create-package form works on its own with no integration connected.",
  },
  {
    question: "Is our account actually separated from every other organization on the platform?",
    answer:
      "Yes — every organization gets its own reps, asset library, and branding, fully isolated from every other tenant, verified independently against the live database rather than assumed from the schema.",
  },
  {
    question: "Will a prospect actually be able to open everything in the package?",
    answer:
      "Yes — video and audio are served through Vimeo, and every document, image, and brochure link is verified to work for a real logged-out prospect, not just previewed from an already-signed-in rep session.",
  },
  {
    question:
      "We only need 3 or 4 reps — can we just add seats to Solo or Team instead of buying Business?",
    answer:
      "No — add-on seats ($19/user/mo) are only purchasable on top of Business. Solo and Team are fixed at 1 and 2 reps; needing more means moving up to Business, which starts at 5.",
  },
];

export function FaqSection() {
  return (
    <section className="border-b border-steel-line/60 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-bold text-bone sm:text-4xl">Questions</h2>
        <div className="mt-10 flex flex-col gap-8">
          {FAQ.map((item) => (
            <div key={item.question}>
              <h3 className="font-display text-lg font-bold text-bone">{item.question}</h3>
              <p className="mt-2 text-base leading-7 text-bone-dim">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
