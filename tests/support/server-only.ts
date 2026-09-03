/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * The real package's default export throws on import — that is its whole
 * job: it turns "this module was pulled into a client bundle" into a build
 * error rather than a runtime surprise. Next.js resolves it to an empty
 * module through the `react-server` export condition, which the Vitest node
 * environment does not set, so importing any of our server modules in a test
 * would fail before a single assertion ran.
 *
 * Aliased in vitest.config.mts. This is a test-environment concern only —
 * nothing here changes what the application bundles, and the guard still
 * holds for every real build.
 */
export {}
