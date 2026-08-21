<template>
  <div ref="rootRef" class="model-filter-anchor">
    <button
      type="button"
      class="model-filter-trigger"
      :class="{ active: selectedCount > 0, open: isOpen }"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click.stop="toggleOpen"
    >
      <LucideIcon name="list-filter" :size="14" />
      <span>筛选模型</span>
      <span v-if="selectedCount" class="filter-trigger-count">{{ selectedCount }}</span>
      <LucideIcon :name="isOpen ? 'chevron-down' : 'chevron-up'" :size="13" />
    </button>

    <Transition name="filter-popover">
      <section
        v-if="isOpen"
        class="model-filter-popover"
        role="dialog"
        aria-label="模型标签筛选"
        :style="{ maxHeight: `${popoverMaxHeight}px` }"
        @click.stop
      >
        <header class="filter-popover-header">
          <div>
            <strong>筛选模型</strong>
            <span>{{ matchingCount }} / {{ totalCount }} 个符合</span>
          </div>
          <button v-if="selectedCount" type="button" class="filter-clear-btn" @click="$emit('clear')">清空</button>
        </header>

        <div v-if="selectedTags.length" class="selected-filter-bar" aria-label="已选筛选条件">
          <button
            v-for="tag in selectedTags"
            :key="`${tag.facet}-${tag.value}`"
            type="button"
            class="selected-filter-tag"
            @click="$emit('toggle', tag.facet, tag.value)"
          >
            <span>{{ tag.label }}</span>
            <LucideIcon name="x" :size="11" />
          </button>
        </div>
        <div v-else class="filter-empty-bar">点击下方标签添加筛选条件</div>

        <div class="filter-groups">
          <div v-for="group in visibleGroups" :key="group.id" class="filter-group">
            <div class="filter-group-title">{{ group.label }}</div>
            <div class="filter-option-list">
              <button
                v-for="option in group.options"
                :key="`${group.id}-${option.value}`"
                type="button"
                class="filter-option-tag"
                :class="{ selected: isSelected(group.id, option.value) }"
                @click="$emit('toggle', group.id, option.value)"
              >
                <span>{{ option.label }}</span>
                <small>{{ option.count }}</small>
              </button>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import LucideIcon from './LucideIcon.vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  selections: { type: Object, required: true },
  matchingCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 }
})

defineEmits(['toggle', 'clear'])

const rootRef = ref(null)
const isOpen = ref(false)
const popoverMaxHeight = ref(430)
const visibleGroups = computed(() => props.groups.filter(group => group.options?.length))
const selectedCount = computed(() => Object.values(props.selections)
  .reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0))

const selectedTags = computed(() => {
  const tags = []
  for (const group of visibleGroups.value) {
    const selected = Array.isArray(props.selections[group.id]) ? props.selections[group.id] : []
    for (const value of selected) {
      const option = group.options.find(item => String(item.value) === String(value))
      tags.push({ facet: group.id, value, label: option?.label || String(value) })
    }
  }
  return tags
})

function isSelected(facet, value) {
  const values = props.selections[facet]
  return Array.isArray(values) && values.some(item => String(item) === String(value))
}

function updatePopoverMaxHeight() {
  if (!rootRef.value) return
  const availableAbove = rootRef.value.getBoundingClientRect().top - 82
  popoverMaxHeight.value = Math.max(180, Math.min(430, Math.floor(availableAbove)))
}

async function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    updatePopoverMaxHeight()
  }
}

function handleDocumentClick(event) {
  if (isOpen.value && !rootRef.value?.contains(event.target)) isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updatePopoverMaxHeight)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updatePopoverMaxHeight)
})
</script>

<style scoped>
.model-filter-anchor {
  position: absolute;
  top: 1px;
  left: 75px;
  z-index: 45;
  transform: translateY(-100%);
}

.model-filter-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 10px;
  overflow: hidden;
  border: 1px solid #bfd3fb;
  border-bottom-color: #fff;
  border-radius: 10px 10px 0 0;
  color: #475569;
  background: linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%);
  box-shadow: 0 -5px 16px rgba(37, 99, 235, 0.08), 0 -1px 3px rgba(15, 23, 42, 0.05);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.model-filter-trigger::before {
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 2px;
  border-radius: 0 0 999px 999px;
  background: linear-gradient(90deg, transparent, #60a5fa, transparent);
  content: '';
  opacity: 0.65;
}

.model-filter-trigger::after {
  position: absolute;
  right: -1px;
  bottom: -2px;
  left: -1px;
  height: 3px;
  background: #fff;
  content: '';
}

.model-filter-trigger:hover,
.model-filter-trigger.open {
  border-color: #7eabff;
  border-bottom-color: #fff;
  color: #2563eb;
  background: linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
  box-shadow: 0 -7px 20px rgba(37, 99, 235, 0.14), 0 -1px 4px rgba(15, 23, 42, 0.06);
}

.model-filter-trigger.active {
  border-color: #8db2ff;
  border-bottom-color: #fff;
  color: #1d4ed8;
  background: linear-gradient(180deg, #f8fbff 0%, #eaf2ff 100%);
}

.model-filter-trigger:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

.filter-trigger-count {
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  border-radius: 999px;
  color: #fff;
  background: #2563eb;
  font-size: 10px;
  line-height: 17px;
  text-align: center;
}

.model-filter-popover {
  position: absolute;
  display: flex;
  flex-direction: column;
  bottom: calc(100% + 9px);
  left: 0;
  width: min(520px, calc(100vw - 340px));
  min-width: 390px;
  max-height: 430px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16), 0 3px 10px rgba(15, 23, 42, 0.08);
}

.filter-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px 11px;
  border-bottom: 1px solid #eef2f7;
}

.filter-popover-header > div {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.filter-popover-header strong { color: #172033; font-size: 14px; }
.filter-popover-header span { color: #94a3b8; font-size: 11px; }

.filter-clear-btn {
  padding: 3px 6px;
  border: 0;
  color: #64748b;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}

.filter-clear-btn:hover { color: #dc2626; }

.selected-filter-bar,
.filter-empty-bar {
  min-height: 42px;
  padding: 8px 14px;
  border-bottom: 1px solid #eef2f7;
  background: #f8fafc;
}

.selected-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.filter-empty-bar {
  display: flex;
  align-items: center;
  color: #94a3b8;
  font-size: 11px;
}

.selected-filter-tag,
.filter-option-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}

.selected-filter-tag {
  padding: 4px 8px;
  border-color: #bfdbfe;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 11px;
}

.filter-groups {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 14px 13px;
}

.filter-group { padding-top: 11px; }
.filter-group + .filter-group { margin-top: 2px; border-top: 1px solid #f1f5f9; }
.filter-group-title { margin-bottom: 7px; color: #64748b; font-size: 11px; font-weight: 650; }
.filter-option-list { display: flex; flex-wrap: wrap; gap: 7px; }

.filter-option-tag {
  padding: 5px 9px;
  border-color: #e2e8f0;
  color: #475569;
  background: #fff;
  font-size: 11px;
}

.filter-option-tag:hover { border-color: #a9c4f8; color: #2563eb; background: #f8fbff; }
.filter-option-tag.selected { border-color: #8db2ff; color: #1d4ed8; background: #eff6ff; }
.filter-option-tag small { color: #94a3b8; font-size: 9px; }
.filter-option-tag.selected small { color: #3b82f6; }

.filter-popover-enter-active,
.filter-popover-leave-active { transition: opacity 150ms ease, transform 150ms ease; transform-origin: left bottom; }
.filter-popover-enter-from,
.filter-popover-leave-to { opacity: 0; transform: translateY(7px) scale(0.985); }

@media (max-width: 760px) {
  .model-filter-anchor { left: 16px; }
  .model-filter-popover { width: calc(100vw - 48px); min-width: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .model-filter-trigger,
  .filter-popover-enter-active,
  .filter-popover-leave-active { transition-duration: 0.001ms; }
}
</style>
