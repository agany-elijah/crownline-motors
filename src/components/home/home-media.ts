/**
 * The photographs and video the homepage is dressed in.
 *
 * Held in one place so replacing them with Crownline's own footage and
 * photography — the brief asks for real vehicles over stock imagery once they
 * exist — is an edit to this file rather than a hunt through the sections.
 * Paths are under /public; `alt` is empty for images that are purely
 * atmospheric.
 */
export const HOME_MEDIA = {
  /**
   * The hero's background film.
   *
   * ── Where the file goes ──────────────────────────────────────────────
   *   public/videos/hero.mp4         required — H.264 video, AAC or no audio
   *   public/videos/hero-poster.jpg  optional — a still of the first frame;
   *                                  set `poster` below when it exists
   *
   * The video is muted (it is decoration, and browsers only let muted video
   * start on its own), loops, and is not downloaded at all until a visitor
   * first moves, scrolls, touches or types — see hero-video.tsx. Keep the
   * file lean for the mobile connections this audience is on: roughly
   * 1920×1080, 10–20 seconds, under ~8MB. A WebM version can be added as a
   * second source ahead of the MP4 for browsers that support it.
   *
   * Until the file exists the hero shows its dark fallback surface, and the
   * play control does not appear.
   */
  heroVideo: {
    sources: [{ src: "/videos/hero.mp4", type: "video/mp4" }],
    poster: null as string | null,
  },
  shipping: {
    src: "/images/home/why-sourcing.jpg",
    alt: "A container ship carrying vehicles across open water",
  },
  road: { src: "/images/home/final-cta.jpg", alt: "A car transporter carrying vehicles by road" },
} as const
