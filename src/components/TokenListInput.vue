<template>
  <div class="token-list-input" :class="{ 'is-focused': focused, 'has-error': error }" @click="focusInput">
    <span v-for="(item, index) in modelValue" :key="`${item}-${index}`" class="token-chip">
      <span>{{ item }}</span>
      <button type="button" :aria-label="`删除 ${item}`" @click.stop="removeItem(index)">×</button>
    </span>
    <input
      ref="inputRef"
      v-model="draft"
      :type="numeric ? 'number' : 'text'"
      :min="numeric ? 1 : undefined"
      :placeholder="modelValue.length ? '' : placeholder"
      @focus="focused = true"
      @blur="handleBlur"
      @keydown.enter.prevent="addItem"
    >
    <button v-if="hasDraft" type="button" class="token-add-btn" @mousedown.prevent @click.stop="addItem">添加</button>
  </div>
  <span v-if="error" class="token-input-error">{{ error }}</span>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '输入后按回车添加' },
  numeric: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const inputRef = ref(null)
const draft = ref('')
const focused = ref(false)
const error = ref('')
const hasDraft = computed(() => String(draft.value ?? '').trim().length > 0)

function focusInput() {
  inputRef.value?.focus()
}

function addItem() {
  const rawValue = String(draft.value ?? '').trim()
  if (!rawValue) return

  const parts = rawValue.split(/[，,\n]+/).map(value => value.trim()).filter(Boolean)
  const values = props.numeric ? parts.map(Number) : parts
  if (props.numeric) {
    if (values.some(value => !Number.isInteger(value) || value <= 0)) {
      error.value = '请输入大于 0 的整数'
      return
    }
  }

  error.value = ''
  const existingValues = new Set(props.modelValue.map(item => String(item)))
  const additions = values.filter(value => !existingValues.has(String(value)))
  emit('update:modelValue', [...props.modelValue, ...additions])
  draft.value = ''
}

function removeItem(index) {
  emit('update:modelValue', props.modelValue.filter((_, itemIndex) => itemIndex !== index))
}

function handleBlur() {
  focused.value = false
  addItem()
}
</script>

<style scoped>
.token-list-input {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 42px;
  padding: 5px 7px;
  border: 1.5px solid #c8d4e3;
  border-radius: 9px;
  background: #fff;
  cursor: text;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.token-list-input:hover { border-color: #9fb0c5; }
.token-list-input.is-focused { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
.token-list-input.has-error { border-color: #ef4444; }
.token-list-input input {
  flex: 1 1 150px;
  min-width: 120px;
  height: 28px;
  padding: 0 5px;
  border: 0;
  outline: 0;
  color: #142033;
  background: transparent;
  font: inherit;
}
.token-list-input input::placeholder { color: #94a3b8; }
.token-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 2px 5px 2px 9px;
  border: 1px solid #bfdbfe;
  border-radius: 7px;
  color: #1e40af;
  background: #eff6ff;
  font-size: 12px;
  font-weight: 600;
}
.token-chip button {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}
.token-chip button:hover { color: #1e3a8a; background: #dbeafe; }
.token-chip button:focus-visible,
.token-add-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
.token-add-btn {
  min-height: 28px;
  padding: 4px 9px;
  border: 0;
  border-radius: 6px;
  color: #1d4ed8;
  background: #eaf1ff;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.token-add-btn:hover { background: #dbeafe; }
.token-input-error { display: block; margin-top: 4px; color: #dc2626; font-size: 11.5px; }
@media (prefers-reduced-motion: reduce) {
  .token-list-input { transition: none; }
}
</style>
