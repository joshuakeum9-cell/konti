import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Relative base: the built site works from any folder or sub-path (a USB stick, a church server, GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020' },
})
