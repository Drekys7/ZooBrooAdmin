import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), {
    name: 'local-startup-template',
    apply: 'serve',
    configureServer(server) {
      let saving = false
      server.middlewares.use('/__dev/startup-template', async (req, res) => {
        const origin = req.headers.origin
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
        if (!local || req.method !== 'POST' || req.headers['x-zooweb-template'] !== '1' || origin !== `http://${req.headers.host}`) {
          res.statusCode = 403; res.end('Nur lokal in der Admin-Oberfläche verfügbar.'); return
        }
        if (saving) { res.statusCode = 409; res.end('Eine Vorlage wird bereits gespeichert.'); return }
        saving = true
        try {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 256 * 1024 * 1024) throw new Error('Startvorlage überschreitet 256 MB.')
            chunks.push(Buffer.from(chunk))
          }
          const body = Buffer.concat(chunks).toString('utf8')
          const data = JSON.parse(body)
          if (data?.format !== 'zooweb-startup-v1' || !data.project?.id || !Array.isArray(data.assets)) throw new Error('Ungültige Startvorlage.')
          const target = resolve(server.config.root, 'public/startup-template.json')
          await copyFile(target, resolve(server.config.root, 'node_modules/.startup-template-backup.json'))
          await writeFile(`${target}.tmp`, body, 'utf8')
          await rename(`${target}.tmp`, target)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ saved: true }))
        } catch (error) {
          res.statusCode = 400
          res.end(error instanceof Error ? error.message : 'Vorlagenfehler')
        } finally { saving = false }
      })
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          framework: ['react', 'react-dom', 'zustand'],
          map: ['leaflet'],
          data: ['dexie', 'zod'],
        },
      },
    },
  },
})
