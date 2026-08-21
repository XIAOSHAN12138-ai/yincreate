import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installLucideGuard } from './utils/lucideGuard'

const app = createApp(App)

app.use(createPinia())
app.use(router)

installLucideGuard()
app.mount('#app')
