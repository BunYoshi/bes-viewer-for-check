import { createApp } from 'vue'
import App from './App.vue'

// createApp(Test).mount('#app')

import Oruga from '@oruga-ui/oruga-next'
import { bulmaConfig } from '@oruga-ui/theme-bulma'
// import 'bulma/css/bulma.css'
import '@oruga-ui/theme-bulma/style.css'
// import '@oruga-ui/theme-bulma/dist/theme.css'



createApp(App).use(Oruga, bulmaConfig).mount('#app')
