import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANTE: cambia 'on-juguem' si tu repositorio de GitHub se llama distinto.
// Tiene que coincidir EXACTAMENTE con el nombre del repo, porque GitHub Pages
// sirve el sitio en tu-usuario.github.io/nombre-del-repo/
const REPO_NAME = 'on-juguem'

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'On Juguem',
        short_name: 'On Juguem',
        description: 'Amistosos de pretemporada sin lios de WhatsApp',
        theme_color: '#16302B',
        background_color: '#F7F5EF',
        display: 'standalone',
        start_url: `/${REPO_NAME}/`,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
