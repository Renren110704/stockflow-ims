import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind (utility classes for layout/spacing/responsive) and MUI
  // (component primitives, via Emotion) coexist cleanly: Tailwind's Vite
  // plugin injects a single generated stylesheet, MUI injects its own
  // styles at runtime via Emotion, and neither reaches into the other's
  // class names.
  plugins: [react(), tailwindcss()],
})
