# 修改密码接口文档

## 1. 接口概览

| 项目 | 说明 |
| --- | --- |
| 接口名称 | 修改当前登录用户密码 |
| 请求方法 | `POST` |
| 接口路径 | `/api/v1/auth/password` |
| 鉴权方式 | `Authorization: Bearer <access_token>` |
| 适用账号 | `enterprise` 企业管理员、`employee` 企业员工 |
| 不支持账号 | `admin` 系统管理员 |
| Content-Type | `application/json` |

该接口用于**当前登录用户修改自己的密码**。调用方必须先登录并携带有效 Bearer Token。

---

## 2. 请求头

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | 登录接口返回的访问令牌，格式为 `Bearer <token>` |
| `Content-Type` | 是 | 固定为 `application/json` |

---

## 3. 请求体

```json
{
  "old_password": "old-password",
  "new_password": "new-password"
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `old_password` | string | 是 | 长度 1-128 | 当前密码 |
| `new_password` | string | 是 | 长度 1-128；不能与旧密码相同 | 新密码 |

> 当前版本暂不强制密码复杂度，只校验非空、长度范围以及新旧密码不能相同。

---

## 4. 成功响应

HTTP Status: `200 OK`

```json
{
  "message": "Password updated",
  "user_type": "employee",
  "target_sub": "account_001",
  "reset_at": "2026-07-29T12:34:56.789Z"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message` | string | 固定成功描述，当前为 `Password updated` |
| `user_type` | string | 被修改密码的账号类型：`enterprise` 或 `employee` |
| `target_sub` | string | 被修改密码账号的登录 ID |
| `reset_at` | string | 修改完成时间，UTC ISO8601，末尾 `Z` |

---

## 5. 错误响应

错误响应由 FastAPI 以 `detail` 包裹业务错误体：

```json
{
  "detail": {
    "code": "INVALID_INPUT",
    "message": "新密码不能与旧密码相同"
  }
}
```

### 常见错误码

| HTTP 状态码 | code | 说明 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | 旧密码或新密码为空，或新密码与旧密码相同 |
| 401 | `TOKEN_INVALID` | Token 中的 `user_type` 非法 |
| 401 | `INVALID_CREDENTIALS` | 旧密码错误或登录凭证无效 |
| 403 | `NOT_SUPPORTED` | 系统管理员 `admin` 不支持通过该接口修改密码 |
| 404 | `USER_NOT_FOUND` | 账号不存在或已被删除 |

> 旧密码校验复用登录认证逻辑，因此账号不存在、账号禁用、旧密码错误等认证失败场景，可能统一表现为认证类错误。

---

## 6. 调用示例

### cURL

```bash
curl -X POST "http://localhost:8000/api/v1/auth/password" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "old-password",
    "new_password": "new-password"
  }'
```

### JavaScript / fetch

```js
async function changePassword(accessToken, oldPassword, newPassword) {
  const response = await fetch('/api/v1/auth/password', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.detail || data;
    throw new Error(error.message || '修改密码失败');
  }

  return data;
}
```

---

## 7. 后端处理逻辑

接口实现位置：

- 路由：`app/api/auth.py`
- 请求/响应 DTO：`app/api/auth_dto.py`
- 业务逻辑：`app/services/auth_service.py`

处理流程：

1. 校验 Bearer Token，读取当前登录用户身份。
2. 拒绝 `admin` 系统管理员调用。
3. 校验 `old_password` 和 `new_password` 非空。
4. 校验新旧密码不能相同。
5. 使用当前账号和旧密码重新认证。
6. 认证通过后更新对应表：
   - `enterprise`：更新 `enterprises.password_hash` 和 `last_password_reset`
   - `employee`：更新 `accounts.password_hash` 和 `last_password_reset`
7. 写入密码修改审计日志 `password_change_logs`。

---

## 8. 注意事项

1. 修改密码成功后，前端建议提示用户重新登录或刷新当前 token 策略。
2. 当前接口只允许用户修改**自己的密码**。
3. 企业管理员重置员工密码、系统管理员重置企业管理员密码属于其他接口，不使用本接口。
4. 失败和成功都会写入密码修改审计日志，便于后续安全审计。
