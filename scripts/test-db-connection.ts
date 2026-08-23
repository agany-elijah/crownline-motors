import { Client } from 'pg'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const result = await client.query('SELECT NOW()')
  console.log('✅ Connected to Supabase Postgres:', result.rows[0])
  await client.end()
}

main().catch((err) => {
  console.error('❌ Database connection failed:', err)
  process.exit(1)
})
