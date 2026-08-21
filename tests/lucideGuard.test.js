import test from 'node:test'
import assert from 'node:assert/strict'

import { installLucideGuard } from '../src/utils/lucideGuard.js'

test('repeated Lucide initialization does not rescan rendered SVG icons', () => {
  const renderedSvg = {
    hasMarker: true,
    removeAttribute(name) {
      if (name === 'data-lucide') this.hasMarker = false
    }
  }
  const root = {
    querySelectorAll(selector) {
      if (selector !== 'svg[data-lucide]') return []
      return renderedSvg.hasMarker ? [renderedSvg] : []
    }
  }
  const markersSeenByLucide = []
  const lucide = {
    createIcons() {
      markersSeenByLucide.push(root.querySelectorAll('svg[data-lucide]').length)
      renderedSvg.hasMarker = true
    }
  }

  assert.equal(installLucideGuard(lucide, root), true)
  assert.equal(installLucideGuard(lucide, root), false)

  lucide.createIcons()
  lucide.createIcons()

  assert.deepEqual(markersSeenByLucide, [0, 0])
  assert.equal(renderedSvg.hasMarker, false)
})

