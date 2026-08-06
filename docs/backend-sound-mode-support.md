# 后端对接文档：模型声音模式与特色功能字段扩展

> 面向：后端开发人员
> 目的：让管理员后台配置的「声音模式」「前端用户功能」「支持功能」三个字段真正在用户端生成页面生效
> 关联前端文件：`src/api/adminModels.js`、`src/views/AdminView.vue`、`src/views/GenerateView.vue`
> 关联已有后端文档：
> - [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) — 管理员模型 CRUD 接口（字段命名权威来源）
> - [`前端API接口文档.md`](../前端API接口文档.md) — 用户端 `/api/v1/models` 接口
> - [`视频生成声音控制功能-后端接口更新说明.md`](../视频生成声音控制功能-后端接口更新说明.md) — 声音参数 `sound` 权威定义
>
> 文档日期：2026-07-17

---

## 一、背景与问题

管理员后台「模型管理 → 编辑」目前提供三个相关配置项：

| 配置项 | 前端字段名 | 管理员界面位置 | 用户端作用 |
|---|---|---|---|
| 声音模式 | `sound_mode` | 编辑弹窗下拉框 | 控制生成页声音开关的显示/禁用/隐藏，以及是否向生成请求发送 `sound` 参数 |
| 前端用户功能 | `ui_features` | 编辑弹窗多选框 | 控制生成页该模型可选的特色功能列表（如首尾帧、AI 换装等） |
| 支持功能 | `supported_features` | 编辑弹窗多选框 | 描述模型能力清单（如 `text_to_video`、`image_to_video`） |

**当前问题**：

1. `sound_mode` — 后端**完全未实现**：DB 无字段、DTO 未定义、`/api/v1/models` 不返回，导致管理员修改后用户端不生效
2. `ui_features` — 后端**完全未定义**：同上，是最大的契约缺口
3. `supported_features` — 后端 admin 接口已支持（见 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §2.2），但 `/api/v1/models` 用户端接口**不透传**，导致用户端只能读 mock 数据
4. 前端 `buildModelPayload` 存在「空数组/null 不发送」的 bug（已修复，见第七节），需要后端 PATCH 接口配合支持「显式置 null / 空数组」语义

---

## 二、字段定义（与后端现有命名风格对齐）

### 2.1 字段元数据

参照 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §2.2「可选字段」表的风格，新增以下三行：

| 字段 | 类型 | 默认 | 适用范围 | 说明 |
|---|---|---|---|---|
| `sound_mode` | string \| NULL | `NULL` | 仅 `media_type='video'` 有意义；非视频模型为 `NULL` | 声音模式枚举，见 2.2 |
| `ui_features` | list[string] \| NULL | `NULL` | 所有模型类型 | 前端 UI 特色功能 ID 清单，见 2.3 |
| `supported_features` | list[string] \| NULL | `NULL` | 所有模型类型 | 模型能力清单（**已存在于 admin API，仅需在 `/api/v1/models` 透传**） |

> 命名风格统一为 **snake_case**，与 `model_id` / `display_name` / `vendor_display_name` / `supported_resolutions` / `price_per_second` 等现有字段保持一致。

### 2.2 `sound_mode` 取值语义

| 值 | 含义 | 用户端声音开关表现 | 生成请求是否发送 `parameters.sound` |
|---|---|---|---|
| `free` | 自由切换 | 开关可交互，默认无声 | 是（按用户选择 `true`/`false`） |
| `forced-sound` | 强制有声 | 开关禁用，显示「有声」 | 否（模型原生有声，由后端按模型默认行为处理） |
| `disabled-silent` | 强制无声 | 开关禁用，显示「无声」 | 否（模型不支持音频） |
| `hidden` | 隐藏开关 | 不渲染声音开关 | 否（等同无声） |
| `NULL` | 不适用 | 非视频模型不显示声音开关 | 否 |

> ⚠️ **重要**：`forced-sound` 模型**不要**让前端发送 `sound=true`，否则会触发后端 `supports_audio` 校验拒绝（详见 [`视频生成声音控制功能-后端接口更新说明.md`](../视频生成声音控制功能-后端接口更新说明.md) §一）。前端已做过滤，后端需做防御性兼容。

### 2.3 `ui_features` 取值域

参照前端 `src/api/adminModels.js` 中 `FEATURE_UI_OPTIONS` 常量定义：

#### 图片模型（`media_type='image'`）

| 值 | 含义 |
|---|---|
| `text2img` | 文生图 |
| `reference` | 参考图 |
| `style-transfer` | 风格转换 |
| `inpaint` | 局部重绘 |
| `outpaint` | 扩图 |
| `erase` | 消除笔 |
| `face-swap` | AI 换脸 |
| `outfit-change` | AI 换装 |

#### 视频模型（`media_type='video'`）

| 值 | 含义 |
|---|---|
| `all-reference` | 全能参考 |
| `video-expand` | 视频扩写 |
| `first-last-frame` | 首尾帧 |
| `smart-multi-frame` | 智能多帧 |
| `first-frame-gen` | 首帧生成 |
| `motion-imitate` | 动作模仿 |
| `lip-sync` | 对口型 |
| `ai-outfit` | AI 换装 |
| `scene-replace` | 场景替换 |
| `local-adjust` | 局部调整 |
| `style-replace` | 风格替换 |
| `effect-copy` | 特效复刻 |
| `item-fix` | 物品修复 |
| `color-restore` | 色彩还原 |
| `smart-remove` | 智能消除 |

#### 数字人（`media_type='digital-human'`）

| 值 | 含义 |
|---|---|
| `talking-head` | 数字人播报 |
| `voice-clone` | 声音克隆 |
| `emotion-control` | 情感控制 |
| `gesture-control` | 手势控制 |

> 注意：`ui_features` 用 **kebab-case**（如 `first-last-frame`），与生成请求 `feature` 字段的 kebab-case 值同词汇表；而 `supported_features` 用 **snake_case**（如 `text_to_video`），与生成请求 `feature` 字段的 snake_case 值同词汇表。两者词汇表部分重叠但语义不同：`supported_features` 偏能力清单，`ui_features` 偏 UI 入口开关。

### 2.4 `supported_features` 取值域

已在 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §2.2 隐式定义，参考前端 `src/api/adminModels.js` 的 `FEATURE_OPTIONS` 常量：

| 值 | 含义 |
|---|---|
| `text_to_image` | 文生图 |
| `image_to_image` | 图生图 |
| `text_to_video` | 文生视频 |
| `image_to_video` | 图生视频 |
| `text_to_audio` | 文生音频 |
| `audio_to_audio` | 音频转音频 |
| `video_edit` | 视频编辑 |
| `image_to_3d` | 图生 3D |

---

## 三、数据库改动

### 3.1 表结构

表：`ai_models`（见 `database/sql/schema/19_ai_models.sql`）

新增两列（`supported_features` 列已存在，无需新增）：

```sql
-- 声音模式
ALTER TABLE ai_models
  ADD COLUMN sound_mode VARCHAR(20) NULL
  COMMENT '声音模式：free/forced-sound/disabled-silent/hidden；非视频模型为 NULL';

-- 前端用户功能
ALTER TABLE ai_models
  ADD COLUMN ui_features JSON NULL
  COMMENT '前端 UI 特色功能 ID 清单，如 ["first-last-frame","ai-outfit"]';

-- 可选：CHECK 约束（MySQL 8.0+ / PostgreSQL）
ALTER TABLE ai_models
  ADD CONSTRAINT chk_sound_mode
  CHECK (sound_mode IS NULL OR sound_mode IN ('free', 'forced-sound', 'disabled-silent', 'hidden'));
```

> 说明：`ui_features` 用 JSON 类型（与 `supported_features` 一致，假设后者是 JSON/数组列类型）。若现有 `supported_features` 使用 PostgreSQL `text[]` 或 MySQL `JSON`，请保持 `ui_features` 类型一致。

### 3.2 历史数据回填

```sql
-- 腾讯云 VOD 支持 free 的视频模型
UPDATE ai_models
SET sound_mode = 'free'
WHERE media_type = 'video'
  AND vendor = 'vendor_a'
  AND (model_id LIKE 'kling_%' OR model_id LIKE 'gv_%' OR model_id LIKE 'seedance_%');

-- HappyHorse 系列原生有声
UPDATE ai_models
SET sound_mode = 'forced-sound'
WHERE media_type = 'video'
  AND model_id LIKE 'happyhorse%';

-- 其他视频模型默认强制无声
UPDATE ai_models
SET sound_mode = 'disabled-silent'
WHERE media_type = 'video'
  AND sound_mode IS NULL;

-- 非视频模型 sound_mode 保持 NULL

-- ui_features 回填示例（视频模型默认全能参考）
UPDATE ai_models
SET ui_features = JSON_ARRAY('all-reference', 'first-last-frame', 'first-frame-gen')
WHERE media_type = 'video'
  AND ui_features IS NULL;

-- 图片模型默认文生图 + 参考图
UPDATE ai_models
SET ui_features = JSON_ARRAY('text2img', 'reference')
WHERE media_type = 'image'
  AND ui_features IS NULL;
```

---

## 四、Admin API 改动（`/api/v1/admin/models/*`）

### 4.1 字段加入 Pydantic Schema

参照 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §4.3 完整请求体示例的风格，在 `ModelCreate` / `ModelUpdate` 中加入新字段：

```python
# app/api/admin/models.py 或对应 schema 文件
from typing import Optional, List, Literal
from pydantic import BaseModel

SOUND_MODE_VALUES = {'free', 'forced-sound', 'disabled-silent', 'hidden'}
UI_FEATURE_VALUES = {
    # image
    'text2img', 'reference', 'style-transfer', 'inpaint', 'outpaint', 'erase',
    'face-swap', 'outfit-change',
    # video
    'all-reference', 'video-expand', 'first-last-frame', 'smart-multi-frame',
    'first-frame-gen', 'motion-imitate', 'lip-sync', 'ai-outfit', 'scene-replace',
    'local-adjust', 'style-replace', 'effect-copy', 'item-fix', 'color-restore',
    'smart-remove',
    # digital-human
    'talking-head', 'voice-clone', 'emotion-control', 'gesture-control'
}

class ModelCreate(BaseModel):
    # ... 已有字段（见 ADMIN_MODELS_API.md §2.1 / §2.2）
    sound_mode: Optional[Literal['free', 'forced-sound', 'disabled-silent', 'hidden']] = None
    ui_features: Optional[List[str]] = None
    # supported_features 已存在，无需新增

class ModelUpdate(BaseModel):
    # ... 已有字段
    sound_mode: Optional[Literal['free', 'forced-sound', 'disabled-silent', 'hidden']] = None
    ui_features: Optional[List[str]] = None
    # 注意：sound_mode / ui_features 允许显式传 null / 空数组表示清空，不能用 exclude_none 屏蔽
```

### 4.2 关键：PATCH 接口要支持「显式置 null / 空数组」

当前 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §6.1 描述 PATCH 使用 `model_dump(exclude_none=True)` 只更新显式传入字段。**`sound_mode` 和 `ui_features` 需要特例处理**：

```python
# app/api/admin/models.py PATCH 实现
def patch_model(model_id: str, payload: ModelUpdate):
    update_data = payload.model_dump(exclude_none=True)

    # 特例 1：sound_mode 显式传 null 时也要写入（清空场景）
    # Pydantic 默认 exclude_none 会丢弃 None，需要从原始 payload.model_fields_set 取
    if 'sound_mode' in payload.model_fields_set:
        update_data['sound_mode'] = payload.sound_mode  # 可能是 None

    # 特例 2：ui_features 显式传空数组时也要写入（清空所有 UI 功能）
    # 空数组 [] 是 truthy 且不等于 None，理论上不会被 exclude_none 丢弃；
    # 但若用了 exclude_default 或自定义过滤，需要从 model_fields_set 兜底
    if 'ui_features' in payload.model_fields_set:
        update_data['ui_features'] = payload.ui_features  # 可能是 None 或 []

    # 特例 3：supported_features 同样允许空数组清空
    if 'supported_features' in payload.model_fields_set:
        update_data['supported_features'] = payload.supported_features  # 可能是 None 或 []

    if not update_data:
        raise HTTPException(400, 'NO_CHANGES')

    # ... 走 DAO 更新 + 写 changelog
```

> 💡 **前端已配合**：`src/views/AdminView.vue` 的 `cleanPatchData` 已保证 `sound_mode` 始终出现在 PATCH body 中（即使是 null），`ui_features` 和 `supported_features` 也始终发送（即使是空数组）。后端只要识别并持久化即可。

### 4.3 列表 / 详情接口响应

`GET /api/v1/admin/models` 和 `GET /api/v1/admin/models/{model_id}` 的响应 data 中需包含 `sound_mode` 和 `ui_features` 字段（`supported_features` 已存在）。

示例（参照 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §3.2 响应格式）：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "model_id": "kling_3_0",
        "model_name": "Kling",
        "model_version": "3.0",
        "display_name": "Kling 3.0",
        "vendor": "vendor_a",
        "vendor_display_name": "腾讯云 VOD",
        "media_type": "video",
        "supported_features": ["text_to_video", "image_to_video"],
        "ui_features": ["all-reference", "first-last-frame", "first-frame-gen", "lip-sync", "ai-outfit", "scene-replace"],
        "sound_mode": "free",
        "supported_resolutions": ["720P", "1080P", "2K"],
        "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
        "max_duration": 10,
        "max_fps": 30,
        "price_per_second": 50,
        "price_multiplier": 1.00,
        "currency": "POINTS",
        "status": "active",
        "is_enabled": true,
        "created_at": "2026-06-15T14:00:00",
        "updated_at": "2026-06-15T14:00:00"
      }
    ],
    "total": 45,
    "limit": 200,
    "offset": 0,
    "filters": { "vendor": null, "media_type": null, "status": null, "is_enabled": null }
  }
}
```

### 4.4 Changelog 记录

PATCH 修改 `sound_mode` / `ui_features` 时自动写入 changelog，与现有字段一致（参照 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §9.2）：

```json
{
  "id": 18,
  "model_id": "kling_3_0",
  "change_type": "updated",
  "change_description": "updated 2 field(s) via admin API",
  "changed_fields": {
    "sound_mode": { "old": "free", "new": "forced-sound" },
    "ui_features": { "old": ["all-reference", "lip-sync"], "new": ["all-reference"] }
  },
  "operator_id": "72cae811-611c-4691-8677-001bf2ba106c",
  "operator_name": "系统管理员",
  "created_at": "2026-06-18T15:30:00"
}
```

### 4.5 Clone 接口

`POST /api/v1/admin/models/{model_id}/clone` 需要把 `sound_mode` 和 `ui_features` 一起复制到新模型，与 `supported_features`、`max_duration` 等同级别处理（参照 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §10a.3「✅ 复制」字段清单）。

---

## 五、用户端只读 API 改动（`/api/v1/models`）

### 5.1 响应字段透传

前端 `GenerateView.vue` 通过 `GET /api/v1/models` 拉取用户可见模型列表，并通过以下字段决定用户端行为：

| 字段 | 用户端用途 |
|---|---|
| `sound_mode` | 决定声音开关的显示/禁用/隐藏，以及是否发送 `sound` 参数 |
| `ui_features` | 决定特色功能下拉框的可选项 |
| `supported_features` | 当前用户端未直接消费，但建议一并透传以备扩展 |
| `supported_resolutions` | 决定分辨率选项过滤（前端已有降级逻辑） |
| `max_duration` | 决定时长滑块上限（前端已有降级逻辑） |

**要求**：响应中每个 `video_models[]` 元素必须包含上述字段。

### 5.2 响应示例（参照 [`前端API接口文档.md`](../前端API接口文档.md) 与 [`模型接口更新说明.md`](../模型接口更新说明.md)）

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "image_models": [
      {
        "id": "gpt-image-2",
        "name": "GPT Image 2",
        "description": "文生图",
        "vendor": "vendor_b",
        "vendor_name": "Token Switch",
        "is_new": false,
        "is_vip": false,
        "sound_mode": null,
        "ui_features": ["text2img", "reference"],
        "supported_features": ["text_to_image"],
        "supported_resolutions": ["1024x1024"],
        "max_duration": null
      }
    ],
    "video_models": [
      {
        "id": "kling_3_0",
        "name": "Kling 3.0",
        "description": "高质量视频生成",
        "vendor": "vendor_a",
        "vendor_name": "腾讯云 VOD",
        "is_new": false,
        "is_vip": false,
        "sound_mode": "free",
        "ui_features": ["all-reference", "first-last-frame", "first-frame-gen", "lip-sync", "ai-outfit", "scene-replace"],
        "supported_features": ["text_to_video", "image_to_video"],
        "supported_resolutions": ["720P", "1080P", "2K"],
        "max_duration": 10
      },
      {
        "id": "happyhorse-1.0-r2v-720p",
        "name": "HappyHorse R2V 720p",
        "description": "图生视频",
        "vendor": "vendor_b",
        "vendor_name": "Token Switch",
        "is_new": false,
        "is_vip": false,
        "sound_mode": "forced-sound",
        "ui_features": ["all-reference"],
        "supported_features": ["image_to_video"],
        "supported_resolutions": ["720P"],
        "max_duration": 10
      }
    ],
    "voices": [],
    "summary": {
      "total_image_models": 11,
      "total_video_models": 21,
      "total_voices": 9,
      "vendors": ["vendor_a", "vendor_b"]
    }
  }
}
```

> 命名说明：用户端接口保留现有的 `id` / `name` / `vendor_name` / `is_new` / `is_vip` 简化命名（与 [`模型接口更新说明.md`](../模型接口更新说明.md) 一致），新增字段 `sound_mode` / `ui_features` / `supported_features` / `supported_resolutions` / `max_duration` 统一用 snake_case，与 admin 接口对齐，避免歧义。

### 5.3 字段过滤规则

| 条件 | 输出规则 |
|---|---|
| `media_type = 'video'` 且 `is_enabled = true` | `sound_mode` 输出实际值；`ui_features` / `supported_features` / `supported_resolutions` / `max_duration` 输出实际值 |
| `media_type = 'image'` | `sound_mode` 输出 `null`；其他字段正常输出 |
| `media_type = 'audio'` | `sound_mode` 输出 `null`；`ui_features` 输出实际值或 `null` |
| `is_enabled = false` | 该模型不返回（前端会过滤） |

### 5.4 缓存失效

管理员改价 / 改 `sound_mode` / 改 `ui_features` / 改 `supported_features` 后，`token_switch_helper` 缓存要失效，确保前端 `/api/v1/models` 能立即拿到新值（与现有价格缓存失效逻辑一致，见 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §4.5 / §7.3）。

---

## 六、生成请求接口行为（`/api/v1/generate`）

### 6.1 前端发送逻辑（已完成，供后端参考）

参照 [`视频生成声音控制功能-后端接口更新说明.md`](../视频生成声音控制功能-后端接口更新说明.md) §一，声音参数字段名最终确认为 **`parameters.sound`**（boolean，默认 `false`）。

| 模型 `sound_mode` | 前端是否发送 `parameters.sound` | 说明 |
|---|---|---|
| `free` | 是（`true`/`false` 按用户选择） | 用户可自由切换 |
| `forced-sound` | 否 | 避免触发 `supports_audio` 校验拒绝 |
| `disabled-silent` | 否 | 模型不支持音频 |
| `hidden` | 否 | 等同无声 |
| `NULL` | 否 | 非视频模型或未配置 |

> ⚠️ **历史别名兼容**：现存文档中 `parameters.sound` 有多个别名（`with_audio` 见 [`价格估算接口文档.md`](../价格估算接口文档.md)、`audio_generation` / `generate_audio` 见 [`UNIFIED_VIDEO_API.md`](../UNIFIED_VIDEO_API.md)）。建议后端在统一字段名时以 `sound` 为主，其他作为兼容别名静默接受。本次对接不涉及收敛别名，仅确保 `sound_mode` 行为正确。

### 6.2 后端处理建议

1. **接收请求时**，从模型配置读取 `sound_mode`：
   - `free`：使用前端传入的 `sound` 值（默认 `false`）
   - `forced-sound`：忽略前端 `sound`，强制按有声处理
   - `disabled-silent` / `hidden` / `NULL`：忽略前端 `sound`，强制无声

2. **校验阶段**：
   - 若 `sound_mode != 'free'` 且前端传了 `sound` 字段，建议**静默忽略**而非报错（前端已做过滤，这里只是防御性）
   - `forced-sound` 模型不要触发 `supports_audio` 校验失败

3. **下游调用厂商**：
   - 按最终决定的有声/无声值传给厂商 API

### 6.3 `ui_features` 与生成请求 `feature` 字段的关系

前端生成请求中的 `feature` 字段（见 [`前端API接口文档.md`](../前端API接口文档.md) §2.2）取值来自 `ui_features`：

```
用户在生成页选择特色功能 → 前端从 model.ui_features 列表中取出选中项 → 作为 request.feature 发送
```

| `feature` 字段值风格 | 来源 | 示例 |
|---|---|---|
| snake_case | `supported_features` 词汇表 | `text_to_video` / `image_to_video` |
| kebab-case | `ui_features` 词汇表 | `first-last-frame` / `ai-outfit` / `scene-replace` |

> 后端在 `/api/v1/generate` 接收 `feature` 时需兼容两种风格（已存在的约定，本次不改动）。

---

## 七、前端已完成的改动（供后端联调参考）

### 7.1 `src/views/AdminView.vue`（管理员侧）

**`buildModelPayload` 函数**修复了「空数组/null 不发送」的 bug：

```javascript
// 数组字段
// supported_features 允许为空数组（清空所有支持功能），始终发送
payload.supported_features = [...(f.supported_features || [])]
// sound_mode 允许为 null（非视频模型），始终发送以便清空
payload.sound_mode = f.sound_mode
// ui_features 允许为空数组（清空所有特色功能），始终发送
payload.ui_features = [...(f.ui_features || [])]
```

**`submitModel` 函数** PATCH 分支的 `cleanPatchData` 对 `sound_mode` 特例保留 null：

```javascript
const cleanPatchData = {}
for (const [key, value] of Object.entries(patchData)) {
  if (key === 'sound_mode') {
    cleanPatchData[key] = value  // 保留 null
  } else if (value !== null && value !== undefined && value !== '') {
    cleanPatchData[key] = value
  }
}
```

> 说明：`ui_features` 和 `supported_features` 是空数组 `[]`，是 truthy 且不等于 `null`/`undefined`/`''`，会通过 `cleanPatchData` 过滤被发送到后端，无需特例处理。

### 7.2 `src/views/GenerateView.vue`（用户侧）

- `soundToggleMode` computed：优先读 `model.sound_mode`，无值则按旧逻辑字符串匹配降级
- `showSoundToggle` computed：当 `model.sound_mode === 'hidden'` 时不渲染声音开关
- `soundToggleDisabled`：非 `free` 模式禁用开关
- `currentFeatures` computed：若 `model.ui_features` 非空，只显示该模型支持的功能；否则降级显示全量功能
- 生成请求构造：`free` 模式才发送 `parameters.sound`

---

## 八、联调验收清单

### 8.1 管理员后台

- [ ] 新增视频模型时能选择 `sound_mode` 和勾选 `ui_features` / `supported_features`，保存成功
- [ ] 编辑现有视频模型的 `sound_mode`，PATCH 请求 body 中包含 `sound_mode` 字段（包括 null）
- [ ] 编辑现有模型的 `ui_features`，清空所有勾选后 PATCH 请求 body 中包含 `ui_features: []`
- [ ] 编辑现有模型的 `supported_features`，清空所有勾选后 PATCH 请求 body 中包含 `supported_features: []`
- [ ] 后端持久化后，`GET /api/v1/admin/models` 列表能返回新的 `sound_mode` / `ui_features` / `supported_features`
- [ ] Changelog 中能看到 `sound_mode` / `ui_features` / `supported_features` 的 old/new 变更
- [ ] 非视频模型 `sound_mode` 显示为「不适用」，PATCH 后端不会报 422
- [ ] Clone 模型时，`sound_mode` / `ui_features` / `supported_features` 被完整复制

### 8.2 用户端

- [ ] 管理员把某模型 `sound_mode` 改为 `hidden`，用户刷新 `/generate` 页面后该模型**不再显示声音开关**
- [ ] `sound_mode = free`：开关可交互，点击有声后生成请求 body 含 `parameters.sound: true`
- [ ] `sound_mode = forced-sound`：开关禁用且显示有声，生成请求**不含** `sound` 字段
- [ ] `sound_mode = disabled-silent`：开关禁用且显示无声，生成请求不含 `sound` 字段
- [ ] 管理员把某模型 `ui_features` 改为 `["all-reference"]`，用户刷新后该模型特色功能下拉框**只显示「全能参考」**
- [ ] 管理员把某模型 `ui_features` 清空为 `[]`，用户刷新后该模型特色功能下拉框**显示全量功能**（前端降级兜底）
- [ ] 缓存 TTL 30 分钟，或管理员修改后立即失效

### 8.3 兼容性

- [ ] 旧客户端不传 `sound_mode` / `ui_features` 字段时，后端默认按 `NULL` 处理（用户端表现等同 `disabled-silent` / 全量功能）
- [ ] 后端 `/api/v1/models` 返回的字段缺失 `sound_mode` / `ui_features` 时，前端按字符串匹配降级（已有降级逻辑）
- [ ] 后端 `/api/v1/generate` 收到 `sound_mode != free` 模型附带 `sound` 字段时，静默忽略而非报错

---

## 九、接口契约摘要

### 9.1 PATCH /api/v1/admin/models/{model_id}

**Request Body**（节选，与 [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) §6.2 风格一致）：

```json
{
  "sound_mode": "free",
  "ui_features": ["all-reference", "first-last-frame"],
  "supported_features": ["text_to_video", "image_to_video"]
}
```

清空场景：

```json
{
  "sound_mode": null,
  "ui_features": [],
  "supported_features": []
}
```

**Response**（节选）：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "kling_3_0",
    "sound_mode": "free",
    "ui_features": ["all-reference", "first-last-frame"],
    "supported_features": ["text_to_video", "image_to_video"]
  }
}
```

### 9.2 GET /api/v1/models

**Response**（video_models 节选，与 [`模型接口更新说明.md`](../模型接口更新说明.md) 风格一致）：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "video_models": [
      {
        "id": "kling_3_0",
        "name": "Kling 3.0",
        "vendor": "vendor_a",
        "vendor_name": "腾讯云 VOD",
        "sound_mode": "free",
        "ui_features": ["all-reference", "first-last-frame", "first-frame-gen"],
        "supported_features": ["text_to_video", "image_to_video"],
        "supported_resolutions": ["720P", "1080P", "2K"],
        "max_duration": 10
      }
    ]
  }
}
```

### 9.3 POST /api/v1/generate（仅声音相关，节选）

参照 [`视频生成声音控制功能-后端接口更新说明.md`](../视频生成声音控制功能-后端接口更新说明.md) §一与 [`前端API接口文档.md`](../前端API接口文档.md) §2.2：

```json
{
  "output_type": "video",
  "model": "Kling 3.0",
  "vendor": "vendor_a",
  "feature": "first-last-frame",
  "parameters": {
    "resolution": "1080P",
    "duration": 5,
    "ratio": "16:9",
    "sound": false
  },
  "prompt": "从首帧过渡到尾帧",
  "input_files": []
}
```

> 仅当模型 `sound_mode === 'free'` 时，前端才会在 `parameters` 中包含 `sound` 字段；其他模式下该字段缺席，后端按模型 `sound_mode` 自动决策。

---

## 十、字段命名对照速查表

为避免同一数据有不同命名字段，下表汇总所有相关字段的最终命名：

| 语义 | admin 接口字段名 | 用户端 `/api/v1/models` 字段名 | 生成请求字段名 | 备注 |
|---|---|---|---|---|
| 模型业务 ID | `model_id` | `id` | `model`（取值） | admin 用 `model_id`，用户端简化为 `id`，生成请求 `model` 字段值为该 ID 或 `name` |
| 模型展示名 | `display_name` | `name` | `model`（取值） | 同上 |
| 厂商友好名 | `vendor_display_name` | `vendor_name` | – | 同语义不同名，保持现状 |
| 模型类型 | `media_type` | – | `output_type`（取值映射） | `media_type='video'` 对应 `output_type='video'` |
| **声音模式** | `sound_mode` | `sound_mode` | – | **本次新增，两端统一命名** |
| **前端用户功能** | `ui_features` | `ui_features` | `feature`（取值来源） | **本次新增，两端统一命名** |
| **支持功能** | `supported_features` | `supported_features` | – | **admin 已有，用户端本次透传** |
| 支持分辨率 | `supported_resolutions` | `supported_resolutions` | `parameters.resolution`（取值） | admin 已有，用户端建议透传 |
| 最大时长 | `max_duration` | `max_duration` | `parameters.duration`（上限） | admin 已有，用户端建议透传 |
| **声音开关参数** | – | – | `parameters.sound` | 主名，默认 `false`；别名 `with_audio`/`audio_generation`/`generate_audio` 兼容 |
| 启停开关 | `is_enabled` | –（不返回停用模型） | – | |
| 状态 | `status` | – | – | |

---

## 十一、相关文件索引

### 后端文档（权威来源）

| 文件 | 用途 |
|---|---|
| [`ADMIN_MODELS_API.md`](../ADMIN_MODELS_API.md) | 管理员模型 CRUD API 字段命名权威来源 |
| [`前端API接口文档.md`](../前端API接口文档.md) | 用户端 `/api/v1/models` 与 `/api/v1/generate` 接口规范 |
| [`模型接口更新说明.md`](../模型接口更新说明.md) | `/api/v1/models` 响应格式补充说明 |
| [`视频生成声音控制功能-后端接口更新说明.md`](../视频生成声音控制功能-后端接口更新说明.md) | 声音参数 `sound` 字段权威定义 |
| [`价格估算接口文档.md`](../价格估算接口文档.md) | `with_audio` 别名来源 |
| [`UNIFIED_VIDEO_API.md`](../UNIFIED_VIDEO_API.md) | `audio_generation` / `generate_audio` 别名来源 |

### 前端实现

| 文件 | 用途 |
|---|---|
| `src/api/adminModels.js` | 前端 admin API 封装，含 `SOUND_MODE_OPTIONS` / `FEATURE_UI_OPTIONS` / `FEATURE_OPTIONS` 常量 |
| `src/views/AdminView.vue` | 管理员模型管理 UI（编辑弹窗、列表表格） |
| `src/views/GenerateView.vue` | 用户生成页面，按 `sound_mode` / `ui_features` / `supported_resolutions` / `max_duration` 控制行为 |
| `src/stores/modelConfig.js` | 模型配置 Pinia store + localStorage 缓存（30 分钟 TTL） |

### 数据库

| 文件 | 用途 |
|---|---|
| `database/sql/schema/19_ai_models.sql` | `ai_models` 表结构定义（需新增 `sound_mode` / `ui_features` 列） |

---

**文档日期**：2026-07-17
**前端版本**：`sound_mode` / `ui_features` / `supported_features` 字段已就绪，等待后端对接
**对接优先级**：`sound_mode`（P0，用户可见） > `ui_features`（P0，用户可见） > `supported_features` 透传（P1，目前前端有降级）
