# SZG-V 后端对接文档

## 基础信息

| 项目 | 值 |
|------|-----|
| 基础URL | `http://192.168.31.243:8003/api/v1` |
| 认证方式 | Bearer Token（Header: `Authorization: Bearer <token>`） |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |

---

## 一、已有接口

### 1.1 获取模型列表

```
GET /models
```

**响应：**
```json
{
  "code": 200,
  "data": [
    {
      "id": "wan2.1",
      "name": "Wan2.1 视频生成",
      "type": "video",
      "vendor": "vendor_a",
      "features": ["text_to_video", "global_reference", "multi_reference"]
    }
  ]
}
```

### 1.2 生成内容

```
POST /generate?sync=true
```

**请求体：**
```json
{
  "output_type": "video",
  "model": "wan2.1",
  "vendor": "vendor_a",
  "feature": "multi_reference",
  "prompt": "让 <<<image_1>>> 和 <<<video_1>>> 一起跳舞",
  "parameters": {
    "resolution": "1080P",
    "duration": 5,
    "ratio": "16:9",
    "sound": false
  },
  "input_files": [
    {
      "type": "image",
      "url": "https://cdn.example.com/img1.png",
      "purpose": "reference",
      "object_id": "image_1"
    },
    {
      "type": "video",
      "url": "https://cdn.example.com/vid1.mp4",
      "purpose": "reference",
      "object_id": "video_1"
    }
  ]
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| output_type | string | 是 | 生成类型：`image` / `video` / `digital_human` |
| model | string | 是 | 模型ID |
| vendor | string | 是 | 供应商：`vendor_a` / `vendor_b` |
| feature | string | 是 | 功能：`text_to_image` / `text_to_video` / `image_reference` / `global_reference` / `multi_reference` / `digital_human` |
| prompt | string | 是 | 提示词，引用素材用 `<<<object_id>>>` 标记 |
| parameters | object | 是 | 生成参数（见下表） |
| input_files | array | 否 | 引用素材列表。元素支持 `media_id`（素材库引用，Seedance 人脸场景推荐）或 `url`（直接传 URL，非人脸场景） |

> **Seedance 2.0 素材库资源引用**：含人脸的参考图/视频不能直接传 `url`，必须先上传到素材库再通过 `media_id` 引用。后端自动注册到 Neolink 资源库（`Asset://tkres_xxx`）。`media_id` 和 `url` 同时存在时优先用 `media_id`。详见 [`UNIFIED_VIDEO_API.md`](../UNIFIED_VIDEO_API.md) §4.2。

**parameters 字段（按 output_type 区分）：**

| output_type | 参数 | 类型 | 说明 |
|-------------|------|------|------|
| image | resolution | string | 分辨率：`720P` / `1080P` / `2K` / `4K` |
| image | ratio | string | 比例：`1:1` / `16:9` / `9:16` / `4:3` / `3:4` |
| image | count | int | 生成数量（固定1） |
| video | resolution | string | 同上 |
| video | duration | int | 时长（5-15秒） |
| video | ratio | string | 同上 |
| video | sound | bool | 是否含音频 |
| digital_human | voice_id | string | 语音模型ID |
| digital_human | action_description | string | 动作描述 |

**响应：**
```json
{
  "code": 200,
  "data": {
    "task_id": "task_abc123",
    "type": "video",
    "status": "completed",
    "progress": 100,
    "result": {
      "videos": [
        { "url": "https://cdn.example.com/result1.mp4", "duration": 5 }
      ],
      "images": [
        { "url": "https://cdn.example.com/result1.png" }
      ]
    }
  }
}
```

---

## 二、新增接口（对话管理）

### 2.1 创建对话

```
POST /conversations
```

用户首次生成内容时自动创建对话。

**请求体：**
```json
{
  "title": "让图片1和视频1一起跳舞",
  "type": "video"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": "conv_1717488000000",
    "title": "让图片1和视频1一起跳舞",
    "type": "video",
    "user_id": "user_123",
    "created_at": "2025-06-04T10:00:00Z",
    "updated_at": "2025-06-04T10:00:00Z"
  }
}
```

### 2.2 获取对话列表

```
GET /conversations?page=1&page_size=20
```

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

**响应：**
```json
{
  "code": 200,
  "data": {
    "total": 42,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": "conv_1717488000000",
        "title": "让图片1和视频1一起跳舞",
        "type": "video",
        "thumbnail": "https://cdn.example.com/result1.mp4",
        "card_count": 3,
        "created_at": "2025-06-04T10:00:00Z",
        "updated_at": "2025-06-04T10:05:00Z"
      }
    ]
  }
}
```

### 2.3 获取对话详情（含所有结果卡片）

```
GET /conversations/:id
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": "conv_1717488000000",
    "title": "让图片1和视频1一起跳舞",
    "type": "video",
    "user_id": "user_123",
    "created_at": "2025-06-04T10:00:00Z",
    "updated_at": "2025-06-04T10:05:00Z",
    "cards": [
      {
        "id": 1717488001000,
        "title": "让图片1和视频1一起跳舞",
        "prompt": "让 <<<image_1>>> 和 <<<video_1>>> 一起跳舞",
        "type": "video",
        "model": "wan2.1",
        "task_id": "task_abc123",
        "status": "completed",
        "results": [
          {
            "type": "video",
            "url": "https://cdn.example.com/result1.mp4",
            "duration": 5
          }
        ],
        "input_files": [
          {
            "type": "image",
            "url": "https://cdn.example.com/img1.png",
            "object_id": "image_1"
          }
        ],
        "created_at": "2025-06-04T10:00:00Z"
      }
    ]
  }
}
```

### 2.4 更新对话

```
PUT /conversations/:id
```

**请求体：**
```json
{
  "title": "新的对话标题"
}
```

### 2.5 删除对话

```
DELETE /conversations/:id
```

**响应：**
```json
{
  "code": 200,
  "message": "删除成功"
}
```

### 2.6 追加生成结果到对话

```
POST /conversations/:id/cards
```

每次生成完成后，前端将结果追加到对话。

**请求体：**
```json
{
  "title": "让图片1和视频1一起跳舞",
  "prompt": "让 <<<image_1>>> 和 <<<video_1>>> 一起跳舞",
  "type": "video",
  "model": "wan2.1",
  "task_id": "task_abc123",
  "status": "completed",
  "results": [
    {
      "type": "video",
      "url": "https://cdn.example.com/result1.mp4",
      "duration": 5
    }
  ],
  "input_files": [
    {
      "type": "image",
      "url": "https://cdn.example.com/img1.png",
      "object_id": "image_1"
    }
  ]
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 1717488002000,
    "conversation_id": "conv_1717488000000",
    "created_at": "2025-06-04T10:01:00Z"
  }
}
```

---

## 三、数据库设计

### 3.1 conversations 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 对话ID，如 `conv_1717488000000` |
| user_id | VARCHAR(64) | NOT NULL, INDEX | 用户ID |
| title | VARCHAR(200) | NOT NULL | 对话标题（取首条prompt前30字） |
| type | VARCHAR(20) | NOT NULL | 主类型：`image` / `video` / `digital_human` |
| thumbnail | TEXT | | 缩略图URL（取最新结果的第一个） |
| card_count | INT | DEFAULT 0 | 结果卡片数量（冗余，加速列表查询） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 最后更新时间 |

**索引：**
```sql
CREATE INDEX idx_conv_user_id ON conversations(user_id);
CREATE INDEX idx_conv_updated_at ON conversations(updated_at DESC);
```

### 3.2 conversation_cards 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 卡片ID |
| conversation_id | VARCHAR(64) | NOT NULL, FK | 所属对话ID |
| title | VARCHAR(200) | | 卡片标题 |
| prompt | TEXT | NOT NULL | 原始提示词（含 `<<<object_id>>>` 标记） |
| type | VARCHAR(20) | NOT NULL | 生成类型 |
| model | VARCHAR(100) | | 使用的模型ID |
| task_id | VARCHAR(100) | | 后端任务ID |
| status | VARCHAR(20) | DEFAULT 'pending' | 状态：`pending` / `completed` / `failed` |
| results | JSON | | 生成结果（见下方JSON结构） |
| input_files | JSON | | 输入素材（见下方JSON结构） |
| created_at | DATETIME | NOT NULL | 创建时间 |

**results JSON 结构：**
```json
[
  {
    "type": "video",
    "url": "https://cdn.example.com/result1.mp4",
    "duration": 5,
    "thumbnail_url": "https://cdn.example.com/result1_thumb.jpg"
  },
  {
    "type": "image",
    "url": "https://cdn.example.com/result2.png",
    "width": 1920,
    "height": 1080
  }
]
```

**input_files JSON 结构：**
```json
[
  {
    "type": "image",
    "url": "https://cdn.example.com/img1.png",
    "object_id": "image_1",
    "purpose": "reference"
  },
  {
    "type": "image",
    "media_id": "MEDIA-IMG-002",
    "object_id": "image_2",
    "purpose": "reference"
  }
]
```

> `media_id` 和 `url` 二选一：`media_id` 引用素材库素材（Seedance 人脸场景），`url` 直接传公网地址（非人脸场景）。

**索引：**
```sql
CREATE INDEX idx_card_conv_id ON conversation_cards(conversation_id);
CREATE INDEX idx_card_created_at ON conversation_cards(created_at);
```

### 3.3 建表 SQL

```sql
CREATE TABLE conversations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,
  thumbnail TEXT,
  card_count INT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conv_user_id (user_id),
  INDEX idx_conv_updated_at (updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_cards (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id VARCHAR(64) NOT NULL,
  title VARCHAR(200),
  prompt TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  model VARCHAR(100),
  task_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  results JSON,
  input_files JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_card_conv_id (conversation_id),
  INDEX idx_card_created_at (created_at),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 四、前端对接流程

### 4.1 当前实现（LocalStorage 模式）

前端已实现完整的对话管理功能，数据暂存 `localStorage`：

```
localStorage key: szg_conversations
```

**数据流：**
1. 用户输入 prompt → 点击生成 → 调用 `POST /generate`
2. 生成成功 → 创建/追加对话 → 保存到 localStorage
3. 点击左侧对话列表 → 切换 `activeConversationId` → computed 自动切换卡片
4. 点击"新对话" → 清空当前状态，下次生成时创建新对话

### 4.2 后端对接迁移步骤

1. **登录时加载对话列表**：`GET /conversations` 替代 localStorage
2. **生成成功后同步**：`POST /conversations/:id/cards` 追加结果
3. **切换对话时加载详情**：`GET /conversations/:id` 获取完整卡片
4. **删除对话**：`DELETE /conversations/:id` 同步后端
5. **保留 localStorage 作为离线缓存**，优先从 API 获取，失败时降级读取本地

### 4.3 前端待改造点

| 位置 | 当前 | 后端对接后 |
|------|------|-----------|
| `loadConversationsFromLocal()` | 读 localStorage | 改为 `GET /conversations`，localStorage 作缓存 |
| `saveConversationsToLocal()` | 写 localStorage | 改为 `POST /conversations/:id/cards` |
| `deleteConversation()` | 仅删本地 | 增加 `DELETE /conversations/:id` |
| `handleGenerate()` | 生成后写本地 | 生成后调 API 保存 |
| `selectConversation()` | 切换本地ID | 调 `GET /conversations/:id` 加载详情 |

---

## 五、错误码

| code | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 无效/过期） |
| 403 | 无权限 |
| 404 | 对话/资源不存在 |
| 429 | 请求频率超限 |
| 500 | 服务端内部错误 |

**错误响应格式：**
```json
{
  "code": 400,
  "message": "对话ID不存在",
  "data": null
}
```
