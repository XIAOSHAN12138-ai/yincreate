import request from '../utils/request'

// 开发模式 Mock 开关
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 获取当前登录用户信息（与 auth.js 一致）
 */
function getMockUser() {
  const stored = JSON.parse(localStorage.getItem('user') || 'null')
  if (stored && stored.user_type) return stored
  return { user_id: 'demo-company', user_type: 'enterprise', name: '示例科技', enterprise_id: 'demo-company' }
}

// ==================== Mock 数据 ====================

let mockTxSeq = 1

function mockQuota() {
  const user = getMockUser()
  // admin 无企业配额
  if (user.user_type === 'admin') {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }
  const isEnterprise = user.user_type === 'enterprise'
  return {
    data: {
      account_id: user.user_id,
      enterprise_id: user.enterprise_id || 'demo-company',
      principal_type: isEnterprise ? 'enterprise' : 'account',
      quota_limit: isEnterprise ? 10000.00 : 1000.00,
      quota_used: 2.50,
      remaining: (isEnterprise ? 10000 : 1000) - 2.50,
      status: 'normal'
    }
  }
}

/**
 * 查询本企业所有子账号余额（仅企业身份）
 */
function mockAccounts() {
  const user = getMockUser()
  if (user.user_type !== 'enterprise') {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }
  return {
    data: {
      enterprise_id: user.enterprise_id || 'demo-company',
      summary: {
        total_accounts: 2,
        normal_accounts: 2,
        total_quota_limit: 1800.00,
        total_quota_used: 2.50,
        total_remaining: 1797.50
      },
      items: [
        {
          account_id: `${user.user_id}51010001`,
          enterprise_id: user.enterprise_id || 'demo-company',
          user_id: 'user-001',
          username: '员工A',
          email: 'a@demo.com',
          permission_level: 5,
          department_id: '101',
          account_number: '0001',
          quota_limit: 800.00,
          quota_used: 2.50,
          remaining: 797.50,
          status: 'normal',
          last_login_at: null,
          created_at: '2026-06-24T10:00:00'
        },
        {
          account_id: `${user.user_id}51010002`,
          enterprise_id: user.enterprise_id || 'demo-company',
          user_id: 'user-002',
          username: '员工B',
          email: 'b@demo.com',
          permission_level: 3,
          department_id: '102',
          account_number: '0002',
          quota_limit: 1000.00,
          quota_used: 0.00,
          remaining: 1000.00,
          status: 'normal',
          last_login_at: null,
          created_at: '2026-06-24T10:00:00'
        }
      ]
    }
  }
}

function mockTransactions(params = {}) {
  const items = []
  const type = params.transaction_type || null
  let runningBalance = 1000.00
  for (let i = 0; i < 10; i++) {
    const t = ['consume', 'refund', 'recharge'][i % 3]
    if (type && t !== type) continue
    const amount = t === 'consume' ? -(Math.random() * 2).toFixed(2) : (Math.random() * 100).toFixed(2)
    const balanceBefore = runningBalance
    runningBalance += parseFloat(amount)
    items.push({
      id: mockTxSeq++,
      transaction_id: `TXN-${Math.random().toString(16).slice(2, 18).toUpperCase()}`,
      account_id: getMockUser().user_id,
      transaction_type: t,
      amount: parseFloat(amount),
      balance_before: parseFloat(balanceBefore.toFixed(2)),
      balance_after: parseFloat(runningBalance.toFixed(2)),
      related_task_id: t === 'consume' ? `task_${Date.now()}_${i}` : null,
      related_model_id: t === 'consume' ? '豆包 Seedance 2.0 Fast' : null,
      description: t === 'consume'
        ? `生成消费 task=task_xxx model=豆包 Seedance 2.0 Fast`
        : (t === 'recharge' ? '管理员充值' : '退款'),
      created_at: new Date(Date.now() - i * 3600000).toISOString()
    })
  }
  const page = params.page || 1
  const pageSize = Math.min(params.page_size || 20, 100)
  return {
    data: {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      page_size: pageSize,
      total: items.length,
      transaction_type: type
    }
  }
}

function mockTasks(params = {}) {
  return {
    data: {
      items: [],
      page: params.page || 1,
      page_size: params.page_size || 20,
      total: 0,
      status: params.status || null
    }
  }
}

function mockTaskDetail(taskId) {
  return {
    data: {
      task_id: taskId,
      account_id: getMockUser().user_id,
      model_id: '豆包 Seedance 2.0 Fast',
      status: 'completed',
      price_snapshot: 2.50,
      quota_used: 2.50,
      output_url: '',
      created_at: new Date().toISOString(),
      decoded_generation_params: {
        model: '豆包 Seedance 2.0 Fast',
        output_type: 'video',
        feature: 'text_to_video',
        ratio: '16:9',
        resolution: '1080P',
        duration: 5
      }
    }
  }
}

/**
 * 任务状态查询（含扣费明细 charge_info）
 * GET /api/v1/tasks/{task_id}/status
 */
function mockTaskStatus(taskId) {
  return {
    data: {
      status: 'completed',
      result: { video: { url: '' } },
      charge_info: {
        transaction_id: `TXN-${Math.random().toString(16).slice(2, 18).toUpperCase()}`,
        cost: 2.50,
        balance_before: 1000.00,
        balance_after: 997.50,
        charged_at: new Date().toISOString()
      }
    }
  }
}

function mockEstimatePrice(params) {
  let cost
  if (params.output_type === 'video') {
    const duration = params.parameters?.duration || 5
    const resolution = String(params.parameters?.resolution || '1080P').toUpperCase()
    const resMap = {
      '720P': { silent: 3, with_audio: 4.5 },
      '1080P': { silent: 5, with_audio: 7.5 },
      '2K': { silent: 12, with_audio: 18 },
      '4K': { silent: 30, with_audio: 45 }
    }
    const mode = params.parameters?.with_audio === true ? 'with_audio' : 'silent'
    const base = (resMap[resolution] || resMap['1080P'])[mode]
    cost = base * duration
  } else if (params.output_type === 'image') {
    cost = 15
  } else {
    cost = 10
  }

  const breakdown = params.output_type === 'video'
    ? {
        base_price: `${(cost / (params.parameters?.duration || 5)).toFixed(2)}元/秒`,
        duration: `${params.parameters?.duration || 5}秒`,
        resolution: params.parameters?.resolution || '默认',
        with_audio: params.parameters?.with_audio ? '是' : '否',
        has_input: (params.input_files?.length > 0) ? '是' : '否',
        total: `${cost.toFixed(2)}元`
      }
    : {
        base_price: `${cost.toFixed(2)}元/张`,
        resolution: params.parameters?.resolution || '默认',
        has_input: (params.input_files?.length > 0) ? '是' : '否',
        total: `${cost.toFixed(2)}元`
      }

  return {
    data: {
      estimated_cost: parseFloat(cost.toFixed(2)),
      currency: 'CNY',
      breakdown,
      note: '实际扣费以生成结果为准'
    }
  }
}

// ==================== 通用解包 ====================

function unwrap(res) {
  const body = res.data
  return (body && body.code !== undefined && body.data !== undefined) ? body.data : body
}

// ==================== API 函数 ====================

/**
 * 1. 查询余额
 * GET /api/v1/billing/quota
 * 员工 → accounts 表，企业 → enterprises 表
 */
export function getBillingQuotaApi() {
  if (MOCK_ENABLED) return delay(200).then(() => mockQuota().data)
  return request.get('/api/v1/billing/quota').then(unwrap)
}

/**
 * 2. 查询本企业所有子账号余额（仅企业身份可调用）
 * GET /api/v1/billing/accounts
 */
export function getBillingAccountsApi() {
  if (MOCK_ENABLED) return delay(200).then(() => mockAccounts().data)
  return request.get('/api/v1/billing/accounts').then(unwrap)
}

/**
 * 3. 查询流水
 * GET /api/v1/billing/transactions?transaction_type=&page=1&page_size=20
 */
export function getBillingTransactionsApi(params = {}) {
  if (MOCK_ENABLED) return delay(200).then(() => mockTransactions(params).data)
  return request.get('/api/v1/billing/transactions', { params }).then(unwrap)
}

/**
 * 4. 查询任务列表
 * GET /api/v1/billing/tasks?status=&page=1&page_size=20
 */
export function getBillingTasksApi(params = {}) {
  if (MOCK_ENABLED) return delay(200).then(() => mockTasks(params).data)
  return request.get('/api/v1/billing/tasks', { params }).then(unwrap)
}

/**
 * 5. 查询单个任务详情（含扣费快照）
 * GET /api/v1/billing/tasks/{task_id}
 */
export function getBillingTaskDetailApi(taskId) {
  if (MOCK_ENABLED) return delay(150).then(() => mockTaskDetail(taskId).data)
  return request.get(`/api/v1/billing/tasks/${taskId}`).then(unwrap)
}

/**
 * 6. 价格估算（不执行生成）
 * POST /api/v1/estimate-price
 */
export function estimatePriceApi(params) {
  if (MOCK_ENABLED) return delay(250).then(() => mockEstimatePrice(params).data)
  return request.post('/api/v1/estimate-price', params).then(unwrap)
}

/**
 * 7. 任务完成后获取扣费明细
 * GET /api/v1/tasks/{task_id}/status
 * 响应中 data.charge_info 包含本次扣费明细（仅在 status=completed 时存在）
 */
export function getTaskChargeInfoApi(taskId) {
  if (MOCK_ENABLED) return delay(150).then(() => mockTaskStatus(taskId).data)
  return request.get(`/api/v1/tasks/${taskId}/status`).then(unwrap)
}
