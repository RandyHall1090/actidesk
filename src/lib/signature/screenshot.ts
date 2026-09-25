import { existsSync } from "node:fs";
import puppeteer, { type Browser, type HTTPRequest, type Page } from "puppeteer-core";

// Server-only. Renders a rep's package page in headless Chromium and turns
// the desk into a small, clickable-looking email-signature image.

const DISPLAY_WIDTH = 400; // what the signature shows it at
const SCALE = 2; // rendered at 2x so it stays sharp on high-DPI screens
// The arrow is drawn as SVG -- the serverless Chromium's fonts have no "→".
const CAPTION = "See the desk I put together for you";

// Local dev (Windows/macOS) uses an installed Chrome/Edge; @sparticuz's
// binary is Linux-only, which is what Vercel runs.
const LOCAL_BROWSERS = [
  process.env.CHROME_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((path): path is string => !!path);

async function launchBrowser(): Promise<Browser> {
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const executablePath = LOCAL_BROWSERS.find((path) => existsSync(path));
  if (!executablePath) {
    throw new Error("No local Chrome found. Set CHROME_EXECUTABLE_PATH to make signature images in dev.");
  }
  return puppeteer.launch({ executablePath, headless: true });
}

function composeHtml(deskPngBase64: string, height: number): string {
  return `<!doctype html><html><head><style>
html,body{margin:0;background:#fff}
.card{position:relative;width:${DISPLAY_WIDTH}px;height:${height}px;overflow:hidden;border-radius:8px;font-family:'Segoe UI',Arial,sans-serif}
.card img{width:100%;height:100%;object-fit:cover;display:block}
.play{position:absolute;left:50%;top:44%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(17,94,255,.92);box-shadow:0 4px 12px rgba(0,0,0,.45);border:2px solid #fff}
.play:after{content:'';position:absolute;left:20px;top:14px;border-style:solid;border-width:12px 0 12px 19px;border-color:transparent transparent transparent #fff}
.bar{position:absolute;left:0;right:0;bottom:0;height:32px;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,.55));color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600}
.bar svg{margin-left:6px}
</style></head><body><div class="card" id="card"><img src="data:image/png;base64,${deskPngBase64}"><div class="play"></div><div class="bar">${CAPTION}<svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><path d="M0 5h11M8 1l4 4-4 4" stroke="#fff" stroke-width="1.8" fill="none"/></svg></div></div></body></html>`;
}

export type SignatureImage = { jpeg: Buffer; width: number; height: number };

/** Swaps each Vimeo player for the video's thumbnail, from Vimeo's public
 * oEmbed API (the player URL keeps the unlisted hash oEmbed needs). */
async function replaceVideosWithStills(page: Page) {
  const sources = await page.$$eval("iframe", (frames) =>
    frames.map((frame) => frame.src).filter((src) => src.startsWith("https://player.vimeo.com/")),
  );
  for (const src of sources) {
    let thumbnail: string | null = null;
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(src)}`);
      if (response.ok) thumbnail = ((await response.json()) as { thumbnail_url?: string }).thumbnail_url ?? null;
    } catch {
      // Leave that frame as it is rather than fail the whole picture.
    }
    if (!thumbnail) continue;
    await page.$$eval(
      "iframe",
      (frames, [frameSrc, imageSrc]) => {
        for (const frame of frames) {
          if (frame.src !== frameSrc) continue;
          const still = document.createElement("div");
          still.style.cssText = `width:100%;height:100%;background:#000 url("${imageSrc}") center/cover no-repeat;position:relative`;
          still.innerHTML =
            '<div style="position:absolute;left:50%;top:50%;width:14%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:rgba(0,0,0,.55)"></div>';
          frame.replaceWith(still);
        }
      },
      [src, thumbnail] as const,
    );
  }
}

/** Waits (up to ~20s) for every image to load and every PDF cover canvas to
 * be drawn -- on a small serverless CPU the covers paint well after load. */
async function waitForDeskToPaint(page: Page) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => {
      const imagesDone = [...document.images].every((img) => img.complete);
      const canvases = [...document.querySelectorAll("canvas")].filter((c) => c.width > 40 && c.height > 40);
      const canvasesDrawn = canvases.every((canvas) => {
        try {
          return canvas.toDataURL("image/jpeg", 0.5).length > 8000; // a blank canvas encodes tiny
        } catch {
          return true;
        }
      });
      return imagesDone && canvasesDrawn;
    });
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await new Promise((resolve) => setTimeout(resolve, 800)); // let the last paint land
}

/** Screenshots the desk on `packageUrl` and returns a JPEG signature image,
 * plus the size (in CSS pixels) to show it at -- layouts differ in shape. */
export async function captureSignatureImage(packageUrl: string): Promise<SignatureImage> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 2400, height: 1500 });
    // Vimeo's player swaps the video for a "couldn't verify your connection"
    // notice when it sees HeadlessChrome in the user agent.
    const userAgent = (await browser.userAgent()).replace("HeadlessChrome", "Chrome");
    await page.setUserAgent({ userAgent });

    // The screenshot must not count as the rep's prospect opening the page.
    // Vimeo's player is skipped too: from a datacenter IP it shows a "couldn't
    // verify your connection" notice, so each video gets its still instead.
    await page.setRequestInterception(true);
    const onRequest = (request: HTTPRequest) => {
      if (request.isInterceptResolutionHandled()) return;
      const url = request.url();
      if (url.includes("/rpc/record_tracking_event") || url.startsWith("https://player.vimeo.com/")) {
        request.abort().catch(() => {});
      } else {
        request.continue().catch(() => {});
      }
    };
    page.on("request", onRequest);

    await page.goto(packageUrl, { waitUntil: "networkidle0", timeout: 45_000 });
    await replaceVideosWithStills(page);
    await waitForDeskToPaint(page);

    // The desk photo is the page's one large <img>; everything on the desk sits over it.
    const box = await page.evaluate(() => {
      const images = [...document.querySelectorAll("img")].map((img) => img.getBoundingClientRect());
      const desk = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return desk ? { x: desk.x + window.scrollX, y: desk.y + window.scrollY, width: desk.width, height: desk.height } : null;
    });
    if (!box || box.width < 600) throw new Error("Couldn't find the desk on the package page.");

    const desk = await page.screenshot({ clip: box, encoding: "base64", type: "png" });
    const height = Math.round(DISPLAY_WIDTH * (box.height / box.width));

    page.off("request", onRequest);
    await page.setRequestInterception(false);
    await page.setViewport({ width: DISPLAY_WIDTH + 40, height: height + 40, deviceScaleFactor: SCALE });
    await page.setContent(composeHtml(desk, height), { waitUntil: "load" });
    const card = await page.$("#card");
    if (!card) throw new Error("Couldn't build the signature image.");
    const jpeg = await card.screenshot({ type: "jpeg", quality: 82 });
    return { jpeg: Buffer.from(jpeg), width: DISPLAY_WIDTH, height };
  } finally {
    await browser.close();
  }
}

export const SIGNATURE_ALT_TEXT = CAPTION;
