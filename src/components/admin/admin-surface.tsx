"use client"

import * as React from "react"

/**
 * Marks the document as the staff dashboard for as long as a staff screen is
 * mounted.
 *
 * The admin layout already renders its wrapper with `data-admin` and the font
 * classes, so the first paint is correct without this component. What the
 * wrapper cannot reach is anything portalled to `<body>` — dialogs, menus,
 * the navigation drawer — which sit outside it and would otherwise open in the
 * public site's families, scale and palette over a dashboard page.
 *
 * Mirroring the marker onto `<html>` puts those portals inside the scope too.
 * It is removed on unmount, so navigating from the dashboard to the public
 * site in the same tab cannot leave the storefront wearing dashboard tokens.
 * The same arrangement as `AdminThemeProvider`, which does this for `dark`.
 */
export function AdminSurface({ fontClassName }: { fontClassName: string }) {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    const classes = fontClassName.split(/\s+/).filter(Boolean)

    root.setAttribute("data-admin", "")
    root.classList.add(...classes)

    return () => {
      root.removeAttribute("data-admin")
      root.classList.remove(...classes)
    }
  }, [fontClassName])

  return null
}
