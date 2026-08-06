<template>
  <span ref="iconRoot" class="lucide-icon-root"></span>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: null },
  width: { type: [Number, String], default: null },
  height: { type: [Number, String], default: null },
  color: { type: String, default: null },
  strokeWidth: { type: [Number, String], default: null },
  svgStyle: { type: [String, Object], default: '' },
  class: { type: String, default: '' }
})

const iconRoot = ref(null)

function applyStyles(svgEl) {
  if (!svgEl) return
  if (props.size) {
    const s = typeof props.size === 'number' ? props.size + 'px' : props.size
    svgEl.style.width = s
    svgEl.style.height = s
  }
  if (props.width) {
    svgEl.style.width = typeof props.width === 'number' ? props.width + 'px' : props.width
  }
  if (props.height) {
    svgEl.style.height = typeof props.height === 'number' ? props.height + 'px' : props.height
  }
  if (props.color) {
    svgEl.style.color = props.color
    svgEl.setAttribute('stroke', 'currentColor')
  }
  if (props.strokeWidth) {
    svgEl.setAttribute('stroke-width', String(props.strokeWidth))
  }
  if (props.svgStyle) {
    if (typeof props.svgStyle === 'string') {
      svgEl.style.cssText += ';' + props.svgStyle
    } else if (typeof props.svgStyle === 'object') {
      for (const [k, v] of Object.entries(props.svgStyle)) {
        svgEl.style[k] = v
      }
    }
  }
  if (props.class) {
    svgEl.setAttribute('class', props.class)
  }
}

function renderIcon() {
  const root = iconRoot.value
  if (!root || !window.lucide) return
  root.innerHTML = ''
  const i = document.createElement('i')
  i.setAttribute('data-lucide', props.name)
  root.appendChild(i)
  window.lucide.createIcons({ root: root })
  const svg = root.querySelector('svg')
  if (svg) {
    applyStyles(svg)
  }
}

onMounted(() => {
  nextTick(renderIcon)
})

watch(
  () => [props.name, props.size, props.width, props.height, props.color, props.strokeWidth, props.svgStyle, props.class],
  () => {
    nextTick(renderIcon)
  }
)

onBeforeUnmount(() => {
  if (iconRoot.value) {
    iconRoot.value.innerHTML = ''
  }
})
</script>

<style scoped>
.lucide-icon-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
.lucide-icon-root :deep(svg) {
  display: block;
}
</style>
