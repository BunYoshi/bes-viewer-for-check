/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.BES' {
  const src: string
  export default src
}

declare module '*.bes' {
  const src: string
  export default src
}

declare module '*.BESX' {
  const src: string
  export default src
}

declare module '*.besx' {
  const src: string
  export default src
}

declare module '*.min.css'