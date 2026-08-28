import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Lets `prisma migrate reset` / `prisma db seed` run the seed script.
    // prisma/seed.ts is still a stub — this only wires up the entry point.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})