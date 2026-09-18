/**
 * The photographs the homepage is dressed in.
 *
 * Held in one place so replacing them with the dealership's own photography —
 * the brief asks for real vehicles over stock imagery once they exist — is an
 * edit to this file rather than a hunt through the sections. Paths are under
 * /public; `alt` is empty for images that are purely atmospheric.
 *
 * ── Why there is no longer a hero film ────────────────────────────────
 * The hero was a 27MB MP4 held behind a "start on first interaction" gate.
 * On the mobile connections this audience is on it routinely never finished
 * downloading, so the hero sat on its fallback surface and read as broken —
 * and the gate itself depended on pointer events that a touch device does not
 * send. A single optimised photograph is the permanent answer: it is the LCP
 * element, it is preloaded, and Next's optimiser serves it as AVIF/WebP at
 * the size the device actually needs (see next.config.ts).
 */
export const HOME_MEDIA = {
  /**
   * The hero photograph.
   *
   * ── Where the file goes ──────────────────────────────────────────────
   *   public/images/home/hero.jpg
   *
   * Replace that one file to change the homepage hero; nothing else needs
   * editing. What to supply:
   *
   *   • Landscape, at least 2400×1350 (16:9). It is cropped to fill a
   *     full-height panel, so keep the subject away from the extreme edges —
   *     on a phone the frame is close to square and takes the middle.
   *   • The left third sits under the headline and is darkened by the scrim,
   *     so put the car on the right if the composition allows it.
   *   • JPEG, quality ~80, under ~600KB. It does not need to be smaller than
   *     that: the optimiser re-encodes it to AVIF/WebP per device, and the
   *     file in the repo is only the source.
   *
   * `alt` is empty because the photograph is decoration behind the site's
   * own headline — the h1 beside it carries the meaning.
   */
  hero: {
    src: "/images/home/hero.jpg",
    alt: "",
  },
  shipping: {
    src: "/images/journey/vehicle-shipping.jpg",
    alt: "A container ship carrying vehicles across open water",
  },
  road: {
    src: "/images/journey/vehicle-road.jpg",
    alt: "A car transporter carrying vehicles by road",
  },
} as const
