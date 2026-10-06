# "ActiDesk Live": webinar script

Status: **draft for Randy's approval.** Nothing is rendered or recorded until he approves it
(renders spend HeyGen credits).

Spoken narration: **2,298 words in 50 segments**. At about 150 words a minute that is **about 15
minutes** of narration, plus title cards, pauses and on-screen clicks (expect about 18 to 20
minutes finished). Shorter than ActiScan Live (about 26 minutes) because ActiDesk has less to
explain. Full runtime table and claims check at the end.

Built from the STACEY webinar kit (`~/.claude/assets/stacey/webinar-kit/README.md`,
`brief-actidesk.md`). Facts: the app code (inventory of 2026-10-05), the live pricing page, the
Help page (`src/app/(dashboard)/help/page.tsx`). Competitor figures: each vendor's own pages,
checked 5 October 2026 (`.playwright-mcp/webinar/research/competitors.md`).

Randy's decisions (2026-10-05): audience is **sales teams generally**; record in the **Securafy
account** using the template **"Securafy Master Template V1 (Copy)"** (testimonials removed);
compare against **Vidyard and BombBomb**; publish on **www.actidesk.ai and the Actiforge site**,
Vimeo folder "ActiDesk — Webinar".

## Pronunciation (give to HeyGen for both voices)

| Written | Say |
|---|---|
| STACEY | "STAY-see" |
| ActiDesk | "AK-tee-desk" |
| ActiForge | "AK-tee-forge" |
| Securafy | "Secure-a-fye" (already in the brand glossary) |
| actidesk.ai | "acti-desk dot A I" |
| Vimeo | "VIM-ee-oh" |
| Vidyard | "VID-yard" |
| BombBomb | "bomb-bomb" |

## Production notes

- STACEY always says she is an AI engine, not a person. Randy appears as his HeyGen digital twin,
  lower third "Randy Hall · CEO, Securafy (digital twin)".
- **Account on screen:** Securafy's own ActiDesk account, signed in as the test login
  `claude-dev2@securafy.com` (email blurred by the recorder). My Sites shows only the signed-in
  rep's own packages, so no real prospect appears. Never sign in as Randy or Ric on camera.
- **Sample prospects** (fictional, every name ends "(demo)"), created as claude-dev2 from the
  "(Copy)" template, each with a test open, and **deleted after recording**:
  Dana Brooks (demo), Harborview Dental (demo) · Marcus Lee (demo), Pinecrest Logistics (demo) ·
  Priya Shah (demo), Summit Legal (demo). *Needs Randy's OK: these are writes in Securafy's real
  account.*
- **Before recording:** the template's 3rd brochure ("ISO 9001:2015 Certified — Award") is in
  Randy's *personal* library, so claude-dev2 can't use it and that slot would come up empty. Randy
  (or Claude, with his OK) moves it to the Company library first.
- **Keep off camera:** the Team page (real staff emails), Billing (Securafy's real subscription),
  the admin "Team activity" leaderboard on the Dashboard (real rep names: crop or stop above it),
  the original "Securafy Master Template V1" (still has testimonials), and any real mailbox.
- **Outlook segments (4.17, 4.18):** use footage from the existing Outlook walkthrough video
  (Vimeo 1230105524), which already shows the panel and List Merge in a demo state. Recording
  live Outlook would need a real Microsoft mailbox on screen.
- **HubSpot is not shown or promised.** Automatic HubSpot sync is Securafy-only; for other
  companies the Integrations page lists HubSpot as "Request this integration".
- Walkthrough narration never names a specific open count or date, so it stays true whatever the
  demo shows on recording day.
- Each walkthrough segment is one clip (about 20 to 60 seconds). Record the clicks first, then fit
  the voice-over; STACEY speaks in the corner circle, bottom right, clear of the Ask Stacey button.

---

## Chapter 1. Cold open: the email nobody opened

Target 1:15 · Host: STACEY

**1.1** · STACEY (voice over graphic)

> Here's a sales email. It's polite, it's well written, and it says, "I'd love to show you how we
> can help." It lands between forty other emails that say the same thing. Your prospect gives it
> two seconds. Then it's archived, and you're one more name they don't remember.

VISUAL: Animated inbox card. Corner tag: "A dramatisation. Names are fictional." A row of
look-alike subject lines; one ("Quick intro, Harborview Dental (demo)") slides into Archive.

**1.2** · STACEY (voice over graphic)

> Now picture the same prospect opening a link, and finding a desk. Your video is on it, with
> your business card, your company's magazine and a letter written to them by name. They press
> play. And before they've finished watching, you know they've opened it.

VISUAL: Card sequence: a desk-scene page (screenshot of a demo package) → a play button pressed →
an email card "Dana Brooks (demo) just played your video".

**1.3** · STACEY (on camera)

> Hi. I'm STACEY: Securafy's Total Automation Control Engine for You. I'm an AI engine, not a
> person, and I'm the assistant inside ActiDesk, an ActiForge product. In the next half hour
> you'll see how ActiDesk builds a page like that in a few minutes, and tells you who's actually
> paying attention. First, here's Randy Hall on why this matters now.

VISUAL: STACEY presenter, full frame. Lower third: "STACEY · the assistant inside ActiDesk".
Title card at the end: "ActiDesk Live".

---

## Chapter 2. Why now

Target 2:45 · Host: Randy

**2.1** · Randy (on camera)

> Thanks, STACEY. I'm Randy Hall. I run Securafy, and I've spent a long time trying to get
> meetings with people who are busy and already hear from a dozen vendors a week. You're watching
> my digital twin, made from my own likeness and voice. I want to cover three things that have
> changed, and what we did about them.

VISUAL: Randy presenter. Lower third: "Randy Hall · CEO, Securafy (digital twin)".

**2.2** · Randy (on camera, then title card)

> First, meetings are harder to get. Inboxes are fuller than ever, and most outreach looks the
> same. And when you do get a meeting on the calendar, it's easy for the other side to let it
> slide, because they've never really met you.

VISUAL: Title card "1. Meetings are harder to get, and easier to skip". Randy returns for the
last line.

**2.3** · Randy (on camera, then title card)

> Second, the first impression happens before the call. People look you up before they meet you.
> By the time you say hello, they've already decided whether you're worth their time. So the
> question is what they find when they look.

VISUAL: Title card "2. The first impression happens before the call".

**2.4** · Randy (on camera, then title card)

> Third, you need to know who's actually engaged. A rep with thirty prospects can't treat them all
> the same. You want to know who opened what you sent, who watched your video, and who hasn't
> looked at all, so you call the right person at the right time.

VISUAL: Title card "3. Know who's actually engaged".

**2.5** · Randy (on camera)

> That's why we built ActiDesk. Instead of another email, each prospect gets their own page: a
> desk with your video, your card, your company's story and a personal letter. It takes a rep a
> few minutes. And every open and every play is tracked. We built it for our own sales team
> first. Securafy was its first customer, and our reps still use it.

VISUAL: Randy presenter. Cutaway: a demo desk-scene page.

**2.6** · Randy (on camera)

> In the next few minutes, STACEY will show you a real account: building a page, what your
> prospect sees, and what you see afterwards. Then what it costs, how it compares with the video
> tools you may already know, and how to start a free trial. Over to STACEY.

VISUAL: Randy presenter. Hand-off wipe to STACEY.

---

## Chapter 3. STACEY in ActiDesk

Target 1:45 · Host: STACEY

**3.1** · STACEY (on camera)

> Let me be clear about what I do here. In ActiDesk, I'm the assistant. I don't build your pages
> or write your letters. You do that, and it's quick. My job is to answer your questions while you
> work, so you never have to dig through a manual.

VISUAL: STACEY presenter.

**3.2** · STACEY (voice over screens)

> Every screen in ActiDesk has an Ask Stacey button in the bottom right corner. Ask me how to do
> something, like how to put your desk in your email signature, and I'll walk you through it,
> step by step. I answer from ActiDesk's own help guide, so the steps match the app you're
> looking at.

VISUAL: Dashboard → click the round Ask Stacey button → type "How do I put my desk picture in my
Outlook email signature?" → STACEY's answer appears.

**3.3** · STACEY (on camera)

> And what I can't do: I can't see or change anything in your account. Not your packages, your
> prospects, or your tracking. That's on purpose. Your data stays yours. You'll also find me on
> actidesk.ai, answering questions about plans and the free trial. Now, let's look at a real
> account.

VISUAL: STACEY presenter. Card: "Answers how-to questions · Can't see or change your account".

---

## Chapter 4. Live walkthrough

Target 9:30 · Host: STACEY (voice-over on screen recordings, STACEY picture-in-picture)

All clips are in Securafy's own ActiDesk account, signed in as a rep, using the sample "(demo)"
prospects.

**4.1** · STACEY (voice-over) · about 30s

> This is Securafy's own ActiDesk account. Securafy sells IT and cybersecurity services, and its
> reps use ActiDesk before first meetings. After you sign in, you land on the Dashboard. It
> shows how many packages you've sent, how many have been opened, and how many prospects played
> your video. Below that are your most recent packages.

VISUAL: Sign in → Dashboard → hover "Sent", "Opened", "Video played" → hover the Recent list.
Stop above the admin "Team activity" section.

**4.2** · STACEY (voice-over) · about 40s

> Everything on a desk comes from the Asset Library. Videos and audio messages are added as Vimeo
> links, so there's nothing big to upload. Business cards, images and PDFs are uploaded as files.
> My library is just for you. The Company library is shared with your whole team, so everyone
> sends the same, current material. Magazines show their real first page as the cover on the
> desk.

VISUAL: Asset Library → Video tab (Company library column) → Magazine tab → hover a magazine
cover → hover "My Library" column.

**4.3** · STACEY (voice-over) · about 35s

> Templates save a whole set of picks: the videos, the card, the magazines, the brochures and the
> letter. Mark one Personal, or share it with your team. You can clone any template you can see,
> and change the copy without touching the original. This one is Securafy's master template, and
> it's what most of their reps start from.

VISUAL: Templates page → hover "Securafy Master Template V1 (Copy)" → hover Clone → hover the
Personal / Shared setting.

**4.4** · STACEY (voice-over) · about 35s

> Let's build a package. Click New Package, and pick a template. Everything fills in. If you use
> the same template most days, click Make this my default, and every new package starts from it.
> Each rep picks their own default.

VISUAL: Dashboard → New Package → "Start from a template" → choose "Securafy Master Template V1
(Copy)" → fields fill → hover "Make this my default".

**4.5** · STACEY (voice-over) · about 35s

> Next, the layout. That's which desk photo the package uses, and where everything sits on it.
> Then the prospect: their name, and if you like, their company and email. ActiDesk never emails
> your prospect on its own. The email is only for your records.

VISUAL: Layout dropdown (open, hover the options, keep the current one) → type "Dana Brooks
(demo)" → "Harborview Dental (demo)" → leave email blank.

**4.6** · STACEY (voice-over) · about 40s

> Every slot on the desk has its own picker: two videos, an audio message, a business card, a pen,
> up to four magazines and up to four brochures. Swap anything for this one prospect. Leave a
> slot empty and it simply doesn't appear on their desk. Assets from the Company library are
> marked, so you know what your whole team is using.

VISUAL: Assets section → scroll through the slot pickers → open the Magazine 2 picker and hover
the "(Company)" labels → close without changing.

**4.7** · STACEY (voice-over) · about 35s

> Then the letter. Write it to them by name. On most layouts it appears as a real sheet of paper
> on the desk. Below it there's a private note, for you and your team only. Your prospect never
> sees it.

VISUAL: Letter box → type a short personal opening ("Hi Dana, …") → Private note box → type
"Met at the chamber breakfast (demo)".

**4.8** · STACEY (voice-over) · about 30s

> On the right is a Live Preview. It shows the desk exactly as your prospect will see it, and it
> updates as you change things. When it looks right, click Create Package.

VISUAL: Pan to Live Preview → change one magazine → preview updates → change it back → click
"Create Package".

**4.9** · STACEY (voice-over) · about 30s

> Now the package has its own page and its own link. Copy the link and send it however you like:
> your own email, a text, LinkedIn. It comes from you, so it lands like any other message from
> you.

VISUAL: Package detail page → hover the link → click the copy-link button.

**4.10** · STACEY (voice-over) · about 40s

> Here's what Dana sees when she opens it. No login, and nothing to install. Your company's logo
> or name is at the top, and the desk is laid out with everything you chose. It looks like someone took
> the time to prepare for her, because someone did.

VISUAL: Open the link in a clean browser (no ActiDesk session) → the desk scene loads → slow pan
across the desk.

**4.11** · STACEY (voice-over) · about 40s

> She can press play on your video right on the desk. She can open the magazine and turn the
> pages, or open a brochure. She can see your business card, and read your letter. And every one
> of those things is recorded, with the time it happened.

VISUAL: Play the video for a few seconds → pause → open the magazine → turn two pages → close →
open a brochure → close → hover the business card and the letter.

**4.12** · STACEY (voice-over) · about 25s

> And if your account has a calendar link, there's a Schedule a meeting button, so she can book
> time with you right from the page.

VISUAL: Hover the "Schedule a meeting" button. *Record only if Securafy's account has a calendar
link set on recording day; otherwise drop this segment.*

**4.13** · STACEY (voice over email card)

> The moment she first opens the page, you get an email. The same when she first plays your
> video. The subject line tells you who and what, and View activity takes you straight to the
> details. So you can follow up while you're still on her mind.

VISUAL: Email card: "Dana Brooks (demo) just played your video" → "View activity" button
highlighted.

**4.14** · STACEY (voice-over) · about 35s

> Here's that activity. Every page view, and every item she opened or played: each video, the
> audio, the magazines and each brochure, newest first, with the time. Now you know what caught
> her interest before you ever speak.

VISUAL: Package detail → Activity list → hover the most recent rows.

**4.15** · STACEY (voice-over) · about 30s

> My Sites lists every package you've sent. You can see at a glance which ones have been opened,
> how many times, and when, and which haven't been opened yet. That's your call list for the day.

VISUAL: My Sites → the three "(demo)" packages → hover "Opened" counts and a "Not opened yet"
row.

**4.16** · STACEY (voice-over) · about 30s

> Need to change something after you've sent it? Click Edit. Swap a video, fix a typo in the
> letter, change the layout. The link you already sent keeps working, and it never changes.

VISUAL: Open a "(demo)" package → Edit → change one brochure → Save → open the same link: the
change shows. (Change it back afterwards.)

**4.17** · STACEY (voice-over) · about 45s

> If your team lives in Outlook, ActiDesk works right inside it. Open an email, click ActiDesk,
> and the panel fills in the person's name and email. If you've sent them a package before, you'll
> see whether they opened it. Your default template is already loaded. Click Create package, then
> Reply with this package, and Outlook sends it from your own mailbox.

VISUAL: Footage from the Outlook walkthrough video (Vimeo 1230105524): panel opening, prefilled
contact, Create package, Reply with this package.

**4.18** · STACEY (voice-over) · about 35s

> List Merge goes further. Tick a list of Outlook contacts, write one email, and each person gets
> their own personal package, built from your default template. Their first name goes into the
> email and the letter. Check the links, then send.

VISUAL: Footage from the Outlook walkthrough video: List Merge tab, contacts ticked, Create
packages, review, Send.

**4.19** · STACEY (voice-over) · about 40s

> Every email you send can carry your desk, too. On the Account page, pick a template and type
> your name for the nameplate. ActiDesk builds a picture of your desk in about fifteen seconds.
> Click Copy signature and paste it into your Outlook signature. Anyone who clicks it sees your
> page, and the visit shows up in My Sites.

VISUAL: Account → Email signature → pick the template → nameplate "Securafy Sales (demo)" →
Create my signature → wait → picture appears → hover Copy signature. (Click Remove after
recording.)

**4.20** · STACEY (voice-over) · about 40s

> For admins, two more things. Automated follow-through: if a package sits unopened for the number
> of days you choose, ActiDesk makes a fresh follow-up page and emails the rep the link to send.
> And the Layout Designer: drag every slot onto a desk photo of your own, and save it as your
> company's layout.

VISUAL: Dashboard → "Automated follow-through" (Enabled, "After 5 days unopened", don't save) →
Templates → "Manage desk layouts" → drag one slot slightly → leave without saving.

---

## Chapter 5. What it costs

Target 3:00 · Host: STACEY

**5.1** · STACEY (on camera)

> Now the numbers. ActiDesk's prices are on the website, there's no sales call needed, and every
> plan includes every feature you've just seen. The plans differ only in how many reps they
> cover.

VISUAL: STACEY presenter.

**5.2** · STACEY (voice over price card)

> Solo is for one rep: forty-nine dollars a month, or four hundred and seventy dollars a year.
> Team covers two reps: seventy-nine dollars a month, or seven hundred and fifty-eight a year.
> Business covers five reps: a hundred and twenty-nine dollars a month, or one thousand two
> hundred and thirty-eight a year. Paying annually saves twenty percent.

VISUAL: Price card, three columns: Solo $49/mo or $470/yr · 1 rep; Team $79/mo or $758/yr · 2
reps; Business $129/mo or $1,238/yr · 5 reps ("Most popular"). Footer: "Annual saves 20%".

**5.3** · STACEY (voice over price card)

> Need more reps? On Team, each extra rep is thirty-nine dollars a month, or three hundred and
> seventy-four a year. On Business, nineteen dollars a month, or a hundred and eighty-two a year.
> A Solo account moves up to Team to add a second rep.

VISUAL: Card "Add-on reps": Team $39/user/mo or $374/yr · Business $19/user/mo or $182/yr ·
"Solo upgrades to Team for a second rep".

**5.4** · STACEY (voice over screen)

> Every company gets its own account, walled off from every other company that uses ActiDesk:
> your own reps, your own library, your own logo. When a teammate signs up with your company's
> email address, they join your account automatically, as a rep.

VISUAL: The public pricing section on actidesk.ai (annual toggle) → scroll to the add-on note.

**5.5** · STACEY (on camera)

> And every account starts with a fourteen-day free trial. No credit card needed. Build real
> packages, send them, and watch the opens come in. If you decide to keep it, choose a plan. If
> you don't, links you've already sent keep working.

VISUAL: STACEY presenter. Lower third: "14-day free trial · no credit card".

---

## Chapter 6. How ActiDesk compares

Target 2:30 · Host: STACEY

**6.1** · STACEY (on camera)

> You may already use a video tool, so let's be straight about how we compare. Every figure here
> comes from the vendor's own website, as of October twenty twenty-six. Prices change, so check
> before you decide.

VISUAL: STACEY presenter. Card: "Sources: each vendor's own pages, checked 5 October 2026."

**6.2** · STACEY (voice over comparison card)

> Vidyard describes itself as "Video for every customer moment." It records and hosts video, with
> a free plan, a paid Starter plan, and Teams and Enterprise plans that are priced on request.

VISUAL: Card "Vidyard (as of October 2026)": the quote · "Free plan" · "Starter: [price to be
confirmed on vidyard.com/pricing before render]" · "Teams, Enterprise: custom pricing". Source
line: vidyard.com, vidyard.com/pricing.

**6.3** · STACEY (voice over comparison card)

> BombBomb's promise is to "Show up face-to-face, even when you can't be there." Its Core plan is
> forty-two dollars a user each month, or thirty-six a month billed annually. Core plus Copilot,
> with its AI tools, is seventy dollars, or fifty-six billed annually.

VISUAL: Card "BombBomb (as of October 2026)": the quote · "Core $42/user/mo, or $36 billed
annually" · "Core + Copilot $70/user/mo, or $56 billed annually" · "14-day trial". Source line:
bombbomb.com/pricing.

**6.4** · STACEY (voice over comparison card)

> ActiDesk isn't a video recorder. It's the whole first impression: your video, with your business
> card, your magazines, your brochures and a personal letter, on one branded page for each
> prospect. Every open and play is tracked. From forty-nine dollars a month for one rep, or
> nineteen dollars a rep on Business.

VISUAL: Card "ActiDesk": "A branded desk page per prospect" · "Video, audio, card, magazines,
brochures, letter" · "Every open and play tracked, email alerts" · "From $49/mo · 14-day trial,
no card".

**6.5** · STACEY (on camera)

> To be fair, they do things we don't. Both record and edit video for you. ActiDesk uses video
> you've already made, from a Vimeo link. Both have browser extensions, BombBomb has mobile apps,
> and Vidyard has AI avatars and a free plan. If all you need is a quick video message, they're
> good at that.

VISUAL: STACEY presenter. Card "What they have that ActiDesk doesn't": record and edit video
(both) · browser extensions (both) · mobile apps (BombBomb) · AI avatars, free plan (Vidyard).

**6.6** · STACEY (on camera)

> But a video link is one thing to click. A desk is everything you'd hand someone across the
> table, all in one place, all tracked. And you can still put your best video on it.

VISUAL: STACEY presenter. Card "A video link" vs "A desk": one play button vs video + card +
magazine + letter + brochures.

---

## Chapter 7. Getting started, and common questions

Target 3:00 · Hosts: Randy, then STACEY, then Randy

**7.1** · Randy (on camera)

> Here's how to start. Go to actidesk.ai and click Get Started. Sign up with your work email.
> It's free for fourteen days, with no credit card. Add your video as a Vimeo link, upload your
> business card and a brochure or two, and build your first package. Send it to yourself first,
> so you see what your prospect sees. Now, STACEY's going to take the questions we hear most.

VISUAL: Randy presenter. Lower third: "actidesk.ai · 14-day free trial, no credit card".

**7.2** · STACEY (on camera) · Common questions

> First question. Do I have to record video in ActiDesk? No. ActiDesk uses video you already
> have. Put it on Vimeo, paste the link into your library, and it plays right on the desk. Audio
> messages work the same way.

VISUAL: STACEY presenter. Question card: "Do I have to record video in ActiDesk?"

**7.3** · STACEY (on camera)

> Next. Does ActiDesk email my prospects? Never on its own. You send the link yourself, from your
> own email or through Outlook, so it comes from you. The only emails ActiDesk sends are to you:
> when a prospect opens your page, and when it's time to follow up.

VISUAL: STACEY presenter. Question card: "Does ActiDesk email my prospects?"

**7.4** · STACEY (on camera)

> What does my prospect need? Just the link. There's no login and nothing to install. It opens in
> their browser, like any web page.

VISUAL: STACEY presenter. Question card: "What does my prospect need?"

**7.5** · STACEY (on camera)

> Can other companies see my packages? No. Every company has its own account, completely separate
> from every other. Inside your company, the Company library is shared with your team, and your
> admins can see the team's results.

VISUAL: STACEY presenter. Question card: "Can other companies see my packages?"

**7.6** · STACEY (on camera)

> And what happens when the trial ends? Choose a plan to keep creating new packages. If you
> don't, the links you've already sent keep working, and you can still see your account.

VISUAL: STACEY presenter. Question card: "What happens when the trial ends?"

**7.7** · Randy (on camera, then end card)

> That's ActiDesk. A personal desk for every prospect, built in minutes, and you know the moment
> they look. It's forty-nine dollars a month for one rep, and every plan has every feature. Start
> your free trial at actidesk.ai. Thanks for watching.

VISUAL: Randy presenter, then end card: "Start your 14-day free trial · actidesk.ai · no credit
card". Secondary line: "See a live example · actidesk.ai".

---

## Runtime by chapter (narration at about 150 words a minute)

| # | Chapter | Words | Narration | Finished (est.) | Note |
|---|---|---|---|---|---|
| 1 | Cold open | 154 | 1:02 | 1:15 | graphic animation fills the gaps |
| 2 | Why now | 303 | 2:01 | 2:20 | three title cards add about 15s |
| 3 | STACEY in ActiDesk | 153 | 1:01 | 1:15 | |
| 4 | Live walkthrough | 925 | 6:10 | 7:30 | clicks and page loads add about a minute |
| 5 | What it costs | 219 | 1:28 | 1:45 | price cards build line by line |
| 6 | How ActiDesk compares | 253 | 1:41 | 1:55 | |
| 7 | Getting started and questions | 291 | 1:56 | 2:15 | |
| | **Total** | **2,298** | **15:19** | **about 18:15** | |

Counted from the script's narration lines on 5 October 2026; recounted from
`presenters/segments.json` when the script is split.

---

## Claims check

Sources: **Help** = `src/app/(dashboard)/help/page.tsx`; **Inv** = code inventory of 2026-10-05
(file:line refs in the session notes); **Pricing** = `src/components/marketing/pricing-section.tsx`
and `src/app/(dashboard)/billing/BillingClient.tsx`; **Comp** =
`.playwright-mcp/webinar/research/competitors.md` (vendor pages, 5 October 2026).

| # | Claim (segment) | Source |
|---|---|---|
| 1 | STACEY = Securafy's Total Automation Control Engine for You; AI engine, not a person (1.3) | `src/lib/helpChat/content.ts` STACEY_IDENTITY |
| 2 | ActiDesk is an ActiForge product (1.3) | `content.ts` SALES_CHAT_INSTRUCTIONS; site footer |
| 3 | Cold open is a dramatisation; no statistic claimed (1.1, 1.2) | Fictional names, "(demo)" labels |
| 4 | Securafy was ActiDesk's first customer and uses it (2.5, 4.1) | `CLAUDE.md` (Securafy is first tenant); Securafy org has live packages |
| 5 | Every open and play tracked, with time (2.5, 4.11, 4.14) | Inv §2, §5: `page_view`, `asset_opened`, `asset_played` events with timestamps |
| 6 | Ask Stacey on every app screen; answers from the help guide; can't see or change account data (3.2, 3.3) | `HelpChatWidget.tsx` in the dashboard layout; `content.ts` |
| 7 | STACEY also on actidesk.ai answering plan/trial questions (3.3) | Marketing layout renders the sales-chat widget (commit c147e49) |
| 8 | Dashboard: Sent, Opened, Video played; Recent list (4.1) | Inv §1: `dashboard/page.tsx:53-75` |
| 9 | Video/audio as Vimeo links; files uploaded; My vs Company library; magazine page 1 as cover (4.2, 7.2) | Help §1; Inv §6 |
| 10 | Templates: Personal or Shared; Clone into your own copy (4.3) | Help §6 |
| 11 | ★ default via "Make this my default"; per rep (4.4) | Help §6; Inv §3 `NewPackageForm.tsx:259-277` |
| 12 | Layout = desk photo and slot positions (4.5) | Help §2 |
| 13 | Prospect name required, company and email optional; ActiDesk never emails the prospect (4.5, 7.3) | Inv §3; Help §2, §4; CLAUDE.md |
| 14 | Slots: 2 videos, audio, business card, pen, up to 4 magazines, up to 4 brochures; empty slots don't appear; "(Company)" label (4.6) | Help §2; Inv §3 `NewPackageForm.tsx:373` |
| 15 | Letter shown as paper on some layouts; private note never shown to prospect (4.7) | Help §2 ("some layouts"); Inv §3 "Private note (not shown to the prospect)" |
| 16 | Live Preview beside the form; "Create Package" (4.8) | Inv §3 `NewPackageForm.tsx:430, 443-471` |
| 17 | Package page with link and copy button (4.9) | Inv §4 `packages/[slug]/page.tsx:71-76` |
| 18 | Prospect page: no login, nothing to install; org logo at top (4.10, 7.4) | `/s/` is a public route (middleware); Inv §5 `PackageView.tsx:88-102` |
| 19 | Video plays on the desk; magazine page reader; brochures open (4.11) | Help §1; Inv §5 |
| 20 | "Schedule a meeting" button when a calendar link is set (4.12) | Inv §5 `PackageView.tsx:127-138`; `orgs.calendar_url` |
| 21 | Email to the rep on first open and first video play; "View activity" (4.13, 7.3) | Inv §2 `notifications/hot-lead/route.ts:31-64` |
| 22 | Activity list newest first, each item with time (4.14) | Inv §4 `packages/[slug]/page.tsx:30-34, 92-98` |
| 23 | My Sites: opened count and when, "Not opened yet" (4.15) | Inv §4 `packages/page.tsx:70-110` |
| 24 | Edit keeps the same link (4.16) | Help §3 |
| 25 | Outlook panel: prefilled contact, past packages with opened status, default template, Create package, Reply with this package, sends from own mailbox (4.17) | Help §7; Inv §8 |
| 26 | List Merge: tick contacts, one email, a package each from the default template, first name in email and letter, review then send (4.18) | Help §8; Inv §8 |
| 27 | Email signature: template + nameplate, about 15 seconds, Copy signature, visits in My Sites (4.19) | `SignatureCard.tsx:60-61, 85, 99, 130` |
| 28 | Automated follow-through: after N days unopened, a fresh follow-up page, rep emailed the link (admin) (4.20, 7.3) | Inv §1, §2 `FollowUpSettings.tsx`, `cron/follow-through/route.ts:43-100` |
| 29 | Layout Designer: drag slots onto a desk photo, save as the company's layout (admin) (4.20) | Help §9 |
| 30 | Prices: Solo $49/mo or $470/yr, 1 rep; Team $79/mo or $758/yr, 2 reps; Business $129/mo or $1,238/yr, 5 reps; annual saves 20% (5.2, 6.4, 7.7) | Pricing |
| 31 | Add-on reps: Team $39/mo or $374/yr; Business $19/mo or $182/yr; Solo upgrades to Team (5.3, 6.4) | Pricing |
| 32 | Every plan includes every feature; plans differ only by reps (5.1, 7.7) | Code: `billing_tier` only drives seat limits (`seatSync.ts`); no feature gating found |
| 33 | Prices on the website, no sales call needed (5.1) | Pricing section "Choose" buttons go straight to Stripe checkout |
| 34 | Separate account per company; same email domain joins as rep (5.4, 7.5) | CLAUDE.md multi-tenant; Help §10 |
| 35 | Admins see the team's results (7.5) | Inv §1 admin "Team activity" |
| 36 | 14-day free trial, no credit card (5.5, 7.1, 7.7) | `orgs.trial_ends_at` default 14 days; signup needs no card; pricing section text |
| 37 | After the trial: choose a plan to create new packages; sent links keep working; account still viewable (5.5, 7.6) | Inv §11 `lib/billing.ts:3-33` |
| 38 | Vidyard: "Video for every customer moment"; Free, Starter, Teams/Enterprise custom (6.2) | Comp (vidyard.com). **Starter price to confirm in a browser before the card is made** |
| 39 | BombBomb: quote; Core $42 or $36 annual; Core + Copilot $70 or $56 annual; 14-day trial (6.3) | Comp (bombbomb.com/pricing, /free-trial-core-copilot-monthly) |
| 40 | They record/edit video; browser extensions; BombBomb mobile apps; Vidyard AI avatars and free plan (6.5) | Comp |
| 41 | Not claimed: HubSpot for customers (Securafy-only); mobile app; recording in ActiDesk | Inv §9; noted in Production notes |
