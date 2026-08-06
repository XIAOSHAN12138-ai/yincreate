import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStorage, setStorage, setStorageWithExpiry, getStorageWithExpiry, removeStorage } from '../utils/storage'
import request, { safeMessage } from '../utils/request'

const CACHE_KEY = 'model_config_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存有效期

export const useModelConfigStore = defineStore('modelConfig', () => {
  const modelConfig = ref(null)
  const loading = ref(false)
  const loaded = ref(false)

  function loadCache() {
    const cached = getStorageWithExpiry(CACHE_KEY)
    if (cached) {
      modelConfig.value = cached
      return true
    }
    const fallback = getStorage(CACHE_KEY + '_fallback')
    if (fallback) {
      modelConfig.value = fallback
      return true
    }
    return false
  }

  function saveCache(data) {
    setStorageWithExpiry(CACHE_KEY, data, CACHE_TTL)
    setStorage(CACHE_KEY + '_fallback', data)
  }

  async function fetchModelConfig() {
    loading.value = true
    try {
      const { data } = await request.get('/api/v1/models')
      if (data && (data.code === 200 || data.image_models || data.video_models)) {
        const config = data.data || data
        modelConfig.value = config
        saveCache(config)
        loaded.value = true
        return config
      }
      throw new Error(safeMessage(data?.message ?? data?.error ?? data, '获取模型配置失败'))
    } catch (e) {
      console.warn('[modelConfigStore] 获取模型配置失败，降级到缓存:', e.message)
      if (!modelConfig.value) {
        loadCache()
      }
      return modelConfig.value
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded() {
    if (loaded.value && modelConfig.value) return modelConfig.value
    return fetchModelConfig()
  }

  function getModelConfigById(modelId) {
    if (!modelConfig.value) return null
    const allModels = [
      ...(modelConfig.value.image_models || []),
      ...(modelConfig.value.video_models || []),
      ...(modelConfig.value.voices || [])
    ]
    return allModels.find(m => m.model_id === modelId || m.id === modelId) || null
  }

  function clearCache() {
    modelConfig.value = null
    loaded.value = false
    removeStorage(CACHE_KEY)
    removeStorage(CACHE_KEY + '_fallback')
  }

  return {
    modelConfig,
    loading,
    loaded,
    fetchModelConfig,
    ensureLoaded,
    getModelConfigById,
    clearCache,
    loadCache,
    saveCache
  }
})
