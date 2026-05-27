# 题库管理功能改进设计

**日期：** 2026-05-27
**状态：** 待实现

## 背景

当前题库管理页面存在两个主要问题：
1. 导入流程不清晰，用户导入后不知道具体发生了什么
2. 筛选功能太弱，只有"判断题/选择题"两种分类，无法区分单选/多选/图片题

## 目标

1. 重做导入流程，改为"预览→确认"两步式
2. 增强筛选功能，支持题型（判断/单选/多选）和图片属性独立筛选

---

## 1. 导入流程重做

### 1.1 当前流程

```
选择文件 → 点击导入 → 显示简单结果
```

**问题：**
- 导入结果只有数字统计，用户看不到具体导入了哪些题目
- 格式错误时只显示错误信息，不知道哪行有问题
- 三种导入模式（追加/覆盖/替换）用户难以理解

### 1.2 新流程

```
选择文件 + 分类 + 导入模式
        ↓
    点击"预览"
        ↓
    预览页面（统计 + 题目列表 + 错误高亮）
        ↓
    点击"确认导入"
        ↓
    执行导入 → 显示最终结果
```

### 1.3 新增API接口

#### `POST /api/questions/import/preview`

**请求：** multipart/form-data
- `file`: Excel文件
- `categoryId`: 分类ID
- `importMode`: append | overwrite | replace

**响应：**
```json
{
  "preview": {
    "total": 100,
    "toInsert": 80,
    "toUpdate": 15,
    "toSkip": 3,
    "errors": [
      { "row": 5, "message": "缺少题目文本" },
      { "row": 12, "message": "答案格式错误" }
    ],
    "questions": [
      {
        "row": 1,
        "type": 1,
        "question_text": "...",
        "option1": "...",
        "option2": "...",
        "correct_answer": "A",
        "action": "insert"
      }
    ]
  }
}
```

**说明：**
- 解析Excel但不写入数据库
- 返回完整预览数据
- `action` 字段标识该题将执行的操作：insert / update / skip
- `errors` 数组列出所有格式错误

#### `POST /api/questions/import/confirm`

**请求：** JSON
```json
{
  "categoryId": "...",
  "importMode": "append",
  "questions": [...]
}
```

**响应：**
```json
{
  "success": true,
  "inserted": 80,
  "updated": 15,
  "skipped": 3,
  "deleted": 0
}
```

**说明：**
- `deleted` 字段仅在 replace 模式下有值，表示被删除的旧题目数量
- 其他模式下为 0

#### Confirm 请求 questions 字段定义

```json
{
  "categoryId": "...",
  "importMode": "append",
  "questions": [
    {
      "row": 1,
      "type": 1,
      "question_text": "...",
      "question_content": "",
      "option1": "...",
      "option2": "...",
      "option3": null,
      "option4": null,
      "correct_answer": "A",
      "explanation": "...",
      "tip_text": "",
      "tip_display": "",
      "cover_image": null,
      "gif_image": null,
      "keywords": null,
      "action": "insert"
    }
  ]
}

### 1.4 前端UI

#### 预览页面布局

```
┌─────────────────────────────────────────┐
│ 导入预览                          [×]   │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │新增  │ │更新  │ │跳过  │ │错误  │       │
│ │ 80  │ │ 15  │ │  3  │ │  2  │       │
│ └─────┘ └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────────────┤
│ 题目列表（可展开）                       │
│ ┌─────────────────────────────────────┐ │
│ │ [+] 第1题: 判断题 - xxx      [插入] │ │
│ │ [+] 第2题: 单选题 - xxx      [插入] │ │
│ │ [!] 第5题: 缺少题目文本     [错误] │ │
│ │ ...                                │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│              [取消]  [确认导入]          │
└─────────────────────────────────────────┘
```

#### 统计卡片

- 新增（绿色）：将要插入的新题数量
- 更新（蓝色）：已存在将被更新的题目数量
- 跳过（灰色）：重复跳过的题目数量
- 错误（红色）：格式错误的题目数量

#### 题目列表

- 默认折叠，点击展开查看详情
- 错误行标红背景，显示具体错误原因
- 每行显示：行号、题型标签、题目预览、操作类型（插入/更新/跳过/错误）

---

## 2. 题型筛选升级

### 2.1 当前筛选

```
[全部] [判断题] [选择题]
```

**问题：**
- 无法区分单选题和多选题
- 无法筛选图片题
- 图片题可以是判断题或选择题，逻辑上有交叉

### 2.2 新筛选方案

两组独立筛选，组内单选，组间AND组合：

```
题型：[全部] [判断题] [单选题] [多选题]
图片：[全部] [有图片] [无图片]
```

### 2.3 筛选逻辑

| 题型 | 图片 | 结果 |
|------|------|------|
| 全部 | 全部 | 所有题目 |
| 判断题 | 全部 | 所有判断题 |
| 判断题 | 有图片 | 有图片的判断题 |
| 多选题 | 无图片 | 没图片的多选题 |
| 全部 | 有图片 | 所有有图片的题 |

### 2.4 题型判断逻辑

```typescript
// 判断题
const isTrueFalse = question.type === 1;

// 单选题（含 correct_answer 为空的无效题）
const isSingleChoice = question.type !== 1 && question.correct_answer.length <= 1;

// 多选题
const isMultipleChoice = question.type !== 1 && question.correct_answer.length > 1;

// 图片题（cover_image 或 gif_image 任一存在）
const hasImage = (question.cover_image !== null && question.cover_image !== '') ||
                (question.gif_image !== null && question.gif_image !== '');
```

**说明：**
- `correct_answer` 为空时归入单选题分类
- 图片检查包含 `cover_image` 和 `gif_image` 两个字段

### 2.5 API修改

`GET /api/questions` 扩展现有 `type` 参数，新增 `hasImage` 参数：

**type 参数（扩展现有）：**
- `all` 或不传：所有题型
- `1`：判断题（保持兼容）
- `2`：选择题（保持兼容，包含单选+多选）
- `single`：单选题（新增）
- `multi`：多选题（新增）

**hasImage 参数（新增）：**
- `all` 或不传：不限
- `true`：有图片（cover_image 或 gif_image）
- `false`：无图片

**示例：**
```
GET /api/questions?page=1&pageSize=20&type=single&hasImage=true
```

**向后兼容：**
- 现有的 `type=1` 和 `type=2` 调用方式不变
- 前端切换到新的 `type=single/multi` 值

### 2.6 前端UI修改

筛选栏从按钮组改为两行：

```tsx
<div className="flex gap-4 mb-4">
  {/* 题型筛选 */}
  <div className="flex gap-1.5">
    <span className="text-sm text-gray-500 py-2">题型：</span>
    {[
      { v: "all", l: "全部" },
      { v: "true-false", l: "判断题" },
      { v: "single-choice", l: "单选题" },
      { v: "multiple-choice", l: "多选题" }
    ].map((t) => (
      <button key={t.v} onClick={() => { setQuestionType(t.v); setPage(1); }}
        className={`px-3 py-2 rounded-lg text-xs font-medium transition ${questionType === t.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      >{t.l}</button>
    ))}
  </div>

  {/* 图片筛选 */}
  <div className="flex gap-1.5">
    <span className="text-sm text-gray-500 py-2">图片：</span>
    {[
      { v: "all", l: "全部" },
      { v: "true", l: "有图片" },
      { v: "false", l: "无图片" }
    ].map((t) => (
      <button key={t.v} onClick={() => { setHasImage(t.v); setPage(1); }}
        className={`px-3 py-2 rounded-lg text-xs font-medium transition ${hasImage === t.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      >{t.l}</button>
    ))}
  </div>
</div>
```

---

## 3. 改动范围

### 后端

| 文件 | 改动 |
|------|------|
| `src/app/api/questions/import/route.ts` | 拆分为 preview + confirm 两个接口 |
| `src/app/api/questions/route.ts` | 新增 questionType 和 hasImage 查询参数 |

### 前端

| 文件 | 改动 |
|------|------|
| `src/app/questions/page.tsx` | 重做导入弹窗 + 筛选栏 |

---

## 4. 注意事项

1. **preview接口不写数据库** — 只解析Excel返回预览数据
2. **confirm接口接收完整数据** — 前端把预览数据传给confirm，避免重复解析
3. **向后兼容** — 现有的 `/api/questions/import` 接口暂时保留，后续可废弃
4. **预览行数限制** — 超过500行时只返回前500行预览，提示"显示前500题，共N题"
5. **Loading状态** — 预览和确认导入都需要显示加载状态（转圈/进度条）
6. **竞态处理** — confirm接口应处理重复导入的情况，返回部分成功结果而非报错
7. **分类必填** — preview和confirm都要求categoryId非空
8. **replace模式警告** — 预览页面对replace模式显示醒目警告："将清空该分类下所有题目"
4. **筛选参数可选** — 不传时默认显示全部，保持向后兼容
