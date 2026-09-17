"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, LogOut, Moon, UserRound } from "lucide-react"

import { useAdminTheme } from "@/components/admin/admin-theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { signOutAction } from "@/lib/actions/auth.actions"
import { SECURITY_SETTINGS_PATH } from "@/lib/constants/settings-nav"
import { cn } from "@/lib/utils"

/** "Santos Agany" → "SA"; a single name → its first two letters. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-heading font-semibold tracking-wide select-none",
        "bg-gradient-to-br from-[oklch(0.86_0.13_88)] to-[oklch(0.7_0.13_78)] text-gold-foreground",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

const ITEM = "gap-2.5 rounded-lg px-2.5 py-2 text-small"

/**
 * The administrator's menu, opened from their avatar in the top bar.
 *
 * Kept to exactly what the brief asks of it, the way Linear, Vercel and GitHub
 * keep theirs: who you are, your account, the theme, and signing out — at the
 * bottom and in red, where it cannot be pressed by accident on the way to
 * something else.
 *
 * ── The theme switch does not close the menu ──────────────────────────
 * A toggle that dismissed the menu would hide the result of pressing it
 * behind a closing animation. The item stays open so the change is seen.
 *
 * ── Signing out ───────────────────────────────────────────────────────
 * Calls the same POST-only Server Action the old button did — never a GET
 * link a prefetch could fire. The item shows progress while the session is
 * revoked, because the redirect that follows can take a moment on a slow
 * connection and a menu that simply sits there invites a second press.
 */
export function AdminProfileMenu({
  name,
  email,
  roleLabel,
}: {
  name: string
  email: string
  roleLabel: string
}) {
  const { theme, setTheme } = useAdminTheme()
  const [signingOut, startSignOut] = React.useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className={cn(
          "group/avatar relative flex size-9 items-center justify-center rounded-full outline-none",
          "ring-2 ring-transparent ring-offset-2 ring-offset-background transition-[box-shadow,transform] duration-fast ease-crownline",
          "hover:ring-gold/40 focus-visible:ring-gold data-popup-open:ring-gold/70 active:scale-95"
        )}
      >
        <Avatar name={name} className="size-9 text-xs" />
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background bg-success"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-xl p-1.5 shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
          <Avatar name={name} className="size-10 text-small" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-small font-semibold text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 w-fit rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-accent-foreground uppercase">
              {roleLabel}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className={ITEM} render={<Link href={SECURITY_SETTINGS_PATH} />}>
          <UserRound aria-hidden="true" className="text-muted-foreground" />
          Account settings
        </DropdownMenuItem>

        <DropdownMenuItem
          className={cn(ITEM, "justify-between")}
          closeOnClick={false}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span className="flex items-center gap-2.5">
            <Moon aria-hidden="true" className="text-muted-foreground" />
            Dark mode
          </span>
          {/* Presentational: the item is the control, so the switch is not a
              second tab stop inside the menu. */}
          <Switch checked={theme === "dark"} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          className={ITEM}
          closeOnClick={false}
          disabled={signingOut}
          onClick={() => startSignOut(() => signOutAction())}
        >
          {signingOut ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LogOut aria-hidden="true" />}
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
