import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// z3-solver's browser build expects its Emscripten loader to be included as a
// classic <script> (defining globalThis.initZ3, see index.html), with the wasm
// next to it. Serve both straight from node_modules in dev and emit them into
// dist on build, instead of committing the ~35MB wasm to public/.
const Z3_FILES = ['z3-built.js', 'z3-built.wasm']
const z3BuildDir = path.dirname(createRequire(import.meta.url).resolve('z3-solver/build/z3-built.js'))

// Z3 runs on threads, which need SharedArrayBuffer, which browsers only expose
// to cross-origin isolated pages.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

function z3Assets(): Plugin {
  return {
    name: 'z3-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        const fileName = Z3_FILES.find((file) => pathname.endsWith(`/${file}`))
        if (!fileName) {
          next()
          return
        }
        // Answering here skips Vite's own server.headers, but Z3's worker threads load this
        // same script and Chrome refuses them without the isolation headers.
        for (const [name, value] of Object.entries(crossOriginIsolationHeaders)) {
          res.setHeader(name, value)
        }
        res.setHeader('Content-Type', fileName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        res.end(readFileSync(path.join(z3BuildDir, fileName)))
      })
    },
    generateBundle() {
      for (const fileName of Z3_FILES) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(path.join(z3BuildDir, fileName)) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/mdp-explainer-web/',
  plugins: [react(), z3Assets()],
  // z3-solver's browser entry reads `global.initZ3`.
  define: { global: 'globalThis' },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
})
