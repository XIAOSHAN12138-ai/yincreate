import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStorage, setStorage } from '../utils/storage'

export const useAppStore = defineStore('app', () => {
  const activeNav = ref('home')
  const searchQuery = ref('')
  const isLoading = ref(false)

  // 网站个性化（企业专属，持久化到 localStorage）
  // 注意：blob URL 是会话级的，刷新后失效，不存入持久化缓存
  const cached = getStorage('site_customization', {})
  const siteFavicon = ref((cached.favicon_url || '').startsWith('blob:') ? '' : (cached.favicon_url || ''))
  const siteTitle = ref(cached.site_title || '')

  function setActiveNav(navId) {
    activeNav.value = navId
  }

  function setSearchQuery(query) {
    searchQuery.value = query
  }

  function setLoading(loading) {
    isLoading.value = loading
  }

  function setSiteCustomization({ favicon_url, site_title }) {
    // blob URL 是会话级的，不持久化到 localStorage
    const isBlobFavicon = (favicon_url || '').startsWith('blob:')
    siteFavicon.value = favicon_url || ''
    siteTitle.value = site_title || ''
    setStorage('site_customization', { favicon_url: isBlobFavicon ? '' : siteFavicon.value, site_title: siteTitle.value })
    // 立即应用到浏览器
    if (siteTitle.value) {
      document.title = siteTitle.value
    }
    if (siteFavicon.value) {
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = siteFavicon.value
    }
  }

  function applySiteCustomization() {
    if (siteTitle.value) {
      document.title = siteTitle.value
    }
    if (siteFavicon.value) {
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = siteFavicon.value
    }
  }

  return {
    activeNav,
    searchQuery,
    isLoading,
    siteFavicon,
    siteTitle,
    setActiveNav,
    setSearchQuery,
    setLoading,
    setSiteCustomization,
    applySiteCustomization
  }
})
