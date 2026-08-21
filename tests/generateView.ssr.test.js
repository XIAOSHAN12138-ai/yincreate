import test from 'node:test'
import assert from 'node:assert/strict'

import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { createServer } from 'vite'

test('GenerateView setup renders without initialization errors', async t => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size }
  }
  t.after(() => { delete globalThis.localStorage })

  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true }
  })
  t.after(() => vite.close())

  const { default: GenerateView } = await vite.ssrLoadModule('/src/views/GenerateView.vue')
  const app = createSSRApp(GenerateView)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/generate', component: GenerateView },
      { path: '/:pathMatch(.*)*', component: { render: () => null } }
    ]
  })

  app.use(createPinia())
  app.use(router)
  await router.push('/generate')
  await router.isReady()

  const html = await renderToString(app)
  assert.match(html, /开始创作|AI生成/)
})
