<script setup lang="ts">
// import { ref, onMounted } from 'vue'
import bes2unicode from './bes2unicode'
import { unicode2kana } from './unicode2kana'
import type { OutputMode, ViewMode } from './types'
import { switchMode } from './switchMode'
import { formatText } from './formatText.ts'

import { ref, computed, onMounted } from 'vue'
import Braille from './Braille.vue'
import { useI18n } from './i18n'

const { t, locale } = useI18n()
locale.value = 'ja'

const openFile = ref(false)
const str = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const bes = computed(() => str.value)
const isFileClosed = computed(() => !openFile.value)

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || !files.length) return

  const file = files[0]
  if (!file.name.toLowerCase().endsWith('.bes') && !file.name.toLowerCase().endsWith('.besx')) {
    window.alert('.bes または .besx 点字データではありません')
    input.value = ''
    return
  }

  const reader = new FileReader()
  reader.onloadend = (theFile) => {
    const target = theFile.target as FileReader
    if (target && target.readyState === FileReader.DONE) {
      openFile.value = true
      const result = target.result as ArrayBuffer
      const arr = new Uint8Array(result)
      const unicode = bes2unicode(arr)
      str.value = formatText(unicode, 'hiragana')
      // str.value = unicode2kana(unicode, {mode: 'hiragana'})
    }
  }

  reader.readAsArrayBuffer(file)
}

const onFileClose = () => {
  str.value = ''
  openFile.value = false
  if (fileInput.value) fileInput.value.value = ''
}

const onGetBesUrl = async (url: string) => {
  // const isBrfUrl = url.toLowerCase().endsWith('.brf')
  try {
    const response = await fetch(url, { method: 'GET' })
    // isBrf.value = isBrfUrl
    // if (isBrfUrl) {
    //   const text = await response.text()
    //   str.value = brf2unicode(text)
    // } else {
      const buf = await response.arrayBuffer()
      // str.value = formatBrailleText(bes2unicode(new Uint8Array(buf)))
      str.value = bes2unicode(new Uint8Array(buf))
      
    // }
    openFile.value = true
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  const params = new URL(window.location.href).searchParams
  const targetUrl = params.get('url')
  if (targetUrl && targetUrl.length > 5) {
    const lowerName = targetUrl.toLowerCase().slice(-4)
    if (lowerName.endsWith('.bes') || lowerName.endsWith('.besx')) {
      onGetBesUrl(targetUrl)
    }
  }
})


// 画面表示用の変数
const statusMessage = ref('初期化中...')
const unicodeBraille = ref('') // bes2unicodeの結果
const kanaResult = ref('')     // unicode2kanaの結果
const preview = ref<HTMLDivElement | null>(null)

const currentMode = ref<OutputMode>('hiragana')
// function replaceSpace(text: string, mode: ViewMode): string {
//   return text
//     .replace(/\u2800/g, (match) => {
//       if (mode === 'html') {
//         return '<span class="space">　</span>'
//       } else {
//         return '　'
//       }
//     })
// }
const updateDisplay = () => {
  str.value = switchMode(str.value, currentMode.value)
  // if(preview.value) {
  //   preview.value.innerHTML = switchMode(preview.value.innerHTML, currentMode.value)
  // }
}

// onMounted(async () => {
//   try {
//     statusMessage.value = 'sample.BES を読み込んでいます...'
    
//     // 1. 同階層の sample.BES を URL として取得
//     const fileUrl = new URL('./sample.BES', import.meta.url).href
//     const response = await fetch(fileUrl)
    
//     if (!response.ok) {
//       throw new Error(`ファイルの取得に失敗しました (status: ${response.status})`)
//     }
    
//     const arrayBuffer = await response.arrayBuffer()
//     const arr = new Uint8Array(arrayBuffer)

//     // 2. bes2unicode で Unicode点字文字列に変換
//     const decodedUnicode = bes2unicode(arr)
//     unicodeBraille.value = decodedUnicode // ★ここでUnicode結果を格納

//     // 3. unicode2kana で仮名変換を実行（今後実装・調整する部分）
//     const result = unicode2kana(decodedUnicode, { mode: currentMode.value })
//     kanaResult.value = replaceSpace(result, 'text')
//     console.log(kanaResult.value);
//     console.log(preview);
//     if(preview.value) preview.value.innerHTML = replaceSpace(result, 'html')
    
//     statusMessage.value = '変換が完了しました！'
//   } catch (e: any) {
//     statusMessage.value = `エラーが発生しました: ${e.message}`
//   }
// })
</script>

<!-- <template>
  <div style="padding: 20px; font-family: sans-serif;">
    <h2>点字変換 実験環境</h2>
    <p>ステータス: <strong>{{ statusMessage }}</strong></p>

    <div class="converter-panel">
      <fieldset class="mode-selector">
        <legend>出力モード選択</legend>
        <label>
          <input
            type="radio"
            v-model="currentMode"
            value="hiragana"
            @change="updateDisplay"
          />
          ひらがな
        </label>
        <label>
          <input
            type="radio"
            v-model="currentMode"
            value="katakana"
            @change="updateDisplay"
          />
          カタカナ
        </label>
      </fieldset>
    </div>

    <h3>1. bes2unicode の変換結果 (Unicode点字)</h3>
    <textarea 
      v-model="unicodeBraille" 
      rows="6" 
      style="width: 100%; font-family: monospace;"
      placeholder="ここにUnicode点字が表示されます"
    ></textarea>

    <h3>2. unicode2kana の変換結果 (読み仮名)</h3>
    <textarea 
      v-model="kanaResult" 
      rows="6" 
      style="width: 100%; font-family: monospace;"
      placeholder="ここに仮名変換結果が表示されます"
    ></textarea>

    <h3>3. unicode2kana の変換結果 (htmlタグ反映)</h3>
    <div ref="preview"></div>
  </div>
</template> -->


<template>
  <div id="app">
    <header>
      <nav class="navbar is-dark" :title="t('title')" id="main-header">
        <div class="navbar-brand">
          <h1 class="navbar-item app-title">{{ t('title') }}</h1>
        </div>

        <div id="navbarMenu" class="navbar-menu is-active">
          <div class="navbar-start">
            <div class="navbar-item">
              <label for="file">{{ t('selectFile') }}</label>
              <input 
                type="file" 
                id="file" 
                name="file" 
                accept=".bes,.BES,.besx,.BESX" 
                @change="onFileChange" 
                ref="fileInput" 
                aria-label="ファイルを選択"
              />
            </div>
            <div class="navbar-item">
              <button class="button is-small is-light" id="closeFile" :disabled="isFileClosed" @click="onFileClose">{{ t('closeFile') }}</button>
            </div>
          <div class="navbar-item" v-if="!isFileClosed">
            <fieldset class="field is-grouped">
              <div class="is-flex">
                <legend class="has-text-white mr-4">出力モード選択</legend>
                <label class="radio has-text-white mr-3">
                  <input
                    type="radio"
                    v-model="currentMode"
                    value="hiragana"
                    @change="updateDisplay"
                  />
                  ひらがな
                </label>
                <label class="radio has-text-white">
                  <input
                    type="radio"
                    v-model="currentMode"
                    value="katakana"
                    @change="updateDisplay"
                  />
                  カタカナ
                </label>
              </div>
            </fieldset>
          </div>
          </div>
          <div class="navbar-end">
            <p class="navbar-item"><hr></p>
          </div>
        </div>
      </nav>
    </header>

    <div class="container is-fluid">
        <main class="section">
          <Braille :braille="bes"></Braille>
        </main>
    </div>
    
    <footer class="footer">
      <div class="content has-text-centered">
        <p>&copy; 2026 BunYoshi | 
          <a href="https://github.com/bunyoshi/bes2kana-for-reader" target="_blank" rel="noopener noreferrer">Source Code (GitHub)</a>
        </p>
        <p style="font-size: 13px; margin-top: 5px;">
            Based on: <a href="https://github.com/brlat/brlat.github.io/" target="_blank" rel="noopener">.bes点字データをカタカナに変換</a> by 1983hachigoro (@brlat)<br>
            Original: <a href="https://github.com/shunito/bes-viewer" target="_blank" rel="noopener">UniBraille Viewer α</a> by Shunsuke Ito (@shunito)
        </p>
        <p style="font-size: 12px; margin-top: 3px;">
            Licensed under the <a href="https://raw.githubusercontent.com/bunyoshi/bes2kana-for-reader/main/LICENSE" target="_blank" rel="noopener">MIT License</a>
        </p>
      </div>
    </footer>
  </div>
</template>


<style>
#preview {
  line-height: 2;
}
.space {
  box-sizing: border-box;
  padding: 3px;
  background-color: rgb(216, 216, 216);
  background-clip: content-box;
}
.app-title {
  font-size: 1.4rem !important;
}
.footer a {
  text-decoration: underline;
}
</style>