# 图看板 - 数据字典

> 数据库: `ai_design_prod`
> 主表: `workflow_task`
> 最后更新: 2026-04-01

---

## 1. 表概览

| 项目 | 说明 |
|------|------|
| **表名** | `workflow_task` |
| **描述** | 工作流任务表，存储图片处理任务的元数据、状态、结果图片URL、质量评估指标等 |
| **数据量** | 约数十万级别（含子任务） |
| **核心业务** | 图片增强、超分、降噪、裁变、裂变等AI图像处理任务 |

---

## 2. 字段详细说明

### 2.1 主键与标识字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | BIGINT UNSIGNED | 否 | AUTO_INCREMENT | 主键，自增ID |
| `task_id` | VARCHAR(64) | 是 | NULL | 任务ID，格式: `q411774956239728_1`，用于提取子任务序号 |
| `sub_task_id` | VARCHAR(64) | 是 | NULL | **核心筛选字段**，子任务唯一标识，NULL或空字符串表示非子任务 |
| `user_id` | VARCHAR(64) | 是 | NULL | 用户ID，用于筛选和统计独立用户数 |

**重要约束**:
- 看板只展示 `sub_task_id IS NOT NULL AND sub_task_id != ''` 的记录
- 这是区分"父任务"和"子任务（图片生成）"的关键

---

### 2.2 业务类型字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 | 映射值 |
|--------|------|------|--------|------|--------|
| `action` | VARCHAR(32) | 是 | NULL | 操作类型，决定业务逻辑 | 见下表 |

**action 映射表**:

| 数据库存储值 | 中文显示 | 业务含义 |
|--------------|----------|----------|
| `extend` | 画布扩展 | 扩展图片画布尺寸 |
| `hires` | 高清放大 | 高分辨率放大处理 |
| `fission` | 图片裂变 | 单图生成多图变体 |
| `pattern-extract` | 图案提取 | 从图片提取图案元素 |
| `img2img` | 图生图 | 基于图片生成新图 |

**前端 Tag 生成规则**: `action` 值去掉"图片"前缀，如"图片增强"→"增强"

---

### 2.3 状态字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `status` | TINYINT | 是 | 0 | 任务状态，控制流程流转 |

**status 枚举值**:

| 数值 | 中文状态 | 业务含义 | 质量评级映射 |
|------|----------|----------|--------------|
| `0` | 处理中 | 任务正在执行 | 待评估 |
| `1` | 失败 | 处理异常终止 | 问题 |
| `2` | 成功 | 正常完成，有结果图 | 优秀 |
| `3` | 未知/处理中 | 状态异常或中间态 | 待评估 |

**特殊处理**:
- 成功状态查询时会附加 `AND JSON_LENGTH(images) > 0` 确保有结果图
- 失败状态的数据在看板中只显示数量统计，不提供对比功能

---

### 2.4 图片存储字段（JSON格式）

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `original_images` | JSON / TEXT | 是 | NULL | 原图URL数组，存储输入图片 |
| `images` | JSON / TEXT | 是 | NULL | 结果图URL数组，存储AI处理后的图片 |

**数据格式**:
```json
// 正常情况 - URL数组
["https://cdn.example.com/img/xxx.jpg", "https://cdn.example.com/img/yyy.jpg"]

// 单图情况
["https://cdn.example.com/img/xxx.jpg"]

// 异常情况 - 可能存储为字符串或null
"null"
```

**后端处理逻辑**:
```javascript
// 支持多种格式解析
1. 已经是数组 -> 直接使用
2. JSON字符串 -> JSON.parse解析
3. 普通字符串 -> 作为单元素数组
4. "null"字符串或null -> 空数组

// 过滤规则: 只保留以"http"开头的有效URL
```

---

### 2.5 质量评估指标字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `metrics` | JSON / TEXT | 是 | NULL | 图像质量评估指标，用于看板评分展示 |

**metrics JSON 结构**:

| 属性 | 类型 | 说明 | 正常范围 |
|------|------|------|----------|
| `psnr` | Float | 峰值信噪比，衡量图像失真程度 | 20-50 dB，越高越好 |
| `ssim` | Float | 结构相似性指数 | 0-1，越接近1越好 |
| `contrast` | Object | 对比度对比 | `{original: number, result: number}` |
| `brightness` | Object | 亮度对比 | `{original: number, result: number}` |
| `sharpness` | Object | 清晰度/锐度对比 | `{original: number, result: number}` |
| `colorDeviation` | Float | 色彩偏差值 | 越小越好 |
| `noiseReduction` | Float | 降噪率百分比 | 0-100%，越高越好 |
| `overallScore` | Float | 综合评分 | 0-100分，看板核心展示指标 |

**示例**:
```json
{
  "psnr": 34.7,
  "ssim": 0.923,
  "contrast": { "original": 78, "result": 89 },
  "brightness": { "original": 127, "result": 134 },
  "sharpness": { "original": 62, "result": 78 },
  "colorDeviation": 4.2,
  "noiseReduction": 72,
  "overallScore": 88
}
```

**降级策略**: 如果 metrics 为空或解析失败，系统会生成随机模拟数据（30+随机值）

---

### 2.6 时间与性能字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间，用于筛选和排序 |
| `processing_time` | INT | 是 | 0 | 处理耗时（秒），展示处理效率 |

**时间筛选规则**:
- 支持 `start_date` 和 `end_date` 区间筛选
- 格式: `YYYY-MM-DD`（标准日期格式）
- 前端显示格式转换为: `YYYY/M/D`

---

### 2.7 其他字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `resolution` | VARCHAR(32) | 是 | NULL | 图片分辨率，如 "1920×1080" |
| `updated_at` | DATETIME | 是 | NULL | 最后更新时间 |

---

## 3. 前端接口映射

### 3.1 ImagePair 接口（前端使用）

后端将数据库记录转换为以下结构供前端消费：

| 前端字段 | 来源字段 | 转换逻辑 |
|----------|----------|----------|
| `id` | `id` | 直接使用 |
| `name` | `sub_task_id` | 去空格 + `.jpg` 后缀 |
| `subtaskNo` | `task_id` | 提取 `_` 后的序号，如 `#1` |
| `subtaskId` | `sub_task_id` | 原值 |
| `operationType` | `action` | 通过 actionMap 映射为中文 |
| `userId` | `user_id` | 原值 |
| `date` | `created_at` | 格式化为 `YYYY/M/D` |
| `processingTime` | `processing_time` | 原值，单位秒 |
| `originalCount` | `original_images` | 数组长度 |
| `resultCount` | `images` | 数组长度 |
| `status` | `status` | 0→处理中, 1→失败, 2→成功 |
| `qualityRating` | `status` | 成功→优秀, 失败→问题, 其他→待评估 |
| `original` | `original_images[0]` | 第一张原图URL |
| `result` | `images[0]` | 第一张结果图URL |
| `metrics` | `metrics` | JSON解析或生成模拟数据 |
| `tag` | `action` | 去掉"图片"前缀 |
| `resolution` | `resolution` | 原值或"未知" |

---

## 4. 常用查询模式

### 4.1 看板统计查询

```sql
-- 总任务数
SELECT COUNT(*) as total
FROM workflow_task
WHERE sub_task_id IS NOT NULL AND sub_task_id != '';

-- 成功任务数
SELECT COUNT(*) as success
FROM workflow_task
WHERE status = 2
  AND sub_task_id IS NOT NULL AND sub_task_id != '';

-- 独立用户数
SELECT COUNT(DISTINCT user_id) as users
FROM workflow_task
WHERE sub_task_id IS NOT NULL AND sub_task_id != '';

-- 操作类型统计
SELECT COUNT(DISTINCT action) as actions
FROM workflow_task
WHERE action IS NOT NULL
  AND sub_task_id IS NOT NULL AND sub_task_id != '';
```

### 4.2 列表页查询（带筛选分页）

```sql
-- 基础筛选条件
SELECT * FROM workflow_task
WHERE sub_task_id IS NOT NULL AND sub_task_id != ''
  AND user_id LIKE '%keyword%'          -- 可选：用户筛选
  AND action = 'extend'                 -- 可选：操作类型筛选
  AND status = 2                        -- 可选：状态筛选
  AND created_at >= '2026-03-01'        -- 可选：开始日期
  AND created_at <= '2026-03-31'        -- 可选：结束日期
  AND JSON_LENGTH(images) > 0           -- 成功状态附加条件
ORDER BY id DESC                        -- 按ID倒序（最新在前）
LIMIT 50 OFFSET 0;                      -- 分页
```

### 4.3 详情查询

```sql
-- 单条记录详情
SELECT * FROM workflow_task WHERE id = ?;

-- 健康检查
SELECT 1;
```

---

## 5. 数据质量注意事项

### 5.1 常见问题

| 问题 | 影响 | 处理方案 |
|------|------|----------|
| `sub_task_id` 为 NULL | 记录不会出现在看板 | 已通过 WHERE 条件过滤 |
| `images` 为 NULL/空 | 成功状态但无法对比 | 查询时附加 `JSON_LENGTH(images) > 0` |
| `original_images` 格式异常 | 原图无法显示 | try-catch 解析，失败返回空数组 |
| `metrics` 为 NULL | 评分显示为模拟值 | 降级使用随机生成的模拟数据 |
| `task_id` 格式不规范 | 子任务号显示异常 | 使用 `id` 作为备选 |

### 5.2 索引建议

```sql
-- 已存在（推测）
PRIMARY KEY (id)

-- 建议添加的索引
CREATE INDEX idx_sub_task ON workflow_task(sub_task_id);  -- 核心筛选
CREATE INDEX idx_status ON workflow_task(status);          -- 状态筛选
CREATE INDEX idx_user_id ON workflow_task(user_id);        -- 用户筛选
CREATE INDEX idx_action ON workflow_task(action);          -- 操作类型筛选
CREATE INDEX idx_created_at ON workflow_task(created_at);  -- 时间筛选

-- 复合索引（根据查询频率）
CREATE INDEX idx_sub_status ON workflow_task(sub_task_id, status);
CREATE INDEX idx_sub_created ON workflow_task(sub_task_id, created_at);
```

---

## 6. 数据库连接配置

```javascript
{
    host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'kanban',
    password: 'Chrd5@0987',
    database: 'ai_design_prod',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
}
```

---

## 7. 变更记录

| 日期 | 变更内容 | 负责人 |
|------|----------|--------|
| 2026-04-01 | 初始数据字典文档 | Claude |

---

## 附录：ER图（简化）

```
┌─────────────────────────────────────────────────────────────────┐
│                      workflow_task                               │
├─────────────────────────────────────────────────────────────────┤
│  PK  │  id                    │  BIGINT      │  自增主键         │
│      │  task_id               │  VARCHAR(64) │  任务标识         │
│      │  sub_task_id           │  VARCHAR(64) │  ★子任务标识      │
│      │  user_id               │  VARCHAR(64) │  用户标识         │
│      │  action                │  VARCHAR(32) │  操作类型         │
│      │  status                │  TINYINT     │  状态(0/1/2/3)    │
│      │  original_images       │  JSON        │  原图URL数组      │
│      │  images                │  JSON        │  结果图URL数组    │
│      │  metrics               │  JSON        │  质量指标         │
│      │  processing_time       │  INT         │  处理耗时(秒)     │
│      │  resolution            │  VARCHAR(32) │  分辨率           │
│      │  created_at            │  DATETIME    │  创建时间         │
│      │  updated_at            │  DATETIME    │  更新时间         │
└─────────────────────────────────────────────────────────────────┘

核心筛选条件: sub_task_id IS NOT NULL AND sub_task_id != ''
```
