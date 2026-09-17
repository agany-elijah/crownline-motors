"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"

type VideoStatus =
  /** Not started: waiting for the visitor's first interaction. */
  | "idle"
  /** Asked to play; the file is loading. */
  | "loading"
  | "playing"
  /** Paused — by the visitor, or held while the hero is off screen. */
  | "paused"
  /** The file is missing or cannot be decoded. The fallback surface stays. */
  | "unavailable"

/** Interactions that count as the visitor "starting to move on the site". */
const ARMING_EVENTS = ["pointermove", "pointerdown", "touchstart", "wheel", "scroll", "keydown"] as const

interface NavigatorWithConnection extends Navigator {
  connection?: { saveData?: boolean }
}

/**
 * The hero's background film, started by the visitor's first interaction.
 *
 * ── Why not plain autoplay ─────────────────────────────────────────────
 * `preload="none"` means nothing is downloaded on page load. A visitor who
 * lands and leaves costs no video bytes, and the page's first paint never
 * waits on a large file — both matter on mobile data. The film starts the
 * moment someone moves the pointer, scrolls, touches or presses a key, which
 * reads as the page coming alive under their hand.
 *
 * ── Who does not get it automatically ──────────────────────────────────
 * Visitors who ask for reduced motion, and connections in data-saver mode.
 * Both keep the still fallback and a visible play control, so the choice is
 * theirs rather than taken away.
 *
 * ── The control ────────────────────────────────────────────────────────
 * Moving content that runs longer than five seconds must be pausable (WCAG
 * 2.2.2), so a pause/play button sits in the hero's corner. A visitor's own
 * pause is remembered: scrolling back to the hero does not restart a film
 * they stopped.
 */
export function HeroVideo({
  sources,
  poster,
  className,
}: {
  sources: readonly { src: string; type: string }[]
  poster: string | null
  className?: string
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [status, setStatus] = React.useState<VideoStatus>("idle")
  const pausedByVisitor = React.useRef(false)

  const play = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return

    setStatus((current) => (current === "idle" ? "loading" : current))
    video.play().catch((error: unknown) => {
      // NotAllowedError: the browser refused to start playback without a
      // gesture it recognises. Stay paused and let the control start it.
      // AbortError: a pause interrupted the request, which is expected.
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        setStatus((current) => (current === "unavailable" ? current : "paused"))
        return
      }
      console.error("[hero-video] playback failed", error)
      setStatus("unavailable")
    })
  }, [])

  // Arm on the first interaction, unless motion is reduced or data is saved.
  React.useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true
    if (reducedMotion || saveData) return

    const controller = new AbortController()
    const start = () => {
      controller.abort()
      play()
    }

    for (const type of ARMING_EVENTS) {
      window.addEventListener(type, start, { passive: true, once: true, signal: controller.signal })
    }

    return () => controller.abort()
  }, [play])

  // The browser reports a missing or undecodable file on the last <source>.
  React.useEffect(() => {
    const video = videoRef.current
    const lastSource = video?.querySelector("source:last-of-type")
    if (!video || !lastSource) return

    const markUnavailable = () => setStatus("unavailable")
    lastSource.addEventListener("error", markUnavailable)
    video.addEventListener("error", markUnavailable)

    return () => {
      lastSource.removeEventListener("error", markUnavailable)
      video.removeEventListener("error", markUnavailable)
    }
  }, [])

  // Hold the film while the hero is off screen; resume on return unless the
  // visitor paused it themselves.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(([entry]) => {
      if (video.readyState === 0 && video.paused) return
      if (!entry.isIntersecting && !video.paused) video.pause()
      else if (entry.isIntersecting && video.paused && !pausedByVisitor.current) play()
    })

    observer.observe(video)
    return () => observer.disconnect()
  }, [play])

  function toggle() {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      pausedByVisitor.current = false
      play()
    } else {
      pausedByVisitor.current = true
      video.pause()
    }
  }

  const isPlaying = status === "playing"

  return (
    <>
      <video
        ref={videoRef}
        aria-hidden="true"
        tabIndex={-1}
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="none"
        poster={poster ?? undefined}
        onPlaying={() => setStatus("playing")}
        onPause={() => setStatus((current) => (current === "unavailable" ? current : "paused"))}
        className={cn(
          "absolute inset-0 size-full object-cover",
          "transition-opacity duration-[1400ms] ease-crownline",
          // Fades in over the fallback once frames are actually arriving, so
          // the swap from still surface to moving film is never a hard cut.
          status === "playing" || status === "paused" || poster ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>

      {status !== "unavailable" ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "Pause background video" : "Play background video"}
          className={cn(
            "absolute bottom-6 left-4 z-10 grid size-11 place-items-center rounded-full sm:left-6 lg:left-12",
            "border border-white/20 bg-night/40 text-white/80 backdrop-blur-md",
            "transition-[background-color,border-color,color] duration-fast ease-crownline",
            "hover:border-gold/60 hover:bg-night/60 hover:text-gold",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          )}
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="size-4" fill="currentColor" />
          ) : (
            <Play aria-hidden="true" className="size-4 translate-x-px" fill="currentColor" />
          )}
        </button>
      ) : null}
    </>
  )
}
