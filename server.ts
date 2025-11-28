import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static';
import app from './src/index.js'

app.use('/*', serveStatic({ root: './public' }))

serve({
  fetch: app.fetch,
  port: 7200,
})

console.log(`Server running on http://localhost:7200`)
