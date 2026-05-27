# 题库管理功能改进实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重做题库导入流程（预览→确认），增强题型筛选（判断/单选/多选 + 图片）

**Architecture:** 新增 preview/confirm 两个API端点，前端导入弹窗改为多步骤流程，筛选栏扩展为两组独立按钮

**Tech Stack:** Next.js 16 App Router, better-sqlite3, xlsx, React 19

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app/api/questions/import/preview/route.ts` | 新建 | 预览API |
| `src/app/api/questions/import/confirm/route.ts` | 新建 | 确认导入API |
| `src/app/api/questions/route.ts` | 修改 | 新增hasImage筛选参数 |
| `src/app/questions/page.tsx` | 修改 | 重做导入弹窗 + 筛选栏 |

---

## Task 1: 创建预览API

**Files:**
- Create: `src/app/api/questions/import/preview/route.ts`
- Reference: `src/app/api/questions/import/route.ts` (现有导入逻辑)

- [ ] **Step 1: 创建preview路由文件**

```typescript
// src/app/api/questions/import/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as XLSX from "xlsx";
import crypto from "crypto";

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

function parseCorrectAnswer(raw: unknown): string {
  const map = ["A", "B", "C", "D", "E", "F", "G", "H"];
  try {
    let arr: string[];
    if (typeof raw === "string") {
      arr = JSON.parse(raw);
    } else if (Array.isArray(raw)) {
      arr = raw.map(String);
    } else {
      return "A";
    }
    return arr.map((v) => map[(parseInt(v) || 1) - 1] || "A").join("");
  } catch {
    return "A";
  }
}

interface PreviewQuestion {
  row: number;
  type: number;
  question_text: string;
  question_content: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correct_answer: string;
  explanation: string;
  tip_text: string;
  tip_display: string;
  cover_image: string | null;
  gif_image: string | null;
  keywords: string | null;
  action: "insert" | "update" | "skip";
}

interface PreviewError {
  row: number;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryId = formData.get("categoryId") as string || "";
    const importMode = formData.get("importMode") as string || "append";

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "请选择分类" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const db = getDb();

    // 预览限制500行
    const MAX_PREVIEW = 500;
    const displayRows = rows.slice(0, MAX_PREVIEW);

    let toInsert = 0;
    let toUpdate = 0;
    let toSkip = 0;
    const errors: PreviewError[] = [];
    const questions: PreviewQuestion[] = [];

    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      const rowNum = i + 2; // Excel行号（从2开始，1是表头）

      const questionText = String(row["题目"] || "").trim();
      if (!questionText) {
        errors.push({ row: rowNum, message: "缺少题目文本" });
        continue;
      }

      const questionContent = String(row["题目内容"] || "");
      const qType = Number(row["题目类型"]) || 1;
      const type = qType === 1 ? 1 : 2;

      const opts = [];
      for (let j = 1; j <= 8; j++) {
        const v = row[`答案${j}`];
        if (v != null && String(v).trim()) opts.push(String(v).trim());
      }

      const correctAnswer = parseCorrectAnswer(row["正确答案"]);
      const explanation = String(row["官方解读"] || "");
      const tipText = String(row["技巧(用于生成语音的技巧文字)"] || row["技巧"] || "");
      const tipDisplay = String(row["技巧（前端技巧弹窗显示内容）"] || "");
      const coverImage = String(row["封面（图片地址）"] || row["封面"] || "");
      const gifImage = String(row["动图地址（图片动图）"] || "");
      const keywords = String(row["关键字"] || "");

      // 检查是否重复
      const hashInput = questionText.replace(/\s+/g, "") + opts.join("");
      const hash = md5(hashInput);
      const sourceId = Number(row["题库ID"]) || 0;

      const existing = db.prepare(
        "SELECT id FROM questions WHERE content_hash = ? OR (source_id = ? AND source_id > 0)"
      ).get(hash, sourceId) as { id: number } | undefined;

      let action: "insert" | "update" | "skip";
      if (existing) {
        if (importMode === "overwrite") {
          action = "update";
          toUpdate++;
        } else {
          action = "skip";
          toSkip++;
        }
      } else {
        action = "insert";
        toInsert++;
      }

      questions.push({
        row: rowNum,
        type,
        question_text: questionText,
        question_content: questionContent,
        option1: opts[0] || null,
        option2: opts[1] || null,
        option3: opts[2] || null,
        option4: opts[3] || null,
        correct_answer: correctAnswer,
        explanation,
        tip_text: tipText,
        tip_display: tipDisplay,
        cover_image: coverImage || null,
        gif_image: gifImage || null,
        keywords: keywords || null,
        action,
      });
    }

    return NextResponse.json({
      preview: {
        total: rows.length,
        displayed: displayRows.length,
        toInsert,
        toUpdate,
        toSkip,
        errors,
        questions,
      },
    });
  } catch (e: any) {
    console.error("Preview error:", e);
    return NextResponse.json({ error: e.message || "预览失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试preview接口**

用curl或Postman测试：
```bash
curl -X POST http://localhost:3000/api/questions/import/preview \
  -F "file=@test.xlsx" \
  -F "categoryId=xxx" \
  -F "importMode=append"
```

预期响应包含 `preview.toInsert`, `toUpdate`, `toSkip`, `errors`, `questions`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/questions/import/preview/route.ts
git commit -m "feat: add import preview API endpoint"
```

---

## Task 2: 创建确认导入API

**Files:**
- Create: `src/app/api/questions/import/confirm/route.ts`
- Reference: `src/app/api/questions/import/route.ts` (复用导入逻辑)

- [ ] **Step 1: 创建confirm路由文件**

```typescript
// src/app/api/questions/import/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

interface ImportQuestion {
  row: number;
  type: number;
  question_text: string;
  question_content: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correct_answer: string;
  explanation: string;
  tip_text: string;
  tip_display: string;
  cover_image: string | null;
  gif_image: string | null;
  keywords: string | null;
  action: "insert" | "update" | "skip";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, importMode, questions } = body as {
      categoryId: string;
      importMode: string;
      questions: ImportQuestion[];
    };

    if (!categoryId) {
      return NextResponse.json({ error: "请选择分类" }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "没有要导入的题目" }, { status: 400 });
    }

    const db = getDb();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO questions
      (id, type, question_text, question_content, option1, option2, option3, option4,
       correct_answer, explanation, tip_text, tip_display, cover_image, gif_image,
       explanation_images, keywords, category_id, source_id, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const maxIdRow = db.prepare("SELECT MAX(id) as m FROM questions").get() as { m: number | null };
    let nextId = (maxIdRow.m || 0) + 1;

    const update = db.prepare(`
      UPDATE questions SET type = ?, question_text = ?, question_content = ?,
      option1 = ?, option2 = ?, option3 = ?, option4 = ?,
      correct_answer = ?, explanation = ?, tip_text = ?, tip_display = ?,
      cover_image = ?, gif_image = ?, explanation_images = ?, keywords = ?,
      category_id = ?, source_id = ?, content_hash = ?
      WHERE id = ?
    `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let deleted = 0;

    db.pragma("foreign_keys = OFF");
    const tx = db.transaction(() => {
      // replace模式：先删除旧题
      if (importMode === "replace" && categoryId) {
        const qIds = db.prepare(
          "SELECT question_id FROM question_categories WHERE category_id = ?"
        ).all(categoryId) as { question_id: number }[];
        const ids = qIds.map((r) => r.question_id);
        if (ids.length > 0) {
          const otherLinks = db.prepare(
            "SELECT question_id, COUNT(*) as cnt FROM question_categories WHERE question_id IN (" +
            ids.map(() => "?").join(",") + ") GROUP BY question_id"
          ).all(...ids) as { question_id: number; cnt: number }[];
          const multiLinked = new Set(otherLinks.filter((r) => r.cnt > 1).map((r) => r.question_id));
          const toDelete = ids.filter((id) => !multiLinked.has(id));
          if (toDelete.length > 0) {
            db.prepare("DELETE FROM questions WHERE id IN (" + toDelete.map(() => "?").join(",") + ")").run(...toDelete);
            db.prepare("DELETE FROM tts_cache WHERE question_id IN (" + toDelete.map(() => "?").join(",") + ")").run(...toDelete);
          }
          db.prepare("DELETE FROM question_categories WHERE category_id = ?").run(categoryId);
          deleted = ids.length;
        }
      }

      // 导入题目
      for (const q of questions) {
        if (q.action === "skip") {
          skipped++;
          continue;
        }

        const hashInput = q.question_text.replace(/\s+/g, "") + [q.option1, q.option2, q.option3, q.option4].filter(Boolean).join("");
        const hash = md5(hashInput);

        if (q.action === "update") {
          // 查找现有题目
          const existing = db.prepare("SELECT id FROM questions WHERE content_hash = ?").get(hash) as { id: number } | undefined;
          if (existing) {
            update.run(
              q.type, q.question_text, q.question_content,
              q.option1, q.option2, q.option3, q.option4,
              q.correct_answer, q.explanation, q.tip_text, q.tip_display,
              q.cover_image, q.gif_image, null, q.keywords,
              categoryId, null, hash, existing.id
            );
            db.prepare("DELETE FROM tts_cache WHERE question_id = ?").run(existing.id);
            updated++;
          } else {
            // 找不到则插入
            const qId = nextId++;
            insert.run(
              qId, q.type, q.question_text, q.question_content,
              q.option1, q.option2, q.option3, q.option4,
              q.correct_answer, q.explanation, q.tip_text, q.tip_display,
              q.cover_image, q.gif_image, null, q.keywords,
              categoryId, null, hash
            );
            db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(qId, categoryId);
            inserted++;
          }
        } else {
          // insert
          const qId = nextId++;
          insert.run(
            qId, q.type, q.question_text, q.question_content,
            q.option1, q.option2, q.option3, q.option4,
            q.correct_answer, q.explanation, q.tip_text, q.tip_display,
            q.cover_image, q.gif_image, null, q.keywords,
            categoryId, null, hash
          );
          db.prepare("INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)").run(qId, categoryId);
          inserted++;
        }
      }
    });

    tx();
    db.pragma("foreign_keys = ON");

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      skipped,
      deleted,
    });
  } catch (e: any) {
    console.error("Confirm import error:", e);
    return NextResponse.json({ error: e.message || "导入失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试confirm接口**

```bash
curl -X POST http://localhost:3000/api/questions/import/confirm \
  -H "Content-Type: application/json" \
  -d '{"categoryId":"xxx","importMode":"append","questions":[{"row":2,"type":1,"question_text":"测试题目","option1":"对","option2":"错","correct_answer":"A","action":"insert"}]}'
```

预期响应：`{"success":true,"inserted":1,"updated":0,"skipped":0,"deleted":0}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/questions/import/confirm/route.ts
git commit -m "feat: add import confirm API endpoint"
```

---

## Task 3: 扩展题目筛选API

**Files:**
- Modify: `src/app/api/questions/route.ts`

- [ ] **Step 1: 添加hasImage筛选参数**

在 `GET` 函数中，`type` 筛选之后添加：

```typescript
// 在 line 33 之后添加
const hasImage = searchParams.get("hasImage");

// 在 keyword 筛选之前添加
if (hasImage && hasImage !== "all") {
  if (hasImage === "true") {
    where += " AND (q.cover_image IS NOT NULL AND q.cover_image != '') OR (q.gif_image IS NOT NULL AND q.gif_image != '')";
  } else if (hasImage === "false") {
    where += " AND (q.cover_image IS NULL OR q.cover_image = '') AND (q.gif_image IS NULL OR q.gif_image = '')";
  }
}
```

- [ ] **Step 2: 测试筛选API**

```bash
# 测试单选题+有图片
curl "http://localhost:3000/api/questions?page=1&pageSize=20&type=single&hasImage=true"

# 测试多选题
curl "http://localhost:3000/api/questions?page=1&pageSize=20&type=multi"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/questions/route.ts
git commit -m "feat: add hasImage filter to questions API"
```

---

## Task 4: 重做前端导入弹窗

**Files:**
- Modify: `src/app/questions/page.tsx`

- [ ] **Step 1: 添加新的state变量**

在现有state声明之后添加：

```typescript
// 导入预览相关
const [importStep, setImportStep] = useState<"select" | "preview" | "result">("select");
const [previewData, setPreviewData] = useState<{
  total: number;
  displayed: number;
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  errors: { row: number; message: string }[];
  questions: any[];
} | null>(null);
const [previewing, setPreviewing] = useState(false);
const [confirming, setConfirming] = useState(false);
const [importResult, setImportResult] = useState<{
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
} | null>(null);
const [expandedPreviewId, setExpandedPreviewId] = useState<number | null>(null);
```

- [ ] **Step 2: 添加预览函数**

```typescript
const handlePreview = async () => {
  const file = fileRef.current?.files?.[0];
  if (!file || !importCategory) return;
  
  setPreviewing(true);
  setPreviewData(null);
  
  const fd = new FormData();
  fd.append("file", file);
  fd.append("categoryId", importCategory);
  fd.append("importMode", importMode);
  
  const res = await fetch("/api/questions/import/preview", { method: "POST", body: fd });
  const data = await res.json();
  
  if (!res.ok) {
    alert(data.error || "预览失败");
    setPreviewing(false);
    return;
  }
  
  setPreviewData(data.preview);
  setImportStep("preview");
  setPreviewing(false);
};
```

- [ ] **Step 3: 添加确认导入函数**

```typescript
const handleConfirmImport = async () => {
  if (!previewData || !importCategory) return;
  
  setConfirming(true);
  
  const res = await fetch("/api/questions/import/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryId: importCategory,
      importMode,
      questions: previewData.questions,
    }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    alert(data.error || "导入失败");
    setConfirming(false);
    return;
  }
  
  setImportResult(data);
  setImportStep("result");
  setConfirming(false);
  fetchQuestions();
};
```

- [ ] **Step 4: 重做导入弹窗UI**

替换现有的 `{showImport && (...)}` 部分：

```tsx
{showImport && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => { setShowImport(false); setImportStep("select"); setPreviewData(null); setImportResult(null); }}>
    <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* 步骤1：选择文件 */}
      {importStep === "select" && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">导入题目</h3>
            <button onClick={() => { setShowImport(false); setImportStep("select"); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择分类</label>
              <select value={importCategory} onChange={(e) => setImportCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">导入模式</label>
              <div className="flex gap-2">
                <button onClick={() => setImportMode("append")} className={`flex-1 py-2 rounded-lg text-sm border transition ${importMode === "append" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>追加</button>
                <button onClick={() => setImportMode("overwrite")} className={`flex-1 py-2 rounded-lg text-sm border transition ${importMode === "overwrite" ? "bg-amber-600 text-white border-amber-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>覆盖更新</button>
                <button onClick={() => setImportMode("replace")} className={`flex-1 py-2 rounded-lg text-sm border transition ${importMode === "replace" ? "bg-red-600 text-white border-red-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>替换</button>
              </div>
              {importMode === "append" && <p className="text-xs text-gray-500 mt-1">重复题目跳过，只插入新题</p>}
              {importMode === "overwrite" && <p className="text-xs text-amber-600 mt-1">重复题目更新全部字段，新题插入</p>}
              {importMode === "replace" && <p className="text-xs text-red-500 mt-1">⚠ 将清空该分类下所有题目，再全量导入</p>}
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer" />
              <p className="text-xs text-gray-400 mt-1">支持 quanan 导出的标准模板格式 · <a href="/api/questions/template" className="text-blue-600 hover:underline">下载导入模板</a></p>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <button onClick={() => { setShowImport(false); setImportStep("select"); }} className="px-4 py-2 text-sm text-gray-600">取消</button>
            <button onClick={handlePreview} disabled={previewing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
            >{previewing ? "解析中..." : "预览"}</button>
          </div>
        </>
      )}

      {/* 步骤2：预览 */}
      {importStep === "preview" && previewData && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">导入预览</h3>
            <button onClick={() => { setShowImport(false); setImportStep("select"); setPreviewData(null); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{previewData.toInsert}</div>
                <div className="text-xs text-green-600">新增</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{previewData.toUpdate}</div>
                <div className="text-xs text-blue-600">更新</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{previewData.toSkip}</div>
                <div className="text-xs text-gray-600">跳过</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{previewData.errors.length}</div>
                <div className="text-xs text-red-600">错误</div>
              </div>
            </div>

            {/* replace模式警告 */}
            {importMode === "replace" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                ⚠ 警告：将清空该分类下所有题目，再全量导入新题
              </div>
            )}

            {/* 行数限制提示 */}
            {previewData.displayed < previewData.total && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
                显示前 {previewData.displayed} 题，共 {previewData.total} 题
              </div>
            )}

            {/* 题目列表 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-12 px-3 py-2 text-left text-gray-500 font-medium">行号</th>
                    <th className="w-16 px-3 py-2 text-left text-gray-500 font-medium">题型</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">题目</th>
                    <th className="w-20 px-3 py-2 text-left text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 错误行 */}
                  {previewData.errors.map((err, i) => (
                    <tr key={`err-${i}`} className="bg-red-50 border-b border-red-100">
                      <td className="px-3 py-2 text-red-600 font-mono">{err.row}</td>
                      <td className="px-3 py-2 text-red-600">-</td>
                      <td className="px-3 py-2 text-red-600">{err.message}</td>
                      <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">错误</span></td>
                    </tr>
                  ))}
                  {/* 正常行 */}
                  {previewData.questions.map((q, i) => {
                    const isExpanded = expandedPreviewId === i;
                    const typeLabel = q.type === 1 ? "判断" : q.correct_answer.length > 1 ? "多选" : "单选";
                    const actionLabel = q.action === "insert" ? "新增" : q.action === "update" ? "更新" : "跳过";
                    const actionColor = q.action === "insert" ? "bg-green-100 text-green-700" : q.action === "update" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700";
                    return (
                      <React.Fragment key={i}>
                        <tr className={`border-b border-gray-50 cursor-pointer transition ${isExpanded ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}
                          onClick={() => setExpandedPreviewId(isExpanded ? null : i)}
                        >
                          <td className="px-3 py-2 text-gray-400 font-mono">{q.row}</td>
                          <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${q.type === 1 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{typeLabel}</span></td>
                          <td className="px-3 py-2 text-gray-700 max-w-md truncate">{q.question_text}</td>
                          <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${actionColor}`}>{actionLabel}</span></td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-gray-100">
                            <td colSpan={4} className="px-6 py-4 bg-gray-50/80">
                              <div className="space-y-2">
                                <div><span className="text-xs font-medium text-gray-500">选项：</span><span className="text-sm text-gray-700">{[q.option1, q.option2, q.option3, q.option4].filter(Boolean).join(" / ")}</span></div>
                                <div><span className="text-xs font-medium text-gray-500">答案：</span><span className="text-sm text-gray-700">{q.correct_answer}</span></div>
                                {q.explanation && <div><span className="text-xs font-medium text-gray-500">解析：</span><span className="text-sm text-gray-700">{q.explanation}</span></div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <button onClick={() => { setImportStep("select"); setPreviewData(null); }} className="px-4 py-2 text-sm text-gray-600">返回</button>
            <button onClick={handleConfirmImport} disabled={confirming}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
            >{confirming ? "导入中..." : "确认导入"}</button>
          </div>
        </>
      )}

      {/* 步骤3：结果 */}
      {importStep === "result" && importResult && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">导入完成</h3>
            <button onClick={() => { setShowImport(false); setImportStep("select"); setPreviewData(null); setImportResult(null); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-green-700 text-lg font-medium mb-2">导入成功</div>
              <div className="text-green-600 text-sm space-y-1">
                {importResult.inserted > 0 && <div>新增 {importResult.inserted} 题</div>}
                {importResult.updated > 0 && <div>更新 {importResult.updated} 题</div>}
                {importResult.skipped > 0 && <div>跳过 {importResult.skipped} 题</div>}
                {importResult.deleted > 0 && <div>删除旧题 {importResult.deleted} 题</div>}
              </div>
            </div>
          </div>
          <div className="flex justify-end px-6 py-4 border-t">
            <button onClick={() => { setShowImport(false); setImportStep("select"); setPreviewData(null); setImportResult(null); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">完成</button>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: 测试导入流程**

1. 点击"导入 Excel"按钮
2. 选择文件、分类、模式
3. 点击"预览" → 应显示统计卡片和题目列表
4. 点击"确认导入" → 应显示导入结果
5. 验证题目已正确导入

- [ ] **Step 6: Commit**

```bash
git add src/app/questions/page.tsx
git commit -m "feat: redesign import flow with preview and confirm steps"
```

---

## Task 5: 升级筛选栏

**Files:**
- Modify: `src/app/questions/page.tsx`

- [ ] **Step 1: 添加新的state变量**

```typescript
const [questionType, setQuestionType] = useState("all");
const [hasImage, setHasImage] = useState("all");
```

- [ ] **Step 2: 修改fetchQuestions函数**

替换现有的筛选参数构建：

```typescript
const fetchQuestions = useCallback(async () => {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (activeCategory !== "all") params.set("category", activeCategory);
  if (questionType !== "all") params.set("type", questionType);
  if (hasImage !== "all") params.set("hasImage", hasImage);
  if (keyword) params.set("keyword", keyword);
  const res = await fetch(`/api/questions?${params}`);
  const data = await res.json();
  setQuestions(data.questions);
  setTotal(data.total);
}, [page, activeCategory, questionType, hasImage, keyword]);
```

- [ ] **Step 3: 替换筛选栏UI**

替换现有的 `{/* 搜索 + 筛选 */}` 部分：

```tsx
{/* 搜索 + 筛选 */}
<div id="tour-q-search" className="space-y-3 mb-4">
  <input type="text" placeholder="搜索题目..." value={keyword}
    onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <div className="flex gap-4">
    {/* 题型筛选 */}
    <div className="flex gap-1.5 items-center">
      <span className="text-sm text-gray-500">题型：</span>
      {[
        { v: "all", l: "全部" },
        { v: "1", l: "判断题" },
        { v: "single", l: "单选题" },
        { v: "multi", l: "多选题" }
      ].map((t) => (
        <button key={t.v} onClick={() => { setQuestionType(t.v); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${questionType === t.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >{t.l}</button>
      ))}
    </div>

    {/* 图片筛选 */}
    <div className="flex gap-1.5 items-center">
      <span className="text-sm text-gray-500">图片：</span>
      {[
        { v: "all", l: "全部" },
        { v: "true", l: "有图片" },
        { v: "false", l: "无图片" }
      ].map((t) => (
        <button key={t.v} onClick={() => { setHasImage(t.v); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${hasImage === t.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >{t.l}</button>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 4: 删除旧的typeFilter state**

删除：
```typescript
const [typeFilter, setTypeFilter] = useState("all");
```

- [ ] **Step 5: 测试筛选功能**

1. 选择"判断题" → 应只显示判断题
2. 选择"多选题" → 应只显示多选题
3. 选择"有图片" → 应只显示有图片的题
4. 组合筛选：判断题 + 有图片 → 应只显示有图片的判断题

- [ ] **Step 6: Commit**

```bash
git add src/app/questions/page.tsx
git commit -m "feat: enhance question type and image filtering"
```

---

## 最终验证

- [ ] **完整流程测试**
  1. 导入Excel → 预览 → 确认导入 → 查看结果
  2. 筛选题型（判断/单选/多选）
  3. 筛选图片（有/无）
  4. 组合筛选
  5. 批量删除
  6. 分类管理

- [ ] **运行lint**
  ```bash
  npm run lint
  ```

- [ ] **最终Commit**
  ```bash
  git add -A
  git commit -m "feat: question bank management improvements"
  ```
