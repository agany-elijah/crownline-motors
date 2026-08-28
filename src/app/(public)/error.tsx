"use client"

import * as React from "react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { ErrorState } from "@/components/shared/error-state"

/**
 * Public-site error boundary.
 *
 * Must be a client component — Next.js requires it, since `reset` is a
 * callback that re-renders the failed segment in place.
 *
 * `error.message` is deliberately never shown. In production Next.js
 * already redacts server errors down to a digest, but on the client a raw
 * message can still leak internal detail, and a stack trace is meaningless
 * to a customer trying to track a vehicle. The digest is surfaced instead:
 * it is safe to display and it is what lets staff find the matching
 * server-side log entry.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Wired to Sentry at Stage 39. Until then this at least surfaces the
    // failure in the browser console rather than swallowing it.
    console.error("[public] route error:", error)
  }, [error])

  return (
    <Container className="py-20 md:py-28">
      <ErrorState
        reference={error.digest}
        description="We couldn't load this page just now. Please try again — if it keeps happening, get in touch and we'll sort it out."
        action={
          <>
            <button onClick={reset} className={buttonVariants({ variant: "default" })}>
              Try again
            </button>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to home
            </Link>
          </>
        }
      />
    </Container>
  )
}
