import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/bes2kana-for-checking/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manual.html', 'img/*.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/LICENSE\.txt$/]
      }
    })
  ],
  build: {
    cssMinify: 'esbuild'
  },
  assetsInclude: ['**/*.BES', '**/*.bes', '**/*.BESX', '**/*.besx']
})