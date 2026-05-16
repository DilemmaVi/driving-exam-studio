"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Series {
  id: string;
  name: string;
  category: string;
  intro_title: string;
  intro_subtitle: string;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("updated_at");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [introTitle, setIntroTitle] = useState("");
  const [introSubtitle, setIntroSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const pageSize = 20;

  const fetchSeries = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
    if (keyword) params.set("keyword", keyword);
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await fetch(`/api/series?${params}`);
    const data = await res.json();
    setSeriesList(data.series || []);
    setTotal(data.total || 0);
    if (data.categories) setCategories(data.categories);
  }, [page, keyword, categoryFilter, sort]);

  useEffect(() => { fetchSeries(); }, [fetchSeries]);

  const totalPages = Math.ceil(total / pageSize);

  const createSeries = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), category: category.trim(), introTitle: introTitle.trim(), introSubtitle: introSubtitle.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.id) {
      setShowCreate(false);
      setName(""); setCategory(""); setIntroTitle(""); setIntroSubtitle("");
      router.push(`/editor/${data.id}`);
    }
  };

  const deleteSeries = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定删除此系列？")) return;
    await fetch(`/api/series/${id}`, { method: "DELETE" });
    fetchSeries();
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">视频系列</h1>
          <p className="text-gray-500 text-sm mt-1">{total} 个系列</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + 新建系列
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text" placeholder="搜索系列名称..." value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部分类</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="updated_at">最近更新</option>
          <option value="created_at">创建时间</option>
          <option value="question_count">题目数量</option>
        </select>
      </div>

      {/* Grid */}
      {seriesList.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">{keyword || categoryFilter ? "没有匹配的系列" : "还没有视频系列"}</p>
          <p className="text-sm">{keyword || categoryFilter ? "尝试调整筛选条件" : "点击「新建系列」开始创建"}</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {seriesList.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/editor/${s.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate">{s.name}</h3>
                  {s.category && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 mt-1.5 inline-block">{s.category}</span>}
                </div>
                <button
                  onClick={(e) => deleteSeries(s.id, e)}
                  className="text-gray-300 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                >
                  删除
                </button>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span className="font-medium text-gray-600">{s.question_count} 题</span>
                <span>{new Date(s.updated_at).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition">上一页</button>
          <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50 transition">下一页</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">新建视频系列</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">系列名称 *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：交通标识专题" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如：交通标识 / 科目一精选" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">片头标题</label>
              <input value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} placeholder="视频开头显示的标题" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">片头副标题</label>
              <input value={introSubtitle} onChange={(e) => setIntroSubtitle(e.target.value)} placeholder="副标题文字" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">取消</button>
              <button onClick={createSeries} disabled={!name.trim() || creating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40">
                {creating ? "创建中..." : "创建并编排"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
