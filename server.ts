import { serve } from '@hono/node-server'
import app from './src/index.js'

serve({
  fetch: app.fetch,
  port: 7200,
})

console.log(`Server running on http://localhost:7200`)
