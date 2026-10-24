import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/bes-viewer-for-check/',
  plugins: [vue()],
  // BESファイル等をURLとして安全に取り扱えるようにする
  assetsInclude: ['**/*.BES', '**/*.bes', '**/*.BESX', '**/*.besx']
})