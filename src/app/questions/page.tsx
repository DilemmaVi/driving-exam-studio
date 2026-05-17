"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { GuideTourButton } from "@/components/GuideTour";

interface Category {
  id: string;
  name: string;
  car_type: string;
  subject: string;
}

interface QuestionRow {
  id: number;
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
  keywords: string | null;
  category_id: string;
  source_id: number | null;
}

export default function QuestionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [importCategory, setImportCategory] = useState("");
  const [importMode, setImportMode] = useState("append");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; inserted: number; skipped: number; updated?: number; deleted?: number } | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshCategories = async () => {
    const d = await fetch("/api/categories").then((r) => r.json());
    setCategories(d.categories);
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCatName.trim() }) });
    setNewCatName("");
    refreshCategories();
  };

  const updateCategory = async () => {
    if (!editingCat || !editingCat.name.trim()) return;
    await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingCat.id, name: editingCat.name.trim() }) });
    setEditingCat(null);
    refreshCategories();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("删除后该分类下的题目将失去分类关联，确认删除？")) return;
    await fetch("/api/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (activeCategory === id) setActiveCategory("all");
    refreshCategories();
  };

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => {
      setCategories(d.categories);
      if (d.categories.length > 0) setImportCategory(d.categories[0].id);
    });
  }, []);

  const fetchQuestions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (keyword) params.set("keyword", keyword);
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    setQuestions(data.questions);
    setTotal(data.total);
  }, [page, activeCategory, typeFilter, keyword]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const totalPages = Math.ceil(total / 20);

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !importCategory) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("categoryId", importCategory);
    fd.append("importMode", importMode);
    const res = await fetch("/api/questions/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    fetchQuestions();
  };

  const toggleCheck = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === questions.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(questions.map((q) => q.id)));
    }
  };

  const batchDelete = async () => {
    if (checked.size === 0) return;
    if (!confirm(`确认删除 ${checked.size} 道题目？`)) return;
    setDeleting(true);
    await fetch("/api/questions/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(checked) }),
    });
    setChecked(new Set());
    setDeleting(false);
    fetchQuestions();
  };

  const typeLabel = (t: number) => t === 1 ? "判断" : "选择";
  const typeColor = (t: number) => t === 1 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div id="tour-q-header" className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">题库管理</h1>
          <p className="text-sm text-gray-500 mt-1">{total} 道题目</p>
        </div>
        <div className="flex gap-2">
          <Link href="/series" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">返回系列</Link>
          <GuideTourButton page="questions" />
          <button id="tour-q-import" onClick={() => { setShowImport(true); setImportResult(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">导入 Excel</button>
        </div>
      </div>

      {/* 分类 Tab */}
      <div id="tour-q-categories" className="flex gap-2 mb-4 flex-wrap items-center">
        <button onClick={() => { setActiveCategory("all"); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeCategory === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >全部</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => { setActiveCategory(c.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeCategory === c.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >{c.name}</button>
        ))}
        <button onClick={() => setShowCategoryMgr(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 transition">+ 管理分类</button>
      </div>

      {/* 搜索 + 筛选 */}
      <div id="tour-q-search" className="flex gap-3 mb-4">
        <input type="text" placeholder="搜索题目..." value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1.5">
          {[{ v: "all", l: "全部" }, { v: "1", l: "判断题" }, { v: "2", l: "选择题" }].map((t) => (
            <button key={t.v} onClick={() => { setTypeFilter(t.v); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition ${typeFilter === t.v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >{t.l}</button>
          ))}
        </div>
      </div>

      {/* 批量操作栏 */}
      {checked.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
          <span className="text-sm text-blue-700 font-medium">已选 {checked.size} 题</span>
          <button onClick={batchDelete} disabled={deleting}
            className="px-3 py-1 text-sm text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
          >{deleting ? "删除中..." : "批量删除"}</button>
        </div>
      )}

      {/* 题目列表 */}
      <div id="tour-q-table" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-3 py-3"><input type="checkbox" onChange={toggleAll} checked={questions.length > 0 && checked.size === questions.length} className="rounded" /></th>
              <th className="w-16 px-3 py-3 text-left text-gray-500 font-medium">ID</th>
              <th className="w-16 px-3 py-3 text-left text-gray-500 font-medium">题型</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">题目</th>
              <th className="w-24 px-3 py-3 text-left text-gray-500 font-medium">分类</th>
              <th className="w-32 px-3 py-3 text-left text-gray-500 font-medium">关键词</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => {
              const isExpanded = expandedId === q.id;
              const opts = [q.option1, q.option2, q.option3, q.option4].filter(Boolean) as string[];
              const answerLabels = ["A", "B", "C", "D"];
              return (
                <React.Fragment key={q.id}>
                  <tr className={`border-b border-gray-50 cursor-pointer transition ${isExpanded ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.has(q.id)} onChange={() => toggleCheck(q.id)} className="rounded" /></td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">#{q.id}</td>
                    <td className="px-3 py-2.5"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeColor(q.type)}`}>{typeLabel(q.type)}</span></td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-md truncate">{q.question_text}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{categories.find((c) => c.id === q.category_id)?.name || "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 truncate max-w-[120px]">{q.keywords || "-"}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={6} className="px-6 py-4 bg-gray-50/80">
                        <div className="grid grid-cols-[1fr_1fr] gap-6">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">题目</h4>
                              <p className="text-sm text-gray-800 leading-relaxed">{q.question_text}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">选项</h4>
                              <div className="space-y-1">
                                {opts.map((opt, i) => {
                                  const isCorrect = q.correct_answer.includes(answerLabels[i]);
                                  return (
                                    <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${isCorrect ? "bg-green-50 text-green-800 border border-green-200" : "bg-white text-gray-700 border border-gray-100"}`}>
                                      <span className="font-medium mr-2">{answerLabels[i]}.</span>
                                      {opt.replace(/【|】/g, "")}
                                      {isCorrect && <span className="ml-2 text-green-600 text-xs">✓ 正确</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {q.explanation && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-1">官方解析</h4>
                                <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg px-3 py-2 border border-gray-100">{q.explanation}</p>
                              </div>
                            )}
                            {(q.tip_display || q.tip_text) && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-1">答题技巧</h4>
                                <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">{q.tip_display || q.tip_text}</p>
                              </div>
                            )}
                            {q.cover_image && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-1">题目图片</h4>
                                <img src={q.cover_image} alt="" className="max-h-32 rounded-lg border border-gray-200" />
                              </div>
                            )}
                            <div className="flex gap-4 text-xs text-gray-400">
                              {q.source_id && <span>来源ID: {q.source_id}</span>}
                              <span>答案: {q.correct_answer}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {questions.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-gray-400">暂无题目，请先导入 Excel</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{total} 题 · 第 {page}/{totalPages} 页</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">上一页</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50">下一页</button>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">导入 Excel</h3>
            <div className="space-y-4">
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
                {importMode === "overwrite" && <p className="text-xs text-amber-600 mt-1">重复题目更新内容（解析、技巧等），新题插入</p>}
                {importMode === "replace" && <p className="text-xs text-red-500 mt-1">⚠ 将清空该分类下所有题目，再全量导入</p>}
              </div>
              <div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer" />
                <p className="text-xs text-gray-400 mt-1">支持 quanan 导出的标准模板格式 · <a href="/api/questions/template" className="text-blue-600 hover:underline">下载导入模板</a></p>
              </div>
              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p className="text-green-800 font-medium">导入完成</p>
                  <p className="text-green-700 mt-1">共 {importResult.total} 题，新增 {importResult.inserted} 题{importResult.updated ? `，更新 ${importResult.updated} 题` : ""}，跳过重复 {importResult.skipped} 题{importResult.deleted ? `，已清除旧题 ${importResult.deleted} 题` : ""}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-600">取消</button>
              <button onClick={handleImport} disabled={importing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
              >{importing ? "导入中..." : "开始导入"}</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryMgr && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCategoryMgr(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">管理分类</h3>
              <button onClick={() => setShowCategoryMgr(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 group">
                  {editingCat?.id === c.id ? (
                    <>
                      <input value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && updateCategory()} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                      <button onClick={updateCategory} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">保存</button>
                      <button onClick={() => setEditingCat(null)} className="px-2 py-1 text-xs text-gray-500">取消</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700">{c.name}</span>
                      <button onClick={() => setEditingCat({ id: c.id, name: c.name })} className="px-2 py-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600">编辑</button>
                      <button onClick={() => deleteCategory(c.id)} className="px-2 py-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600">删除</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t">
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="输入新分类名称..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={addCategory} disabled={!newCatName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
