/**
 * Converts a Vimeo watch-page URL (what a rep would paste, e.g.
 * https://vimeo.com/123456789) into its embeddable player URL. Already an
 * embed URL, or an unrecognized host? Pass it through unchanged.
 */
export function toVimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : url;
}
