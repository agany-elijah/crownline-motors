"use client"

import { useFormStatus } from "react-dom"
import { Loader2, LogOut } from "lucide-react"

import { signOutAction } from "@/lib/actions/auth.actions"
import { Button } from "@/components/ui/button"

/**
 * Sign-out control.
 *
 * A form posting to a Server Action, not a link. Sign-out changes server
 * state, and state-changing operations must not sit behind a GET: a link
 * would fire on any prefetch, on a browser preloading the URL, or from an
 * `<img src>` on a page an admin happens to visit — the classic
 * CSRF-by-logout nuisance. Next.js Server Actions are POST-only and carry
 * their own action-id protection, which is what makes this safe by default
 * (SECURITY.MD §12, §13.3).
 *
 * The Server Action is passed straight to `action`, so the form still works
 * with JavaScript disabled or still loading. `useFormStatus` — which must
 * live in a child of the form to see it — supplies the pending state on top,
 * rather than replacing the native submission with a client handler.
 */
function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          Signing out
        </>
      ) : (
        <>
          <LogOut aria-hidden="true" />
          Sign out
        </>
      )}
    </Button>
  )
}

export function AdminSignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitButton />
    </form>
  )
}
