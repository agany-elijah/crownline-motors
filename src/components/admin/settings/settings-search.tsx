"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CornerDownLeft, Search } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  SUGGESTED_SETTINGS,
  searchSettings,
  type SettingsSearchItem,
} from "@/lib/settings/settings-search"

/** How long to wait for the destination page to render the anchor. */
const ANCHOR_WAIT_MS = 4000

/**
 * Settings search: a small trigger beside the title, and a command-style
 * panel that opens over the page.
 *
 * ⌘K / Ctrl+K opens it from anywhere in Settings. Arrow keys move, Enter
 * goes. Choosing a result navigates to its page, scrolls the setting into
 * view, briefly highlights it and — when it is a field — puts the cursor in
 * it, so "whatsapp" → Enter leaves the operator typing the number.
 */
export function SettingsSearch({ entries }: { entries: SettingsSearchItem[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listId = React.useId()

  const results = React.useMemo(() => {
    if (query.trim() === "") {
      return SUGGESTED_SETTINGS.flatMap((id) => entries.filter((entry) => entry.id === id))
    }
    return searchSettings(entries, query)
  }, [entries, query])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) {
      setQuery("")
      setActive(0)
    }
  }

  function go(entry: SettingsSearchItem) {
    changeOpen(false)
    const [path, anchor] = entry.href.split("#")
    if (path !== pathname) router.push(entry.href, { scroll: !anchor })
    if (anchor) revealWhenRendered(anchor)
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (results.length === 0 ? 0 : (index + 1) % results.length))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const entry = results[active]
      if (entry) go(entry)
    }
  }

  const activeId = results[active] ? `${listId}-${results[active].id}` : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search settings"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          "group/search inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card text-small text-muted-foreground",
          "transition-colors duration-fast hover:border-foreground/20 hover:text-foreground",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          "w-9 justify-center sm:w-60 sm:justify-start sm:px-2.5"
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search settings</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-sans text-[0.6875rem] leading-5 text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Search settings</DialogTitle>

          <div className="flex items-center gap-2.5 border-b border-border px-3.5">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={onInputKeyDown}
              placeholder="What do you want to change?"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              className="h-12 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-sans text-[0.6875rem] leading-5 text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
            {query.trim() === "" && results.length > 0 ? (
              <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Suggested</p>
            ) : null}

            {results.length > 0 ? (
              <ul id={listId} role="listbox" aria-label="Settings">
                {results.map((entry, index) => (
                  <li
                    key={entry.id}
                    id={`${listId}-${entry.id}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                      index === active ? "bg-muted" : undefined
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-small font-medium text-foreground">{entry.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{entry.section}</span>
                    </span>
                    {index === active ? (
                      <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p id={listId} className="px-3 py-8 text-center text-small text-muted-foreground">
                Nothing matches “{query.trim()}”. Try a word like “phone”, “deposit” or “logo”.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Scrolls to `anchor` once the page shows it, highlights it, and focuses it
 * when it is a form field. Waits because the destination may still be
 * loading after a navigation.
 */
function revealWhenRendered(anchor: string) {
  const started = performance.now()

  const attempt = () => {
    const target = document.getElementById(anchor)

    if (!target) {
      if (performance.now() - started < ANCHOR_WAIT_MS) requestAnimationFrame(attempt)
      return
    }

    // A field is highlighted together with its label and hint.
    const isField = target.matches("input, select, textarea")
    const highlight = (isField ? target.closest<HTMLElement>("[data-settings-field]") : null) ?? target

    target.scrollIntoView({ behavior: "smooth", block: "center" })
    highlight.removeAttribute("data-search-hit")
    // Re-read layout so the animation restarts when the same result is chosen twice.
    void highlight.offsetWidth
    highlight.setAttribute("data-search-hit", "")
    window.setTimeout(() => highlight.removeAttribute("data-search-hit"), 1800)

    if (isField && !(target as HTMLInputElement).disabled) target.focus({ preventScroll: true })
  }

  requestAnimationFrame(attempt)
}
