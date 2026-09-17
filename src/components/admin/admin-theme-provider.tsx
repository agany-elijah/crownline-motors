"use client"

import * as React from "react"

import {
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_COOKIE_MAX_AGE,
  ADMIN_THEME_COOKIE_PATH,
  type AdminThemeValue,
} from "@/lib/constants/admin-theme"

interface AdminThemeContextValue {
  theme: AdminThemeValue
  setTheme: (theme: AdminThemeValue) => void
}

const AdminThemeContext = React.createContext<AdminThemeContextValue | null>(null)

/**
 * The dashboard's theme, applied and switchable.
 *
 * The server renders the wrapper with the right class from the cookie, so the
 * first paint is already correct. After hydration the class is mirrored onto
 * `<html>` as well: menus, dialogs and drawers render into a portal on
 * `<body>`, outside this wrapper, and would otherwise open light over a dark
 * dashboard. It is removed again when the dashboard unmounts — signing out
 * lands on the staff sign-in screen, which has its own fixed dark treatment
 * and must not inherit a theme class from the page before it.
 *
 * The transition between themes is deliberately suppressed for the one frame
 * the class changes: every element with a colour transition would otherwise
 * animate at its own speed, and the page would ripple into the new theme
 * rather than switch.
 */
export function AdminThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: AdminThemeValue
  children: React.ReactNode
}) {
  const [theme, setThemeState] = React.useState<AdminThemeValue>(initialTheme)

  React.useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme

    return () => {
      root.classList.remove("dark")
      root.style.colorScheme = ""
    }
  }, [theme])

  const setTheme = React.useCallback((next: AdminThemeValue) => {
    const style = document.createElement("style")
    style.textContent = "*,*::before,*::after{transition:none!important}"
    document.head.appendChild(style)

    setThemeState(next)

    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; Path=${ADMIN_THEME_COOKIE_PATH}; Max-Age=${ADMIN_THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`

    // Two frames: one to paint the new theme with transitions off, one to
    // restore them.
    requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
  }, [])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <AdminThemeContext.Provider value={value}>
      <div className={theme === "dark" ? "dark contents" : "contents"}>{children}</div>
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme(): AdminThemeContextValue {
  const context = React.useContext(AdminThemeContext)
  if (!context) throw new Error("useAdminTheme must be used inside AdminThemeProvider.")
  return context
}
