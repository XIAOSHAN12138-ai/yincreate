# 图片生成 API 文档

> 涵盖 **vendor_b (Token Switch)** 下所有图片生成相关的接口与参数,包括文生图、图生图、多图参考、GPT 图像模型编辑、千问/万象等。
> vendor_a (腾讯云) 的图生图请参见 [IMAGE_TO_VIDEO_GUIDE.md](IMAGE_TO_VIDEO_GUIDE.md) (含图生视频入口) 以及 vendor_a.py 的图生图逻辑。

> ## 📌 PR-4.9（2026-08-12）：模型 ID 三层语义
>
> 后端现在区分三种模型标识：
>
> | 标识 | 含义 | 示例 |
> |---|---|---|
> | `business_model_id`（业务 ID） | 前端永远见到的稳定 ID | `gpt_image_2_tokenswitch` |
> | `upstream_model_id`（上游 ID） | 实际调上游 API 的私有 ID | `gp-im-2` |
> | `display_name`（展示名） | 前端展示名，写入 DB | `gpt image 2` |
>
> **前端调用规则**：请求 `model` 字段继续填业务 ID（如 `gpt_image_2_tokenswitch`），后端会自动解析成上游 ID 调 token switch。后端在响应中（账单流水、任务详情、素材库）的 `model` 相关字段返回的是 **`display_name`**（展示名），可直接展示给用户。
>
> 详见 [BILLING_API.md](BILLING_API.md) 和 [MEDIA_LIBRARY_API.md](MEDIA_LIBRARY_API.md) 顶部的 PR-4.9 说明。

> ## 📌 PR-A（2026-08-20）：`/api/v1/models` 字段补齐
>
> 每个 image entry 额外带 `upstream_routes` / `description` / `input_materials` / `max_reference_images/videos/audios` / `requires_input` 等字段。
> 多图参考 / 图片编辑类模型（如 GPT Image 2）的 `max_reference_images` 与 `input_materials.image` 配额可直接读 entry 决定 UI 上传组件上限。
> 详见 [`MODELS_CATALOG_SMART_ROUTE.md` §2.1](MODELS_CATALOG_SMART_ROUTE.md)。

---

## 0. 总览

| 模型 | endpoint 前缀 | 风格 | 文生图 | 图生图 | 多图参考 | mask 编辑 |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-image-1.5` / `gpt-image-1` / `chatgpt-image-latest` | `openai-images-*` | OpenAI 风格 | ✅ | ✅ | ✅ (≤16) | ✅ |
| `dall-e-2` / `dall-e-3` | `openai-images-*` | OpenAI 旧风格 | ✅ | ✅ (单张) | ❌ | ❌ |
| 千问 (qwen-vl-max 等) | `qwen_images:*` | Anthropic 风格 | ✅ | ✅ | ✅ | ❌ |
| 万象 (wan2.1-t2i-turbo 等) | `wan_images:*` | Anthropic 风格 | ✅ | ✅ | ✅ | ❌ |

> 📌 **音频能力(`supports_audio`)是视频模型的字段**,图片生成不涉及。前端应根据该字段决定是否显示"声音"开关。详见 [ADMIN_MODELS_API.md §2.4](ADMIN_MODELS_API.md)。

---

## 1. 入口

图片生成走**统一生成接口** `POST /api/v1/generate`(`output_type=image`),与视频生成同入口。

请求体参考 [app/models_frontend.py](FRONTEND_API_V3.md) 的 `FrontendUnifiedRequest`:

```json
{
  "output_type": "image",
  "model": "gpt-image-1.5",
  "prompt": "一只在窗台晒太阳的橘猫,水彩风格",
  "parameters": {
    "ratio": "1:1",
    "resolution": "1080P",
    "count": 1
  },
  "input_files": [],
  "vendor": "vendor_b"
}
```

`model` 字段填你想用的 model_id(`gpt-image-1.5`、`qwen-vl-max`、`wan2.1-t2i-turbo` 等)。

---

## 2. parameters 公共字段

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `ratio` | string | `16:9` | `1:1`、`16:9`、`9:16`、`4:3`、`3:4` 等 |
| `resolution` | string | `1080P` | `480P` / `720P` / `1080P` / `2K` / `4K`,后端会换算成像素 |
| `count` | int | `1` | 生成张数,GPT 模型 1-10 |
| `reference_image` | string (URL or base64) | – | 单张参考图(图生图) |
| `references` | array | – | 多张参考图(图生图 / 多图参考,优先于 `reference_image`) |
| `input_files` | array | – | 前端统一格式 `[{type:"image", url:".."}, ..]`,与 `references` 等价 |

---

## 3. GPT 图像模型专属字段 (`gpt-image-*`, `chatgpt-image-*`)

按 OpenAI 官方 [`/v1/images/edits`](https://platform.openai.com/docs/api-reference/images/createEdit) 与 [`/v1/images/generations`](https://platform.openai.com/docs/api-reference/images/create) 实现。后端会自动识别模型前缀,透传以下字段:

| 字段 | 类型 | 适用端点 | 说明 |
| --- | --- | --- | --- |
| `images` | `[{image_url, file_id}]` | `/v1/images/edits` | 最多 16 张参考图(GPT 模型) |
| `mask` | `{image_url, file_id}` | `/v1/images/edits` | 编辑遮罩,二选一 |
| `background` | `transparent` / `opaque` / `auto` | 两端点 | 输出背景(GPT 模型) |
| `input_fidelity` | `high` / `low` | `/v1/images/edits` | 对原图的保真度(GPT 模型) |
| `moderation` | `low` / `auto` | 两端点 | 内容审核级别 |
| `quality` | `low` / `medium` / `high` / `auto` | 两端点 | 输出质量 |
| `output_format` | `png` / `jpeg` / `webp` | 两端点 | 输出格式(GPT 模型) |
| `output_compression` | int (0-100) | 两端点 | jpeg/webp 压缩率 |
| `partial_images` | int (0-3) | 两端点 | 流式返回中间图数量 |
| `stream` | bool | 两端点 | 是否流式返回 |
| `user` | string | 两端点 | 用户标识,监控滥用 |

### 3.1 文生图示例

```json
{
  "output_type": "image",
  "model": "gpt-image-1.5",
  "prompt": "一只在窗台晒太阳的橘猫,水彩风格",
  "parameters": {
    "ratio": "1:1",
    "resolution": "1024x1024",
    "count": 1,
    "quality": "high",
    "output_format": "png",
    "background": "transparent",
    "moderation": "low"
  },
  "vendor": "vendor_b"
}
```

### 3.2 图生图(单张参考)

```json
{
  "output_type": "image",
  "model": "gpt-image-1.5",
  "prompt": "把背景换成海滩,日落色调",
  "parameters": {
    "reference_image": "https://example.com/cat.jpg",
    "ratio": "1:1",
    "resolution": "1024x1024",
    "input_fidelity": "high",
    "quality": "high",
    "output_format": "png"
  },
  "vendor": "vendor_b"
}
```

### 3.3 多图参考(最多 16 张)

```json
{
  "output_type": "image",
  "model": "gpt-image-1.5",
  "prompt": "把这四个物品组合成一个精美的礼品篮",
  "parameters": {
    "references": [
      {"type": "image", "url": "https://example.com/a.jpg"},
      {"type": "image", "url": "https://example.com/b.jpg"},
      {"type": "image", "url": "https://example.com/c.jpg"},
      {"type": "image", "url": "https://example.com/d.jpg"}
    ],
    "n": 2,
    "size": "1024x1024",
    "quality": "high"
  },
  "vendor": "vendor_b"
}
```

### 3.4 mask 编辑

```json
{
  "output_type": "image",
  "model": "gpt-image-1.5",
  "prompt": "把遮罩区域改成蓝天白云",
  "parameters": {
    "reference_image": "https://example.com/photo.jpg",
    "mask": {"image_url": "https://example.com/mask.png"},
    "size": "1024x1024"
  },
  "vendor": "vendor_b"
}
```

### 3.5 base64 图片

`reference_image` / `references[].url` / `mask.image_url` 都接受 **base64 data URI**:

```json
{
  "reference_image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

注意:base64 data URI 的图片会被前端在调用前上传到 VOD(由 `sync_generation_service._process_base64_inputs` 自动处理),生成请求里带的会是 VOD 公网 URL,**不是 base64**。

---

## 4. 千问 / 万象 (`qwen_images:*` / `wan_images:*`)

按阿里云百炼 [Anthropic 图像 API](https://help.aliyun.com/zh/model-studio/developer-reference/anthropic-images-api) 实现。payload 结构与 OpenAI 完全不同:

```json
{
  "model": "<model_id>",
  "input": {
    "messages": [
      {
        "role": "user",
        "content": [
          {"text": "<prompt>"},
          {"image": "<image_url>"}
        ]
      }
    ]
  },
  "parameters": {
    "n": 1,
    "watermark": false,
    "size": "1024*1024"
  }
}
```

### 4.1 字段映射

| 前端 parameters 字段 | 透传到上游 |
| --- | --- |
| `prompt` | `input.messages[].content[].text` |
| `reference_image` / `references[]` | `input.messages[].content[].image` |
| `count` 或 `n` | `parameters.n` |
| `size`(可选) | `parameters.size` |
| `watermark`(可选) | `parameters.watermark` |

**`size` 格式:用 `*` 不是 `x`**(例如 `"2048*2048"`)。后端会自动把 `WxH` 转成 `W*H`。

### 4.2 文生图示例

```json
{
  "output_type": "image",
  "model": "qwen-vl-max",
  "prompt": "海边的日落,水彩画风格",
  "parameters": {
    "ratio": "16:9",
    "resolution": "1080P",
    "size": "1280*720",
    "watermark": false,
    "n": 1
  },
  "vendor": "vendor_b"
}
```

### 4.3 图生图示例

```json
{
  "output_type": "image",
  "model": "wan2.1-t2i-turbo",
  "prompt": "把这张图改成一幅中国传统水墨画,远山近水",
  "parameters": {
    "reference_image": "https://example.com/photo.jpg",
    "ratio": "1:1",
    "resolution": "1024x1024",
    "size": "1024*1024"
  },
  "vendor": "vendor_b"
}
```

---

## 5. responses 返回结构

图片生成(同步)成功后,后端把结果包装成统一结构:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "task_id": "task_xxx",
    "status": "completed",
    "results": [
      {
        "url": "https://<vod-cdn>/xxx.png",
        "metadata": {
          "width": 1024,
          "height": 1024,
          "size": 1234567
        }
      }
    ]
  }
}
```

### 5.1 图片 URL 处理流程

1. 上游返回 `data[].b64_json` 或 `data[].url`
2. 后端 `_extract_openai_image_urls` 统一提取
3. 如果是 base64,上传到 VOD,返回稳定的 CDN URL
4. 前端拿到 `results[].url`,直接渲染或下载

### 5.2 异步模式

如果上游是异步任务(返回 `task_id`),前端走 `?sync=false`,然后轮询 `GET /api/v1/tasks/{task_id}/status`。

---

## 6. 错误码

| HTTP | `code` | 含义 | 建议 |
| --- | --- | --- | --- |
| 400 | `INVALID_PARAM` | prompt 为空 / 参数非法 | 检查 prompt 与 parameters |
| 400 | `INVALID_PRICE_TIERS` | price_tiers 格式错 | 见 [ADMIN_MODELS_API §2.3](ADMIN_MODELS_API.md) |
| 403 | `FORBIDDEN` | 非管理员调用受限接口 | – |
| 404 | `MODEL_NOT_FOUND` | model_id 不存在 | 检查 `GET /api/v1/models` |
| 409 | `FOREIGN_KEY_BLOCKED` | 硬删模型被 FK 阻止 | 先迁移任务 |
| 500 | `GENERATION_ERROR` | 上游报错(透传原始错误) | 看 message 决定重试或换模型 |
| 503 | `DB_UNAVAILABLE` | 数据库不可用 | 等待恢复 |

---

## 7. 常见问题

### 7.1 "Invalid 'prompt': empty string"

前端 `prompt` 是空字符串。**图生图必须给提示词**(描述要怎么编辑)。可以前端做必填校验,或后端给兜底 prompt。

### 7.2 GPT 图像模型返回 "images must be a file"

Token Switch proxy 可能不支持 GPT 图像模型的新格式(`images: [{image_url}]`)。**后端会自动降级到旧格式**(`image: 单字符串`),重试一次。如果还失败,联系服务商升级。

### 7.3 size 格式错误

- OpenAI/GPT: `WxH`(字母 x),如 `"1024x1024"`
- Anthropic/千问/万象: `W*H`(星号),如 `"1024*1024"`

后端会自动转换,但**前端直接传 `size` 时要按对应格式**。

### 7.4 死循环:不断上传图片

如果 `generate` 接口一直失败,**前端不要无限重试整个流程**(包含重新上传)。建议:
- 后端返回明确错误码,前端在错误码是 `INVALID_PARAM` / `MODEL_NOT_FOUND` 时不重试
- 改前端逻辑:**先确认 generate 成功返回 task_id 后,再处理图片**,或者把"上传图片"和"提交生成"合并成一个事务

### 7.5 多张参考图被截断

GPT 图像模型最多 16 张参考图。超过 16 张会被后端丢弃多余部分(保留前 16 张)。

### 7.6 base64 大小限制

OpenAI 接受 base64,**但**总请求体大小有限制(通常 4MB)。如果参考图很大,建议前端压缩到 1024px 以下再 base64 编码,或先用 `/api/v1/upload` 上传拿到 VOD URL 后传 URL。

---

## 8. 附录:请求/响应字段总表

### 8.1 GPT 图像模型完整 parameters

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `ratio` | string | 否 | `16:9` | 比例 |
| `resolution` | string | 否 | `1080P` | 分辨率 |
| `size` | string | 否 | – | 直接指定 `WxH`,与 ratio/resolution 互斥 |
| `count` / `n` | int | 否 | `1` | 张数 |
| `reference_image` | string | – | – | 单张参考图 |
| `references` | array | – | – | 多张参考图(`[{type, url}, ..]`) |
| `input_files` | array | – | – | 前端统一格式,与 `references` 等价 |
| `mask` | string / dict | – | – | 编辑遮罩 |
| `background` | enum | – | – | `transparent` / `opaque` / `auto` |
| `input_fidelity` | enum | – | – | `high` / `low` |
| `moderation` | enum | – | – | `low` / `auto` |
| `quality` | enum | – | – | `low` / `medium` / `high` / `auto` |
| `output_format` | enum | – | – | `png` / `jpeg` / `webp` |
| `output_compression` | int | – | – | 0-100 |
| `partial_images` | int | – | – | 0-3 |
| `stream` | bool | – | – | – |
| `user` | string | – | – | 用户标识 |

### 8.2 Anthropic/千问/万象完整 parameters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ratio` | string | 比例(后端换算成 size) |
| `resolution` | string | 分辨率 |
| `size` | string | 直接传 `"W*H"`,如 `"1024*1024"` |
| `n` / `count` | int | 张数 |
| `watermark` | bool | 是否水印 |
| `reference_image` / `references` / `input_files` | – | 参考图(同 GPT 模型) |

---

## 9. 更新日志

- **2026-07-01**:
  - 新增 Anthropic / Wan 图片模型(handler: `_generate_image_qwen` in `vendor_b.py`)
  - 升级 GPT 图像模型支持新格式 `images: [{image_url}]`、多图参考(≤16)、mask 编辑、新增字段透传
  - 自动降级:GPT 图像模型新格式被 proxy 拒绝时,自动回退到 dall-e 风格单 `image` 字符串
- **2026-07-01 前**:旧版本只支持单张 `image= url` (dall-e-2/3 风格)