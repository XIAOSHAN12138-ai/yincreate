# 额度/余额 API 文档

路由前缀：`/api/v1/billing`  
权限：需要 `enterprise` 或 `employee` 类型的 Token（管理员账号无企业配额，会返回 403）  
Header：`Authorization: Bearer <token>`

---

## 1. 查询余额

```
GET /api/v1/billing/quota
```

**说明：** 查询当前登录账号的配额余额。

### 响应示例

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "account_id": "shuquzhi51010001",
    "enterprise_id": "shuquzhi",
    "quota_limit": 1000.00,
    "quota_used": 0.00,
    "remaining": 1000.00,
    "status": "normal"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `account_id` | string | 当前账号 ID |
| `enterprise_id` | string | 所属企业 ID |
| `quota_limit` | float | 额度上限（元） |
| `quota_used` | float | 已使用额度（元） |
| `remaining` | float | 剩余额度 = quota_limit - quota_used |
| `status` | string | 账号状态：`normal` / `disabled` |

---

## 2. 查询流水

```
GET /api/v1/billing/transactions
```

**说明：** 分页查询当前账号的额度变动流水。

### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `transaction_type` | string | 否 | 全部 | 筛选类型：`consume`（消费）/ `refund`（退款）/ `recharge`（充值）/ `expire`（过期） |
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
        "account_id": "shuquzhi51010001",
        "transaction_type": "consume",
        "amount": -0.50,
        "balance_after": 999.50,
        "task_id": "task_xxx",
        "description": "视频生成 - 1080P 5秒",
        "created_at": "2026-06-23T10:30:00"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1,
    "transaction_type": null
  }
}
```

---

## 3. 查询任务列表

```
GET /api/v1/billing/tasks
```

**说明：** 分页查询当前账号的生成任务列表。

### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `status` | string | 否 | 全部 | 筛选状态：`pending` / `processing` / `completed` / `failed` |
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

## 4. 查询单个任务详情

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
    "task_id": "task_xxx",
    "account_id": "shuquzhi51010001",
    "model_name": "GV 3.1",
    "status": "completed",
    "quota_cost": 0.50,
    "output_url": "https://...",
    "created_at": "2026-06-23T10:30:00"
  }
}
```

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 403 | `FORBIDDEN` | 无权查看此任务（任务不属于当前账号） |
| 404 | `TASK_NOT_FOUND` | 任务不存在 |

---

## 5. 价格估算（不执行生成）

```
POST /api/v1/estimate-price
```

**说明：** 前端在用户点击"生成"前调用，实时显示预估价格。此接口不会实际执行生成。

### 请求体

```json
{
  "model": "GV 3.1",
  "output_type": "video",
  "input_files": [],
  "parameters": {
    "duration": 5,
    "resolution": "1080P",
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
      "resolution": "1080P",
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

## 错误码汇总

| 状态码 | 场景 | 说明 |
|---|---|---|
| 401 | Token 无效或过期 | 需要重新登录 |
| 403 | 管理员账号调用 billing 接口 | 管理员无企业配额 |
| 403 | `FORBIDDEN` | Token 中缺少 enterprise_id |
| 404 | 账户或任务不存在 | — |

---

## 注意事项

1. **前端积分接口对接**：前端原来调用的 `/api/v1/points` 应改为 `/api/v1/billing/quota`
2. **管理员不能调用 billing 接口**：`user_type=admin` 的 Token 会返回 403
3. **额度计算公式**：`remaining = quota_limit - quota_used - expired_quota`
