"use client"

import { useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { MenuIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { AdminNav } from "@/components/admin/admin-nav"
import { BrandMark } from "@/components/layout/brand-mark"
import type { AdminNavGroup } from "@/lib/constants/admin-nav"

interface AdminMobileNavProps {
  groups: AdminNavGroup[]
}

/**
 * The dashboard navigation as a slide-in drawer, below the lg breakpoint.
 *
 * Built on the Base UI Dialog primitive directly — the same choice, for the
 * same reason, as the public MobileNav: a full-height edge panel is not the
 * centred modal that `components/ui/dialog.tsx` is styled for. Base UI still
 * supplies the parts that are easy to get wrong and invisible when broken —
 * focus trapping, focus restoration to the trigger, Escape to dismiss,
 * background scroll lock.
 *
 * The drawer closes on navigation. Leaving it open over the page the user
 * just asked for is a small thing that makes an admin panel feel unfinished
 * on a phone — and the brief treats phone use as a first-class case, not an
 * afterthought (§16).
 */
export function AdminMobileNav({ groups }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open dashboard menu"
        className={cn(
          "flex size-9 items-center justify-center rounded-lg lg:hidden",
          "text-foreground transition-colors duration-fast hover:bg-secondary",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        )}
      >
        <MenuIcon className="size-5" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm",
            "duration-fast data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0"
          )}
        />
        <DialogPrimitive.Popup
          data-tone="dark"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-xs flex-col",
            "bg-foreground text-background outline-none",
            "shadow-[0_0_60px_oklch(0_0_0/0.4)]",
            "duration-base ease-crownline",
            "data-open:animate-in data-open:slide-in-from-left-full",
            "data-closed:animate-out data-closed:slide-out-to-left-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <DialogPrimitive.Title render={<BrandMark size="sm" />} />
            <DialogPrimitive.Description className="sr-only">
              Dashboard navigation
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="flex size-9 items-center justify-center rounded-lg text-background/70 transition-colors duration-fast hover:bg-white/10 hover:text-background"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <AdminNav groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
