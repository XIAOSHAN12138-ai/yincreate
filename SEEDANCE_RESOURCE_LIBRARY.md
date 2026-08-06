# Seedance 2.0 素材库资源引用指南

> 本文档面向**前端**集成,说明 Seedance 2.0 视频生成接口在"含人脸参考素材"场景下,如何从我方素材库引用资源。

---

## 1. 背景:为什么需要走"素材库"?

Seedance 2.0 系列模型(`doubao-seedance-2-0-260128` / `doubao-seedance-2-0-fast-260128`,走 Token Switch / neolink)不允许直接上传**含人脸**的参考图/视频。

为了合规使用人像素材,平台推出了**素材库授权**方案:
- 用户先把人像素材上传到我方素材库(等同一次普通上传)
- Seedance 调用时,引用素材库里的素材(用 `media_id`)
- 后端自动把素材注册到 Neolink 资源库,拿到 `tkres_xxx` 形式的资源 UUID
- 用 `Asset://tkres_xxx` 协议提交给 Seedance

> **注意**:`"seedance快捷通道"` 分组的 API Key **不需要**走资源库,直接传 http URL 即可。本文档针对的是非快捷通道(当前 `.env` 中 `VENDOR_B_API_KEY` 对应的通道)。

---

## 2. 前端怎么改

### 之前:直接传 http URL

```jsonc
// ❌ 旧写法:直接传 URL
{
  "model": "doubao-seedance-2-0-260128",
  "prompt": "让图片1中的人做视频1的蛋糕",
  "parameters": {
    "duration": 11,
    "ratio": "16:9",
    "references": [
      {
        "url": "https://vod.xxx/my-face.jpg",  // ← 旧字段
        "type": "image",
        "role": "reference_image"
      },
      {
        "url": "https://vod.xxx/reference-video.mp4",
        "type": "video",
        "role": "reference_video"
      }
    ]
  }
}
```

直接传 `url` 在 **非人脸素材** 时仍然可用,但**含人脸**时会被 Seedance 拒掉。

### 之后:改成传 `media_id`

```jsonc
// ✅ 新写法:用户从素材库选素材,前端传 media_id
{
  "model": "doubao-seedance-2-0-260128",
  "prompt": "让图片1中的人做视频1的蛋糕",
  "parameters": {
    "duration": 11,
    "ratio": "16:9",
    "references": [
      {
        "media_id": "MEDIA-IMG-002",     // ← 新字段:我方素材库的 media_id
        "type": "image",
        "role": "reference_image"
      },
      {
        "media_id": "MEDIA-VID-005",     // ← 视频素材同理
        "type": "video",
        "role": "reference_video"
      }
    ]
  }
}
```

前端的关键变化:
1. 用户在素材库管理界面**勾选素材**(不再让用户粘贴 URL)
2. 请求体 `references[]` 元素新增 `media_id` 字段
3. `url` / `image_url` / `video_url` 字段**可保留也可去掉**,后端会做兼容:
   - `media_id` + `url` 都有 → 优先用 `media_id`,忽略 `url`
   - 只有 `media_id` → 走素材库资源化路径
   - 只有 `url` → 走旧路径(http URL 直接提交,适合非人脸)

---

## 3. references[] 元素结构

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---|---|
| `media_id` | string | **推荐必填**(人脸场景) | 我方素材库中的 `media_id`,形如 `MEDIA-IMG-002` |
| `url` | string | 兼容旧字段 | 如果传了,会被忽略;保留不影响后端 |
| `image_url` / `video_url` / `audio_url` | object | 兼容旧字段 | 同上 |
| `type` | string | ✅ 必填 | `image` / `video` / `audio` |
| `role` | string | 推荐 | `reference_image` / `reference_video` / `reference_audio` / `first_frame` / `last_frame`,默认按 `type` 推 |

完整枚举与角色映射见后端 [app/vendors/vendor_b.py](app/vendors/vendor_b.py) 中的 `_SEEDANCE_ROLES`。

---

## 4. 端到端流程

```
┌──────────────────────────────────────────────────────────────────────┐
│ 用户在前端:                                                           │
│   1) 打开素材库,选一张人像图 → 点击"用于 Seedance"                       │
│   2) 选模型 doubao-seedance-2-0-260128,填 prompt,点"生成"              │
│   3) 前端调用 POST /api/v1/generate/video,references[] 含 media_id      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ 后端 vendor_b._generate_video_seedance:                                │
│   4) 遍历 references[] 中所有带 media_id 的元素                        │
│   5) 调用 SeedanceResourceService.ensure_seedance_resource(media_id) │
│      ├─ 查 media_library.seedance_resource_uuid(已注册?)                │
│      ├─ 没有 → 调 Neolink POST /api/model-resources 注册              │
│      ├─ 轮询 GET /api/model-resources/{uuid} 直到 status=1(可用)     │
│      ├─ 写回 media_library.seedance_resource_uuid                      │
│      └─ 返回 "Asset://tkres_xxx"                                       │
│   6) 改写 references 元素:                                             │
│      {"media_id": "MEDIA-IMG-002", "type": "image", "role": "..."}    │
│      →  {"type": "image", "role": "...",                               │
│          "image_url": {"url": "Asset://tkres_xxx"}}                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Neolink 上游:                                                          │
│   收到 Asset://tkres_xxx,识别为已授权素材,正常生成                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. 性能 & 缓存说明

- **首次调用**(media_id 还没注册过):需要 1-30s 等 Neolink 同步人像资源
- **第二次以后**(同一 media_id):直接命中 `media_library.seedance_resource_uuid` 字段,**毫秒级返回**
- 进程重启后第一次调用也会命中字段(已持久化),不会重新注册

也就是说:**只要 media_id 注册过一次,后续永远秒级**。

---

## 6. 边界 & 错误处理

### 6.1 媒体 ID 不存在

如果传的 `media_id` 在我方素材库查不到:
- 后端 log: `[SeedanceResource] media_id 不存在,跳过资源化: MEDIA-XXX`
- 该 ref **保留原样**(`url` 还在就走 URL,没有就忽略)
- Seedance 上游如果因此报缺图,**错误信息透传到前端**

### 6.2 Neolink 资源同步失败

如果 Neolink 同步超 30s 或状态变 `failed`:
- 后端 log: `[SeedanceResource] Neolink 资源同步失败: <reason>`
- 整次 Seedance 调用**被标记为失败**,前端拿到 5xx

### 6.3 用户绕过素材库直接传 URL

- `references[]` 元素**没有 `media_id` 字段**时,后端原样透传 `url` 给 Seedance
- 这种情况**适用于非人脸素材**(风景、产品图),以及"seedance 快捷通道"分组
- 前端做用户引导:**人脸素材必须先入库再用**

### 6.4 删除素材的影响

用户在素材库删除素材 → `status='deleted'`。
- `media_library.seedance_resource_uuid` 字段**不会自动清空**
- 已删除素材的 `media_id` 在 `ensure_seedance_resource` 里查不到行,**走"边界 6.1"路径**,原样跳过
- 如果前端强行用一个已删除的 media_id,**等价于没传**,Seedance 报缺图

---

## 7. UI 集成建议

### 7.1 在素材库列表加个"用于 Seedance"按钮

```vue
<el-button
  v-if="row.media_type === 'image' || row.media_type === 'video'"
  size="small"
  @click="$emit('select-for-seedance', row)"
>
  用于 Seedance
</el-button>
```

### 7.2 在 Seedance 生成页加"引用素材库"面板

参考模型支持的素材类型:

| 模型 | 可引用 image | 可引用 video | 可引用 audio |
|---|---|---|---|
| `doubao-seedance-2-0-260128` | ✅ | ✅ | ✅ |
| `doubao-seedance-2-0-fast-260128` | ✅ | ✅ | ✅ |

UI 可以一次性把用户选中的 `media_id[]` 渲染成 chip 列表,带删除按钮。

### 7.3 错误的用户提示

- 选了"已删除"素材:前端拿到的响应就是普通的 502/422,业务侧把"素材不存在"作为关键字搜错误码:
  ```text
  [SeedanceResource] media_id 不存在,跳过资源化
  ```
- 同步超时:前端可以弹"资源同步超时,请稍后再试",因为 30s 是真实的上游延迟

---

## 8. 调试 / 后端日志关键字

后端控制台出现以下日志,说明资源化路径已经触发:

```text
[SeedanceResource] 注册资源到 Neolink: media_id=...
[SeedanceResource] poll #1 uuid=tkres_xxx status=2 message=''
[SeedanceResource] poll #3 uuid=tkres_xxx status=1 message=''
[SeedanceResource] ✅ 资源注册成功: MEDIA-XXX -> Asset://tkres_xxx
```

第二次同 media_id 调用:

```text
[SeedanceResource] (无日志,直接从 media_library.seedance_resource_uuid 字段命中)
```

---

## 9. FAQ

**Q:用户第一次上传了一张人脸图,再上传一次(同一张图,内容相同),media_id 不同,会注册两次 tkres 吗?**

A: 会的。每个 media_id 是独立的——只要前端把它们当成不同素材分别勾选,后端就会为每条素材分别注册。这是符合"每个素材独立授权"的语义的。如果业务要"URL 维度复用"避免重复,需要新加一张 URL 全局去重表,目前没做。

**Q:从素材库选素材会额外扣费吗?**

A: 不会。注册 `tkres_xxx` 只是把素材授权给 Seedance,不消耗积分。生成视频时正常按 `model_id` + `resolution` 扣费。

**Q:同一个 media_id 在素材库被软删后恢复,UUID 还在吗?**

A: 在。`media_library.seedance_resource_uuid` 字段不会被软删清空。

**Q:换了 `.env` 的 `VENDOR_B_API_KEY` 切到 seedance 快捷通道,这段代码会受影响吗?**

A: 不会,只要保留 `SEEDANCE_RESOURCE_LIBRARY_ENABLED=true`(默认),代码会继续走资源化路径;但**快捷通道场景下应该改成 `false`**——因为快捷通道自动处理人像上传,无需手动资源化。

---

## 10. 相关文件

- 后端服务: [app/services/seedance_resource_service.py](../app/services/seedance_resource_service.py)
- 后端客户端: [app/vendors/seedance_resource_client.py](../app/vendors/seedance_resource_client.py)
- 集成点: [app/vendors/vendor_b.py:728](../app/vendors/vendor_b.py#L728) (`_generate_video_seedance`)
- 数据库字段: [database/sql/schema/35_media_library_seedance_uuid.sql](../database/sql/schema/35_media_library_seedance_uuid.sql)
- 开关: `SEEDANCE_RESOURCE_LIBRARY_ENABLED` (默认 `true`,在 `.env` 配置)