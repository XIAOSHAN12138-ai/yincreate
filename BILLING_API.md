# 额度/余额 API 文档

路由前缀：`/api/v1/billing`  
权限：需要 `enterprise` 或 `employee` 类型的 Token（管理员账号无企业配额，会返回 403）  
Header：`Authorization: Bearer <token>`

> ## 📌 PR-4.11 更新（2026-08-14）：视频定价二维（分辨率 × 音频）
>
> **变更**：`ai_models.price_tiers` 从一维 `{分辨率: 单价}` 升级为**二维** `{分辨率: {silent/with_audio: 单价}}`，按视频实际是否生成音频差异化计费。
>
> **影响范围**：
> - `compute_price(video, resolution, with_audio=True/False)` 走二维查找
> - 音频模式仅两态：`silent` / `with_audio`（禁止其他命名）
> - video 模型在 admin `POST/PATCH /api/v1/admin/models` 强制二维，缺 `silent` 或 `with_audio` → `400 INVALID_PRICE_TIERS`
> - image / audio 媒体类型仍允许一维（向后兼容）
>
> **前端使用建议**：
> - 视频生成时显式传 `audio_generation: true/false`，决定走 `with_audio` 还是 `silent` 价
> - 估算价格时（`/billing/estimate-price`）：传 `with_audio` 即可拿到正确单价
>
> **历史数据**：所有 video 模型的 `price_tiers` 已通过 49 SQL 迁移为二维（`with_audio = silent × 1.5` 起步），可手动 PATCH 微调。

> ## 📌 PR-4.9 更新（2026-08-12）：账单/任务详情字段语义统一
>
> **变更**：`quota_transactions.related_model_id` 和 `generation_tasks.model_id`（即账单响应里的 `decoded_generation_params.model`）字段写入语义从**上游 ID**（如 `gp-im-2`）改为**模型展示名**（如 `gpt image 2`，即 `ai_models.display_name`）。
>
> **影响范围**：
> - `/billing/transactions` 响应的 `related_model_id` 字段 — 现在存展示名
> - `/billing/tasks/{task_id}` 响应的 `decoded_generation_params.model` 字段 — 现在存展示名
> - `/billing/tasks/{task_id}` 响应的 `model_id` 顶层字段（PR-4.9 注入） — 也是展示名
>
> **前端使用建议**：
> - 账单流水页展示 → 直接用 `related_model_id`
> - 任务详情卡片标题 → 用 `decoded_generation_params.model`
> - 如果需要稳定的业务 ID 做回调路由，请用 JOIN `ai_models.business_model_id` 字段（不在此接口响应中）
>
> **历史数据**：旧任务（PR-4.9 之前）的 `model_id` 列存的是上游 ID 或业务 ID，不影响新任务写入。

---

## 接口一览

| # | 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|---|
| 1 | `/billing/quota` | GET | 企业 / 员工 | 当前账号余额 |
| 2 | `/billing/accounts` | GET | **仅企业** | 本企业所有子账号余额及汇总 |
| 3 | `/billing/transactions` | GET | 企业 / 员工 | 额度变动流水（消费/退款/充值/过期） |
| 4 | `/billing/tasks` | GET | 企业 / 员工 | 自己的生成任务列表 |
| 5 | `/billing/tasks/{task_id}` | GET | 企业 / 员工 | 单个任务详情（含扣费快照） |
| 6 | `/estimate-price` | POST | 企业 / 员工 | 价格估算（不执行生成） |

**前端相关**：
- 任务完成后，调用 `/api/v1/tasks/{task_id}/status` 获取的响应中，`data.charge_info` 字段包含本次扣费明细
- 任务失败时**不扣费**

---

## 1. 查询余额

```
GET /api/v1/billing/quota
```

**说明：** 查询当前登录账号的配额余额。

- 企业 token → 查 `enterprises` 表，返回企业总额度
- 员工 token → 查 `accounts` 表，返回员工个人额度

### 响应示例（员工）

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "account_id": "shuquzhi51010001",
    "enterprise_id": "shuquzhi",
    "principal_type": "account",
    "quota_limit": 1000.00,
    "quota_used": 2.50,
    "remaining": 997.50,
    "status": "normal"
  }
}
```

### 响应示例（企业）

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "account_id": "shuquzhi",
    "enterprise_id": "shuquzhi",
    "principal_type": "enterprise",
    "quota_limit": 10000.00,
    "quota_used": 2.50,
    "remaining": 9997.50,
    "status": "normal"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `account_id` | string | token 中的 sub（登录用的 ID） |
| `enterprise_id` | string | 所属企业 ID |
| `principal_type` | string | `account`（员工）或 `enterprise`（企业） |
| `quota_limit` | float | 额度上限（元） |
| `quota_used` | float | 已使用额度（元） |
| `remaining` | float | 剩余额度 = quota_limit - quota_used |
| `status` | string | 账号状态：`normal` / `disabled` |

---

## 2. 查询本企业所有子账号余额（仅企业）

```
GET /api/v1/billing/accounts
```

**说明：** 列出本企业所有子账号及其余额 + 汇总信息。**仅企业身份可调用**。

### 响应示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "enterprise_id": "shuquzhi",
    "summary": {
      "total_accounts": 3,
      "normal_accounts": 3,
      "total_quota_limit": 1800.00,
      "total_quota_used": 0.00,
      "total_remaining": 1800.00
    },
    "items": [
      {
        "account_id": "shuquzhi51010001",
        "enterprise_id": "shuquzhi",
        "user_id": "user-001",
        "username": "段复弟",
        "email": "duanfd@shuquzhi.com",
        "permission_level": 5,
        "department_id": "101",
        "account_number": "0001",
        "quota_limit": 1000.00,
        "quota_used": 0.00,
        "remaining": 1000.00,
        "status": "normal",
        "last_login_at": null,
        "created_at": "2026-06-24T10:00:00"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `summary.total_accounts` | int | 子账号总数（含禁用） |
| `summary.normal_accounts` | int | 启用的子账号数 |
| `summary.total_quota_limit` | float | 总额度上限 |
| `summary.total_quota_used` | float | 总已使用 |
| `summary.total_remaining` | float | 总剩余 |
| `items[].permission_level` | int | 权限等级 0-9 |
| `items[].quota_limit` | float | 该子账号的额度上限 |
| `items[].quota_used` | float | 该子账号已使用 |
| `items[].remaining` | float | 该子账号剩余 |

### 错误码

| 状态码 | 说明 |
|---|---|
| 403 | 员工账号无权调用（仅企业可用） |

---

## 3. 查询流水

```
GET /api/v1/billing/transactions
```

**说明：** 分页查询当前账号的额度变动流水。

### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `transaction_type` | string | 否 | 全部 | `consume`（消费）/ `refund`（退款）/ `recharge`（充值）/ `expire`（过期） |
| `page` | int | 否 | 1 | 页码，从 1 开始 |
| `page_size` | int | 否 | 20 | 每页条数，范围 1~100 |

### 响应示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "transaction_id": "TXN-AB12CD34EF56GH78",
        "transaction_type": "consume",
        "amount": -2.50,
        "balance_before": 1000.00,
        "balance_after": 997.50,
        "related_task_id": "task_20260624_xxx",
        "related_model_id": "豆包 Seedance 2.0 Fast",
        "description": "生成消费 task=task_xxx model=豆包 Seedance 2.0 Fast",
        "created_at": "2026-06-24T11:25:30"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1,
    "transaction_type": "consume"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `transaction_type` | string | `consume`/`refund`/`recharge`/`expire` |
| `amount` | float | 正数=增加，负数=扣减 |
| `balance_before` | float | 变动前余额 |
| `balance_after` | float | 变动后余额 |
| `related_task_id` | string | 关联任务 ID（消费/退款时） |
| `related_model_id` | string | 关联模型的**展示名**（PR-4.9：即 `ai_models.display_name`，如 `"豆包 Seedance 2.0 Fast"`）。前端账单/流水页直接展示，不需要再 JOIN 翻译 |

---

## 4. 查询任务列表

```
GET /api/v1/billing/tasks
```

**说明：** 分页查询当前账号的生成任务列表。

### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `status` | string | 否 | 全部 | `pending` / `processing` / `completed` / `failed` |
| `page` | int | 否 | 1 | 页码，从 1 开始 |
| `page_size` | int | 否 | 20 | 每页条数，范围 1~100 |

### 响应示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [...],
    "page": 1,
    "page_size": 20,
    "status": null
  }
}
```

---

## 5. 查询单个任务详情

```
GET /api/v1/billing/tasks/{task_id}
```

**说明：** 查询指定任务的详细信息（含扣费快照）。只能查看自己的任务。

### 路径参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 任务 ID |

### 响应示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "task_id": "task_20260624_xxx",
    "account_id": "shuquzhi51010001",
    "model_id": "豆包 Seedance 2.0 Fast",
    "status": "completed",
    "price_snapshot": 2.50,
    "quota_used": 2.50,
    "output_url": "https://...",
    "created_at": "2026-06-24T11:23:46",
    "decoded_generation_params": {
      "model": "豆包 Seedance 2.0 Fast",
      "output_type": "video",
      "feature": "text_to_video",
      "ratio": "16:9",
      "resolution": "1080P",
      "duration": 5
    }
  }
}
```

> **PR-4.9 说明**：`model_id` / `decoded_generation_params.model` 字段现在存的是 `ai_models.display_name`（模型展示名，如 `"豆包 Seedance 2.0 Fast"`），而不是上游 ID（如 `doubao-seedance-2-0-fast-260128`）或业务 ID。这样账单/详情页可以直接展示，不需要再翻译。如果前端需要稳定 ID 用于回调/路由，请使用 JOIN 出的 `business_model_id`（不在此接口响应中，需要另查 `ai_models`）。

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 403 | `FORBIDDEN` | 无权查看此任务（任务不属于当前账号） |
| 404 | `TASK_NOT_FOUND` | 任务不存在 |

---

## 6. 价格估算（不执行生成）

```
POST /api/v1/estimate-price
```

**说明：** 前端在用户点击"生成"前调用，实时显示预估价格。此接口不会实际执行生成。

### 请求体

```json
{
  "model": "doubao-seedance-2-0-fast-260128",
  "output_type": "video",
  "input_files": [],
  "parameters": {
    "duration": 5,
    "resolution": "720P",
    "ratio": "16:9",
    "with_audio": true
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `model` | string | 模型名称 |
| `output_type` | string | `video` 或 `image` |
| `input_files` | array | 输入文件列表（可为空） |
| `parameters.duration` | int | 视频时长（秒），仅视频类型 |
| `parameters.resolution` | string | 分辨率，如 `720P` / `1080P` / `2K` / `4K` |
| `parameters.with_audio` | bool | 是否包含音频 |

### 响应示例（视频）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "estimated_cost": 2.50,
    "currency": "CNY",
    "breakdown": {
      "base_price": "0.50元/秒",
      "duration": "5秒",
      "resolution": "720P",
      "with_audio": "是",
      "has_input": "否",
      "total": "2.50元"
    },
    "note": "实际扣费以生成结果为准"
  }
}
```

### 响应示例（图片）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "estimated_cost": 0.08,
    "currency": "CNY",
    "breakdown": {
      "base_price": "0.08元/张",
      "resolution": "1080P",
      "has_input": "否",
      "total": "0.08元"
    },
    "note": "实际扣费以生成结果为准"
  }
}
```

---

## 7. 任务完成后获取扣费明细（前端侧）

任务完成后调用：

```
GET /api/v1/tasks/{task_id}/status
```

响应 `data.charge_info` 包含扣费明细（仅在 `status=completed` 时存在）：

```json
{
  "status": "completed",
  "result": { "video": { "url": "https://..." } },
  "charge_info": {
    "transaction_id": "TXN-AB12CD34EF56GH78",
    "cost": 2.50,
    "balance_before": 1000.00,
    "balance_after": 997.50,
    "charged_at": "2026-06-24T11:25:30Z"
  }
}
```

---

## 扣费规则

| 任务状态 | 是否扣费 | 备注 |
|---|---|---|
| `completed`（生成成功） | ✅ 扣费 | 写入 `quota_transactions(transaction_type=consume)` |
| `failed`（生成失败） | ❌ 不扣费 | 包括模型端审核拒绝、超时、服务端错误 |
| `pending`（排队中） | ❌ 不扣费 | 仅创建 `generation_tasks` 记录 |
| `processing`（处理中） | ❌ 不扣费 | 任务运行时也不扣 |

> 失败的任务**不扣费**，符合业界惯例。如果业务需要对服务端错误也象征性收费（如防滥用），需要另加策略。

---

## 控制台调试输出（任务成功时）

```
======================================================================
[billing] 💰 扣费成功 → task=task_20260624_xxx
======================================================================
  account_id        : shuquzhi51010001
  enterprise_id     : shuquzhi
  model             : doubao-seedance-2-0-fast-260128
  cost              : 2.50 元
  transaction_id    : TXN-AB12CD34EF56GH78
  balance_before    : 1000.00 元
  balance_after     : 997.50 元
  流水可查接口       : GET /api/v1/billing/transactions
======================================================================
```

---

## 错误码汇总

| 状态码 | code | 场景 | 说明 |
|---|---|---|---|
| 401 | — | Token 无效或过期 | 需要重新登录 |
| 403 | `FORBIDDEN` | 管理员账号调用 billing 接口 | 管理员无企业配额 |
| 403 | `NO_ENTERPRISE` | Token 中缺少 enterprise_id | — |
| 403 | `FORBIDDEN` | 员工调用 `/billing/accounts` | 仅企业可用 |
| 403 | `FORBIDDEN` | 看他人任务 | 无权查看 |
| 404 | `ACCOUNT_NOT_FOUND` | 账户/企业不存在 | — |
| 404 | `TASK_NOT_FOUND` | 任务不存在 | — |

---

## 注意事项

1. **前端积分接口对接**：原 `/api/v1/points` 已废弃，应改为 `/api/v1/billing/quota`
2. **管理员不能调用 billing 接口**：`user_type=admin` 的 Token 会返回 403
3. **额度计算公式**：
   - 员工：`remaining = quota_limit - quota_used`
   - 企业：`remaining_quota = total_quota - used_quota - expired_quota`（自动计算列）
4. **失败任务不扣费**：用户重新提交不损失额度，但 Seedance 等模型端的真实消耗由平台承担
5. **数据库表**：
   - 流水 → `quota_transactions`
   - 员工余额 → `accounts`（quota_limit / quota_used）
   - 企业余额 → `enterprises`（total_quota / used_quota / remaining_quota）
   - 任务扣费快照 → `generation_tasks`（price_snapshot）
