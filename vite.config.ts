import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/bes-viewer-for-check/',
  plugins: [
    vue(),
    // 👇 追加するブロック
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/LICENSE\.txt$/]
      }
    })
  ],  assetsInclude: ['**/*.BES', '**/*.bes', '**/*.BESX', '**/*.besx']
})