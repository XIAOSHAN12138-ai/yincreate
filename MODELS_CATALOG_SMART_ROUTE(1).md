# 模型列表 API (Smart Route + HappyHorse 家族聚合)

> 适用范围: `GET /api/v1/models`
> 更新日期: 2026-08-20 (PR-A: 完整字段透出 + 上游路由表暴露)
> 关联代码: [app/api/models_catalog.py](../app/api/models_catalog.py)

> ## 📌 PR-A（2026-08-20）：完整字段透出 + 上游路由表暴露
>
> `GET /api/v1/models` 现在向**前端**暴露 `ai_models` 主表绝大多数字段，并通过 `ai_model_upstream_routes` 表（PR-4.13 路由表）注入每条模型的上游路由回退列表。
>
> 新增/修正字段（详见 §2.1 字段表）：
>
> | 字段 | 数据源 | 用途 |
> |---|---|---|
> | `description` | `ai_models.description` 真值 | 模型真实描述（此前 vendor_b 端被中文翻译覆盖） |
> | `input_materials` | `ai_models.input_materials` JSONB | 素材配额 `{"image": 1, "video": 0, "audio": 0}` |
> | `max_reference_images/videos/audios` | `ai_models.max_reference_*` | 各类型参考素材上限（此前 vendor_a 端缺失） |
> | `requires_input` | `ai_models.requires_input` | 是否需要输入素材（此前 vendor_a 端缺失） |
> | **`upstream_routes`** | `ai_model_upstream_routes` 表 | **新！**每条上游路由 `{resolution_key, priority_order, upstream_id}` |
> | **`variant_routes`** | 聚合家族中各 variant 的 `upstream_routes` | **新！**仅 HappyHorse 聚合 entry 出现，按 variant business_id 检索 |
>
> **协议 additive**：所有老字段保留，新增字段缺失时回退 `[]` / `null`，旧客户端无感。
> **性能**：批量查询走 `ai_model_dao.get_upstream_routes_batch([...])` 一次取齐所有 model 的路由，避免 N+1。
> **失败兜底**：DB 不可达时 `logger.warning` 退化为 `upstream_routes = []`，不影响 /api/v1/models 整体 200 返回。

## 概述

`GET /api/v1/models` 返回前端可用的图片模型、视频模型、音频模型清单。本文档覆盖三个层级的过滤/聚合能力:

1. **基础调用** — 不带任何查询参数,返回所有模型。
2. **PR-SmartRoute 四维过滤** — 按 `generation_type` / `resolution` / `aspect_ratio` / `ui_feature` 过滤。
3. **PR-SmartRoute-Family 家族聚合** — 把同名 `display_name` 的 HappyHorse 多 feature 行合并成一条 entry,并暴露 `variants` map 给前端做"特色功能 → 稳定 business_model_id"的二级路由。

> 前端无须切换调用方式。`/api/v1/models` 返回形态是 **additive** 的(老字段全部保留,只多 `variants` 字段),旧客户端无感。

---

## 1. 接口信息

```
GET /api/v1/models
```

| Query 参数 | 必填 | 说明 |
|---|---|---|
| `generation_type` | 否 | 多选用英文逗号分隔,值见下表 |
| `resolution` | 否 | `720P` / `1080P` / `2K` / `4K`(大小写不敏感,逗号多选) |
| `aspect_ratio` | 否 | `1:1` / `16:9` / `9:16` / `adaptive`(逗号多选) |
| `ui_feature` | 否 | UI 标签 kebab-case,如 `first-last-frame` / `ai-outfit`(逗号多选) |

四维之间是 AND 关系;维度内多值是 OR;全部不传 = 返回全量(向后兼容)。

### `generation_type` 取值

| 值 | 含义 | 典型模型 |
|---|---|---|
| `text_to_image` | 文生图 | Gemini 3.1 Flash Image / GPT Image 2 |
| `image_to_image` | 图生图 | (预留) |
| `image_edit` | 图片编辑 | GPT Image 2 |
| `text_to_video` | 文生视频 | Kling 3.0 / HappyHorse T2V |
| `image_to_video` | 图生视频 | GV 3.1 / HappyHorse I2V |
| `video_edit` | 视频编辑 | HappyHorse Video Edit |
| `reference_to_video` | 参考生视频 | HappyHorse R2V |
| `text_to_audio` | 文生音频 | TTS 1 HD |

> 实际生效: 后端先把 `generation_type` 与 row 的 `generation_type` 列精确匹配,再 fallback 到 `supported_features` 列表里包含任一目标值。

---

## 2. 响应结构

```jsonc
{
  "code": 200,
  "message": "success",
  "data": {
    "image_models":   [ /* image entry ... */ ],
    "video_models":   [ /* video entry ... */ ],
    "audio_models":   [ /* audio entry ... */ ],
    "voices":         [ /* voice entry ... */ ],
    "summary": {
      "total_image_models":  12,
      "total_video_models":  18,
      "total_audio_models":   1,
      "total_voices":         9,
      "vendors":            ["vendor_a", "vendor_b"],
      "filters": {
        "generation_type": "video_edit",
        "resolution":      null,
        "aspect_ratio":    null,
        "ui_feature":      null
      }
    }
  }
}
```

### 2.1 单条 entry 的完整字段(以 vendor_b 为例)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | DB `model_id`（聚合 entry 取首条） |
| `business_model_id` | string | 稳定的业务 ID（发请求时填这里）；聚合 entry 取 720P 优先 |
| `name` | string | 显示名（聚合 entry 是家族名，如 "HappyHorse 1.0"） |
| `display_name` | string | 同 `name`，冗余字段 |
| `description` | string | DB `ai_models.description` 真实文本（PR-A），无值时回退 generation_type 中文翻译 |
| `vendor` | string | `vendor_a` / `vendor_b` |
| `vendor_name` | string | "腾讯云" / "Token Switch" |
| `media_type` | string | `image` / `video` / `audio` |
| `generation_type` | string | 主特色功能（聚合 entry 是首条的 `generation_type`） |
| `requires_input` | bool | 是否需要输入文件 |
| `supported_features` | string[] | 支持的特色功能列表（聚合 entry 是并集） |
| `ui_features` | string[] | UI 标签 |
| `sound_mode` | string\|null | 音频模式 |
| `resolution` | string\|null | 主分辨率 |
| `supported_resolutions` | string[] | 支持的分辨率（聚合 entry 是并集） |
| `supported_ratios` / `supported_aspect_ratios` | string[] | 支持的比例 |
| `supported_durations` | number[] | 支持的时长（秒） |
| `supported_sizes` | string[] | 支持的尺寸（图） |
| `input_materials` | object | 各类型素材配额 `{"image": 1, "video": 0, "audio": 0}` |
| `max_reference_images` / `max_reference_videos` / `max_reference_audios` | number | 各类型参考素材上限 |
| `price_multiplier` | number | 价格倍率 |
| `price_tiers` | object | 价格表 `{"720P": {"silent": 0.5, "with_audio": 0.7}}` |
| `currency` | string | "CNY" |
| `max_width` / `max_height` / `max_duration` / `max_fps` | number\|null | 性能上限 |
| `is_enabled` | bool | 是否启用 |
| `status` | string | "active" |
| `supports_audio` | bool | 是否支持音频 |
| **`upstream_routes`** | object[] | **(PR-A)** 上游路由回退列表。每项含 `resolution_key` / `priority_order`  / `upstream_id`（priority=1 首选，≥2 是回退）。数据源为 `ai_model_upstream_routes` 表 |
| **`variants`** | object\|absent | **仅聚合 entry 出现**(PR-SmartRoute-Family,见 §4) |
| **`variant_routes`** | object\|absent | **仅聚合 entry 出现**（PR-A）。key=variant business_model_id，value=该变体的 upstream_routes 列表。`base.upstream_routes` 是 canonical 720P 那条的路由 |

### 2.2 vendor_a (腾讯云) entry 字段差异

vendor_a 行不参与家族聚合,所以 `variants` 字段不会出现在腾讯云 entry 上。其余字段一致。

---

## 3. 智能路由过滤示例

### 3.1 单值过滤

```http
GET /api/v1/models?generation_type=video_edit
```

返回所有 `generation_type == video_edit` 或 `supported_features ⊇ ["video_edit"]` 的 entry。

### 3.2 多值过滤(逗号 = OR)

```http
GET /api/v1/models?generation_type=image_to_video,video_edit&resolution=1080P
```

返回 `generation_type ∈ {image_to_video, video_edit}` 且 `supported_resolutions ⊇ ["1080P"]` 的 entry。

### 3.3 全四维

```http
GET /api/v1/models?generation_type=text_to_video&resolution=1080P&aspect_ratio=16:9&ui_feature=ai-template
```

四维之间 AND。

---

## 4. HappyHorse 家族聚合(PR-SmartRoute-Family)

### 4.1 解决的问题

HappyHorse 有 4 个特色功能:`i2v` / `t2v` / `r2v` / `video_edit`。原本在 `ai_models` 表中是 8 行(4 特色 × 2 分辨率),前端需要 8 个独立 entry。

聚合后:
- 前端看到 **1 个 "HappyHorse 1.0"** entry
- entry 上的 `supported_features` 是 4 个 feature 的并集
- entry 上新增 `variants` map,前端通过它查 `(feature, resolution) → business_model_id`
- 发请求时用 `business_model_id`(不是 entry 名)走原有 `_resolve_model_identifiers` 链路

### 4.2 聚合触发条件

后端按 `(_normalize_family_key)` 判断是否聚合:

```
key = (vendor, display_name)
聚合仅当:
  - vendor == 'vendor_b'
  - business_model_id 以 'happyhorse_1_0_' 开头
  - display_name 完全相同(管理员可改名生效)
```

现状下 HappyHorse 各行的 `display_name` 不同("HappyHorse 1.0 I2V 1080p" 等),聚合不触发,仍逐条返回——**完全向后兼容**。

启用聚合:在 admin 后台把 4 个功能 8 行的 `display_name` 统一改为 "HappyHorse 1.0",下次 `GET /api/v1/models` 即返回 1 条聚合 entry(无需重启)。

### 4.3 聚合 entry 的形态

把 8 行 HappyHorse `display_name` 统一改为 "HappyHorse 1.0" 后:

```json
{
  "id": "hh_i2v_720p",
  "business_model_id": "happyhorse_1_0_i2v_720p_vendor_b",
  "name": "HappyHorse 1.0",
  "display_name": "HappyHorse 1.0",
  "vendor": "vendor_b",
  "vendor_name": "Token Switch",
  "media_type": "video",
  "generation_type": "image_to_video",
  "requires_input": true,
  "supported_features": [
    "image_to_video",
    "text_to_video",
    "reference_to_video",
    "video_edit"
  ],
  "supported_resolutions": ["720P", "1080P"],
  "supported_ratios": ["adaptive"],
  "supported_durations": [5, 10],
  "variants": {
    "image_to_video": {
      "feature": "image_to_video",
      "business_model_ids": [
        "happyhorse_1_0_i2v_720p_vendor_b",
        "happyhorse_1_0_i2v_1080p_vendor_b"
      ],
      "business_model_ids_by_resolution": {
        "720P":  "happyhorse_1_0_i2v_720p_vendor_b",
        "1080P": "happyhorse_1_0_i2v_1080p_vendor_b"
      },
      "supported_resolutions": ["720P", "1080P"],
      "requires_input": true,
      "supports_audio": false,
      "price_tiers": {
        "720P":  {"silent": 0.5, "with_audio": 0.7},
        "1080P": {"silent": 1.0, "with_audio": 1.4},
        "default": {"silent": 0.5, "with_audio": 0.7}
      }
    },
    "text_to_video":     { /* 同上 t2v */ },
    "reference_to_video":{ /* 同上 r2v */ },
    "video_edit":        { /* 同上 video-edit */ }
  },
  "supports_audio": false,
  "is_enabled": true,
  "status": "active",
  "upstream_routes": [
    {"resolution_key": "720P",  "priority_order": 1, "upstream_id": "happyhorse-1.0-i2v-720p"},
    {"resolution_key": "1080P", "priority_order": 1, "upstream_id": "happyhorse-1.0-i2v-1080p"}
  ],
  "variant_routes": {
    "happyhorse_1_0_i2v_720p_vendor_b":  [
      {"resolution_key": "720P",  "priority_order": 1, "upstream_id": "happyhorse-1.0-i2v-720p"}
    ],
    "happyhorse_1_0_i2v_1080p_vendor_b": [
      {"resolution_key": "1080P", "priority_order": 1, "upstream_id": "happyhorse-1.0-i2v-1080p"}
    ],
    "happyhorse_1_0_t2v_720p_vendor_b":  [
      {"resolution_key": "720P",  "priority_order": 1, "upstream_id": "happyhorse-1.0-t2v-720p"}
    ]
  }
}
```

### 4.4 前端如何用 `variants`

```js
// 1) 用户从模型列表选 "HappyHorse 1.0"
const entry = videoModels.find(m => m.name === "HappyHorse 1.0");

// 2) 用户选特色功能 + 分辨率
const feature    = "video_edit";   // i2v / t2v / r2v / video_edit
const resolution = "1080P";

// 3) 取出稳定的 business_model_id
const businessId = entry.variants[feature]
                         .business_model_ids_by_resolution[resolution];
//    → "happyhorse_1_0_video_edit_1080p_vendor_b"

// 4) 发请求 —— 与旧的"直接发 business_id"路径完全一致
fetch("/api/v1/generate", {
  method: "POST",
  body: JSON.stringify({
    output_type: "video",
    model: businessId,                  // ★ 关键:用 business_id,不是 entry 名
    feature: feature,                  // i2v / t2v / r2v / video_edit
    prompt:  "...",
    parameters: {
      resolution: resolution,           // "1080P"
      duration: 5,
      ratio: "16:9"
    },
    input_files: [...],
    vendor: "vendor_b"
  })
});
```

> **重要**: `POST /api/v1/generate` 的 `model` 字段必须填 **`business_model_id`**,而不是 `name` / `display_name`。这是为了兼容旧逻辑(`_resolve_model_identifiers` 接 business_model_id)。

### 4.5 过滤对聚合 entry 的影响

`GET /api/v1/models?generation_type=video_edit` 命中聚合 entry 后,会返回 1 条 `HappyHorse 1.0`(而非 4 条不同分辨率/功能的 HappyHorse 行)。

`?generation_type=image_to_video,video_edit` 也是返回 **1 条**(聚合 entry 同时支持 4 个 feature,任一匹配即返回)。

---

## 5. 价格估算接口(`/api/v1/estimate-price`)

> **不受 PR-SmartRoute-Family 影响**——价格估算接收 `business_model_id`,直接命中 per-feature 行计算,不走聚合。

```http
POST /api/v1/estimate-price
Content-Type: application/json

{
  "output_type": "video",
  "model": "happyhorse_1_0_i2v_1080p_vendor_b",  // ★ business_id
  "feature": "image_to_video",
  "parameters": { "resolution": "1080P", "duration": 5, "with_audio": true }
}
```

返回 `breakdown.business_model_id = "happyhorse_1_0_i2v_1080p_vendor_b"` 且 `breakdown.resolution = "1080P"` 的精确价格。

---

## 6. 兼容性矩阵

| 客户端行为 | 是否兼容 | 说明 |
|---|---|---|
| `GET /api/v1/models` 不带参数 | ✅ 完全兼容 | 老格式返回 |
| `GET /api/v1/models` 用 4 维过滤 | ✅ 完全兼容 | 老 filter 逻辑保持 |
| `POST /api/v1/generate` 用 `model=business_id` | ✅ 完全兼容 | 这是 **唯一推荐** 写法 |
| `POST /api/v1/generate` 用 `model=display_name` | ⚠️ 部分兼容 | `_resolve_model_identifiers` 仍尝试反查 display_name,不一定命中 |
| 前端用 `variants` 路由 | ✅ 新能力 | 让前端一个 entry 服务多个 feature |

---

## 7. 测试

### 烟测

```bash
python test_smart_route_family_smoke.py
# 预期: PR-SmartRoute-Family Smoke: 37/37 通过
```

### 回归

```bash
python test_pr4_6_smoke.py
# 预期: PR-4.6 结果: 53/53 通过

python test_pr4_13_smoke.py
# 预期: PR-4.13 Smoke: 40/40 通过

python test_pr_a_smoke.py
# 预期: PR-A Smoke: 38/38 通过
```

### 端到端 (PR-A 验证)

```bash
# 1) 启动服务
python run.py

# 2) 随便挑一个 vendor_b 视频模型 (e.g. HappyHorse), 应能看到 upstream_routes 全列表
curl -s "http://localhost:8003/api/v1/models" \
  | jq '.data.video_models[] | select(.name == "HappyHorse 1.0") | {
      business_model_id, upstream_routes, variant_routes
    }'

# 3) 单上游模型 (e.g. gpt-image-2) 应该是 [(all, 1, gpt-image-2)]
curl -s "http://localhost:8003/api/v1/models" \
  | jq '.data.image_models[] | select(.business_model_id == "gpt_image_2_vendor_b") | {
      description, upstream_routes, input_materials, max_reference_images
    }'

# 4) 腾讯云模型应拿到 max_reference_* 和 requires_input
curl -s "http://localhost:8003/api/v1/models" \
  | jq '.data.image_models[] | select(.vendor == "vendor_a") | {
      name, max_reference_images, requires_input
    }' | head -40
```

---

```bash
# 1) 启动服务
python run.py

# 2) 拿模型列表(应返回全量,HappyHorse 各 feature 仍按行)
curl -s "http://localhost:8003/api/v1/models" | jq '.data.summary'

# 3) 在 admin 后台把 HappyHorse 各行 display_name 统一改为 "HappyHorse 1.0"
#    (model_helper.invalidate_cache() 后立刻生效)

# 4) 再次请求 —— 应该看到 video_models 只有 1 条 HappyHorse 1.0
curl -s "http://localhost:8003/api/v1/models?vendor=vendor_b" \
  | jq '.data.video_models[] | select(.name == "HappyHorse 1.0") | {variants: .variants}'
```

---

## 8. 更新日志

- **2026-08-20 PR-A**: 完整字段透出 + 上游路由表暴露。
  - `description` 改为取 DB 真值（此前 vendor_b 端被中文翻译覆盖），无值时回退 generation_type 中文翻译。
  - vendor_a 端补 `max_reference_images/videos/audios` + `requires_input` + `input_materials`（此前 vendor_b 端已有）。
  - 每条 entry 新增 `upstream_routes`，数据源 `ai_model_upstream_routes` 表（PR-4.13 路由表）。
  - 聚合 entry 新增 `variant_routes` map（key=variant business_model_id, value=该变体的 upstream_routes）。
  - 0 DB schema 变更,批量查询走 `ai_model_dao.get_upstream_routes_batch([...])` 避免 N+1。
  - 失败兜底:`routes_map = {}` + `logger.warning`,`/api/v1/models` 仍 200 返回。
  - 新增 [test_pr_a_smoke.py](../test_pr_a_smoke.py) 38 项检查, 纯 import + `inspect.getsource()`, 不依赖 DB / 服务。

- **2026-08-20 PR-SmartRoute-Family**: 新增家族聚合能力。
  - 仅当 `business_model_id` 以 `happyhorse_1_0_` 开头且 `display_name` 完全相同时聚合。
  - 聚合 entry 新增 `variants` map;老 entry 不变。
  - 默认关闭聚合(因默认 display_name 不同),管理员改名后启用。
  - 0 DB schema 变更,0 路由表变更,纯 catalog 层。