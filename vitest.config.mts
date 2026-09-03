import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Node environment by default: everything Stage 37 calls for — pricing
    // and payment calculations, order/tracking status transitions, Zod
    // schemas, reference-number generation, authorization logic — is pure
    // logic with no DOM. Add jsdom + @vitejs/plugin-react only when a real
    // component test needs them, rather than carrying unused deps now.
    environment: "node",

    // Scoped to tests/unit so Vitest never tries to execute the Playwright
    // specs in tests/e2e — the two runners share a .spec/.test vocabulary
    // and will happily pick up each other's files otherwise.
    include: ["tests/unit/**/*.test.ts"],

    globals: false,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "./src/*" mapping in tsconfig.json. Kept as a
      // plain alias instead of pulling in vite-tsconfig-paths for one line.
      "@": fileURLToPath(new URL("./src", import.meta.url)),

      /**
       * `server-only` throws the moment it is imported outside a React
       * Server Component — Next.js swaps it for an empty module through the
       * `react-server` export condition, which this environment does not
       * set. Without the alias, importing any server module under test
       * (the photograph pipeline, the catalogue reads) fails at import time.
       *
       * It replaces the guard *in tests only*. Every real build still
       * resolves the package itself, so a `server-only` module pulled into a
       * client bundle is still a build error.
       */
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only.ts", import.meta.url)
      ),
    },
  },
})
