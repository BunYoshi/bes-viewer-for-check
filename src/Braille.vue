<template>
  <p v-if="isFileClose" class="is-size-2 is-size-4-mobile">{{ t('placeholder') }}</p>
  <div v-else class="besbody is-size-3 is-size-5-mobile" role="document">
    <div class="copy-controls">
      <button type="button" class="button is-small" @click="copyBody">{{ t('copyBody') }}</button>
      <p role="status" aria-live="polite">{{ copyStatus }}</p>
    </div>
    <article ref="containerRef">
      <section v-for="(page,pno) in bes.body" :key="pno" class="columns page">
        <div class="column yomi">
          <template v-for="(line,lno) in page" :key="lno">
            <hr v-if="line === '@HR@'">
            <p v-else-if="line.length === 0"><br /></p>
            <p v-else>{{ tenji2kana(line) }}</p>
          </template>
        </div>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { UnderscoreNavigator } from './search';
import { splitbraille, type ParsedBraille } from './brailleParser'
import { useI18n } from './i18n'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  braille?: string | ParsedBraille // 親から何が渡されているかに合わせる
}>(), {
  braille: ''
})

// props.braille が文字列ならパースし、すでにオブジェクトならそのまま扱う
const bes = computed((): ParsedBraille => {
  if (typeof props.braille === 'string') {
    return splitbraille(props.braille)
  }
  return props.braille as ParsedBraille
})

const isFileClose = computed(() => !props.braille || (typeof props.braille === 'string' && props.braille.length === 0))

const containerRef = ref<HTMLElement | null>(null);
let underscoreNavigator: UnderscoreNavigator | null = null;
const copyStatus = ref('')
const convertedText = computed(() => bes.value.body
  .map(page => page.map(line => line === '@HR@' ? '' : tenji2kana(line)).join('\n'))
  .join('\n')
)

async function copyBody() {
  const text = convertedText.value
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else if (!copyWithLegacyApi(text)) {
      throw new Error('Clipboard is unavailable')
    }
    copyStatus.value = t('copySuccess')
  } catch {
    try {
      copyStatus.value = copyWithLegacyApi(text) ? t('copySuccess') : t('copyFailure')
    } catch {
      copyStatus.value = t('copyFailure')
    }
  }
}

function copyWithLegacyApi(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  try {
    return document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

function tenji2kana(str: string | false): string {
  if (str === false) return ''
  let line = str
  if (line.slice(0, 4) === '@H1@') line = line.slice(4)
  if (line.slice(0, 4) === '@H2@') line = line.slice(4)
  if (line.slice(0, 4) === '@HR@' || line.length === 0) return ''

  return line
}

// containerRef 自体の変化（DOMのマウント・アンマウント）を直接監視する
watch(containerRef, (el) => {
  if (el) {
    if (!underscoreNavigator) {
      underscoreNavigator = new UnderscoreNavigator(el);
    } else {
      underscoreNavigator.refresh();
    }
  } else {
    underscoreNavigator = null;
  }
  // ファイルが閉じられてコンテナが消えた場合、または初期状態で空の場合
  if (!el || isFileClose.value) {
    underscoreNavigator = null;
    return;
  }  
});

// ファイルが開いている状態で中身のデータ（bes.value.body）だけが更新されたとき用
watch(() => bes.value.body, async () => {
  await nextTick();
  if (underscoreNavigator && containerRef.value) {
    underscoreNavigator.refresh();
  }
}, { deep: true });
</script>

<style>
.page {
  position: relative;
  padding: 2rem 0 2rem 0;
  border-bottom: 2px solid #999;
  line-height: 2;
}
.yomi {
  font-size: inherit;
  white-space: pre-wrap;
}
</style>
