const guardedLibraries = new WeakSet()

function removeRenderedIconMarkers(root) {
  if (!root?.querySelectorAll) return

  root.querySelectorAll('svg[data-lucide]').forEach((svg) => {
    svg.removeAttribute('data-lucide')
  })
}

/**
 * Lucide's browser build keeps `data-lucide` on generated SVG elements.
 * A later full-page createIcons() call may scan those SVGs again, so make
 * every existing call idempotent without changing individual components.
 */
export function installLucideGuard(
  lucide = globalThis.window?.lucide,
  defaultRoot = globalThis.document
) {
  if (!lucide?.createIcons || guardedLibraries.has(lucide)) return false

  const createIcons = lucide.createIcons.bind(lucide)

  lucide.createIcons = (options = {}) => {
    const root = options?.root || defaultRoot
    removeRenderedIconMarkers(root)
    const result = createIcons(options)
    removeRenderedIconMarkers(root)
    return result
  }

  guardedLibraries.add(lucide)
  return true
}

