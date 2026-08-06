import { getStorage } from './storage'

function isCrossOriginUrl(url) {
  try {
    const u = new URL(url, window.location.href)
    return u.origin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * 协议升级：当前页面是 HTTPS 时，将 http:// 资源升级为 https://
 * 避免浏览器混合内容（mixed content）策略导致 fetch / 图片加载被拦截
 */
function upgradeToHttps(url) {
  if (typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    /^http:\/\//i.test(url)) {
    return 'https://' + url.slice(7)
  }
  return url
}

/**
 * 添加缓存破坏参数，避免浏览器使用之前不带 CORS 的缓存响应污染 canvas
 */
function addCacheBuster(url) {
  try {
    const u = new URL(url, window.location.href)
    u.searchParams.set('_cb', Date.now().toString())
    return u.toString()
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}_cb=${Date.now()}`
  }
}

function triggerBlobDownload(blob, fileName, url = '', fileType = '') {
  // 补全文件扩展名（防止浏览器对无扩展名文件追加 .txt）
  const finalName = ensureFileExtension(fileName, blob, url, fileType)
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = finalName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

function getAuthToken() {
  return getStorage('access_token') || ''
}

function getImageExtension(url, fallback = 'png') {
  try {
    const u = new URL(url, window.location.href)
    const ext = (u.pathname.split('.').pop() || '').toLowerCase()
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
      return ext === 'jpg' ? 'jpeg' : ext
    }
  } catch { /* ignore */ }
  return fallback
}

function getImageMimeType(ext) {
  const map = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon'
  }
  return map[ext] || 'image/png'
}

/**
 * MIME 类型到文件扩展名的映射
 */
const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
  'application/octet-stream': '' // 通用二进制，不追加扩展名
}

/**
 * 从 URL 路径中提取文件扩展名
 */
function extractExtFromUrl(url) {
  try {
    const u = new URL(url, window.location.href)
    const pathname = u.pathname
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i)
    if (match) {
      const ext = match[1].toLowerCase()
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico',
        'mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv',
        'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) {
        return ext === 'jpg' ? 'jpeg' : ext
      }
    }
  } catch { /* ignore */ }
  return ''
}

/**
 * 根据 fileType 推断默认扩展名
 */
function getDefaultExtByType(fileType) {
  switch (fileType) {
    case 'image': return 'png'
    case 'video': return 'mp4'
    case 'audio': return 'mp3'
    default: return ''
  }
}

/**
 * 确保文件名有正确的扩展名
 * 依次尝试：文件名本身 → URL 路径 → blob MIME 类型 → fileType 默认值
 * 避免浏览器对无扩展名文件追加 .txt
 *
 * @param {string} fileName - 原始文件名
 * @param {Blob} blob - 下载的 blob 对象
 * @param {string} [url=''] - 资源 URL（用于提取扩展名）
 * @param {string} [fileType=''] - 文件类型（image/video/audio）
 * @returns {string} 修正后的文件名
 */
function ensureFileExtension(fileName, blob, url = '', fileType = '') {
  // 1. 检查文件名是否已有已知扩展名
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(fileName)
  if (hasExt) return fileName

  // 2. 从 URL 路径提取扩展名
  const urlExt = extractExtFromUrl(url)
  if (urlExt) return `${fileName}.${urlExt}`

  // 3. 根据 blob 的 MIME 类型推断扩展名
  const mime = (blob.type || '').split(';')[0].trim().toLowerCase()
  const mimeExt = MIME_TO_EXT[mime]
  if (mimeExt) return `${fileName}.${mimeExt}`

  // 4. 根据 fileType 使用默认扩展名
  const defaultExt = getDefaultExtByType(fileType)
  if (defaultExt) return `${fileName}.${defaultExt}`

  return fileName
}

/**
 * 通过 Image + Canvas 下载跨域图片
 * 使用 crossorigin="anonymous" 加载图片，绕过 <a download> 跨域限制
 */
function downloadImageViaCanvas(url, fileName) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const ext = getImageExtension(fileName)
        const mime = getImageMimeType(ext)
        const quality = (ext === 'jpeg' || ext === 'webp') ? 0.92 : undefined

        canvas.toBlob((blob) => {
          if (blob && blob.size > 0) {
            triggerBlobDownload(blob, fileName)
            resolve(true)
          } else {
            reject(new Error('canvas 被污染或 toBlob 失败'))
          }
        }, mime, quality)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      reject(new Error('图片加载失败（可能 CDN 不支持 CORS）'))
    }

    img.src = addCacheBuster(url)
  })
}

/**
 * 流式 fetch 读取响应体为 Blob
 *
 * 解决大文件一次性 await response.blob() 在弱网下可能失败的问题：
 * - 流式 reader 读取，避免内存峰值
 * - AbortController 超时控制，避免长时间挂起
 * - 支持进度回调，便于 UI 反馈
 *
 * @param {string} url - 请求 URL
 * @param {Object} [options] - fetch 附加选项
 * @param {number} [timeoutMs=300000] - 超时（默认 5 分钟，覆盖大视频下载）
 * @param {(received:number,total:number)=>void} [onProgress] - 进度回调
 * @returns {Promise<Blob|null>} 成功返回 Blob，失败返回 null
 */
async function fetchBlobStream(url, options = {}, timeoutMs = 300000, onProgress) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('download_timeout')), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    if (!response.ok) return null

    // 捕获响应的 content-type，传给 Blob 以保留 MIME 类型
    // 否则 new Blob(chunks) 会生成空类型，浏览器会按 text/plain 处理并追加 .txt 扩展名
    const contentType = response.headers.get('content-type') || ''

    // 不支持的响应体（如 opaque response），退化为 blob()
    if (!response.body) {
      const blob = await response.blob()
      // response.blob() 会自动带上 content-type，但保险起见手动覆盖
      return contentType ? new Blob([blob], { type: contentType }) : blob
    }

    const reader = response.body.getReader()
    const chunks = []
    let received = 0
    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.length
        if (onProgress && total > 0) onProgress(received, total)
      }
    }

    return new Blob(chunks, { type: contentType })
  } catch (err) {
    console.warn(`[download] fetchBlobStream 失败: ${err?.message || err}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 兜底下载（跨域资源 fetch 失败时使用）
 *
 * Chrome 65+ / Edge 150 收紧了跨域 <a download> 语义：
 * 跨域响应若无 Content-Disposition: attachment，浏览器会忽略 download 属性，转为普通导航
 * 因此改用隐藏 iframe 触发请求，避免替换当前页面（保留 SPA 状态）
 *
 * @param {string} url - 资源 URL
 * @param {string} fileName - 期望保存的文件名
 * @returns {boolean} 是否触发了 iframe（不保证成功）
 */
function fallbackDownload(url, fileName) {
  // 优先尝试隐藏 iframe（对有 Content-Disposition 的响应可触发下载）
  try {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.src = url
    document.body.appendChild(iframe)
    // 60 秒后清理 iframe，避免内存泄漏
    setTimeout(() => {
      try { document.body.removeChild(iframe) } catch { /* ignore */ }
    }, 60000)
    return true
  } catch {
    // 极端情况：iframe 也失败，退化为 <a>（跨域会失效但不阻塞流程）
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return false
  }
}

/**
 * 下载文件（解决跨域 CDN 资源下载被浏览器拦截的问题）
 *
 * 策略依次尝试：
 * 1. 流式 fetch（同域或 CDN 已配置 CORS，支持大文件，5 分钟超时）
 * 2. 携带 Authorization 请求头 fetch（触发 preflight）
 * 3. 图片专用：Image + Canvas 转 blob（绕过跨域 download 限制）
 * 4. 通过同源代理 /dl-proxy/?url= 下载（需 Nginx 配置）
 * 5. 兜底：隐藏 iframe（避免 Chrome 150 跨域 <a download> 失效导致页面导航）
 *
 * @param {string} url - 资源地址
 * @param {string} fileName - 下载保存的文件名
 * @param {'image'|'video'|'audio'|''} [fileType=''] - 文件类型，用于选择下载策略
 * @param {(received:number,total:number)=>void} [onProgress] - 进度回调
 * @returns {Promise<boolean>} 是否成功触发下载
 */
export async function downloadFile(url, fileName, fileType = '', onProgress) {
  if (!url) return false

  // 协议升级：HTTPS 页面下的 http:// 资源升级为 https://
  const upgradedUrl = upgradeToHttps(url)

  // blob: 或 data: 协议直接下载
  if (upgradedUrl.startsWith('blob:') || upgradedUrl.startsWith('data:')) {
    try {
      const response = await fetch(upgradedUrl)
      const blob = await response.blob()
      triggerBlobDownload(blob, fileName, upgradedUrl, fileType)
      return true
    } catch {
      return false
    }
  }

  // 策略 1：流式 fetch（同域或 CDN 已配置 CORS，支持大文件 5 分钟超时）
  const blob1 = await fetchBlobStream(upgradedUrl, {}, 300000, onProgress)
  if (blob1 && blob1.size > 0) {
    triggerBlobDownload(blob1, fileName, upgradedUrl, fileType)
    return true
  }

  // 策略 2：携带 Authorization 请求头（触发 preflight）
  const token = getAuthToken()
  if (token) {
    const blob2 = await fetchBlobStream(upgradedUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, 300000, onProgress)
    if (blob2 && blob2.size > 0) {
      triggerBlobDownload(blob2, fileName, upgradedUrl, fileType)
      return true
    }
  }

  // 判断是否图片类型
  const isImage = fileType === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)(\?|$)/i.test(upgradedUrl) ||
    fileName.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i)

  // 策略 3：图片专用 — Image + Canvas 转 blob 下载
  if (isImage) {
    try {
      const ok = await downloadImageViaCanvas(upgradedUrl, fileName)
      if (ok) return true
    } catch (err) {
      console.warn('[download] Canvas 方式失败:', err?.message || err)
    }
  }

  // 策略 4：同源代理 /dl-proxy/
  if (isCrossOriginUrl(upgradedUrl)) {
    try {
      const proxyUrl = `/dl-proxy/?url=${encodeURIComponent(upgradedUrl)}`
      const blob4 = await fetchBlobStream(proxyUrl, {}, 300000, onProgress)
      if (blob4 && blob4.size > 0) {
        // 排除 SPA 兜底返回的 HTML（代理未配置时 Nginx 可能返回 index.html）
        const type = blob4.type || ''
        if (!type.includes('text/html')) {
          triggerBlobDownload(blob4, fileName, upgradedUrl, fileType)
          return true
        }
      }
    } catch { /* continue */ }
  }

  // 策略 5：兜底 — 隐藏 iframe
  // 避免 Chrome 150 / Edge 150 跨域 <a download> 失效转普通导航
  return fallbackDownload(upgradedUrl, fileName)
}
