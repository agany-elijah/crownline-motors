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
    },
  },
})
