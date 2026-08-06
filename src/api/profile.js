import request from '../utils/request'
import {
  getBillingQuotaApi,
  estimatePriceApi as billingEstimatePrice,
  getTaskChargeInfoApi,
  getBillingAccountsApi
} from './billing'

// 开发模式 Mock 开关
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取用户积分/余额信息（兼容旧接口，内部调用 billing/quota）
 * @returns {Promise} { total_points, used_points, remaining, status }
 */
export function getPointsApi() {
  return getBillingQuotaApi().then(d => {
    // d 已经是解包后的 { quota_limit, quota_used, remaining, principal_type, ... }
    return {
      data: {
        total_points: d.quota_limit,
        used_points: d.quota_used,
        remaining: d.remaining,
        expired_points: 0,
        account_id: d.account_id,
        enterprise_id: d.enterprise_id,
        principal_type: d.principal_type || 'account',
        status: d.status
      }
    }
  })
}

/**
 * 获取网站个性化设置（企业专属）
 * @returns {Promise} { favicon_url, site_title }
 */
export function getSiteCustomizationApi() {
  if (MOCK_ENABLED) {
    return delay(300).then(() => ({
      data: {
        favicon_url: '',
        site_title: ''
      }
    }))
  }
  return request.get('/api/v1/site-customization')
}

/**
 * 保存网站个性化设置（企业专属）
 * @param {Object} params - { favicon_url, site_title }
 * @returns {Promise}
 */
export function saveSiteCustomizationApi(params) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({
      data: {
        message: '保存成功',
        favicon_url: params.favicon_url,
        site_title: params.site_title
      }
    }))
  }
  return request.post('/api/v1/site-customization', params)
}

/**
 * 估算生成价格（委托 billing API）
 * @param {Object} params - { model, output_type, feature, parameters, input_files }
 * @returns {Promise} { estimated_cost, currency, breakdown, note }
 */
export function estimatePriceApi(params) {
  return billingEstimatePrice(params).then(data => ({ data }))
}

/**
 * 上传网站图标
 * @param {FormData} formData - 包含图片文件
 * @returns {Promise} { url }
 */
export function uploadFaviconApi(formData) {
  if (MOCK_ENABLED) {
    return delay(800).then(() => ({
      data: {
        url: URL.createObjectURL(formData.get('file'))
      }
    }))
  }
  return request.post('/api/v1/upload/favicon', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// ==================== Billing API 转发导出 ====================

/** 任务完成后获取扣费明细 GET /api/v1/tasks/{task_id}/status */
export { getTaskChargeInfoApi }

/** 查询本企业所有子账号余额（仅企业身份）GET /api/v1/billing/accounts */
export { getBillingAccountsApi }
