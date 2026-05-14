"use client";

import { useState, useEffect } from "react";
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
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [introTitle, setIntroTitle] = useState("");
  const [introSubtitle, setIntroSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const fetchSeries = async () => {
    const res = await fetch("/api/series");
    const data = await res.json();
    setSeriesList(data.series || []);
  };

  useEffect(() => { fetchSeries(); }, []);

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
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">视频系列</h1>
          <p className="text-gray-500 text-sm mt-1">创建和管理驾考教学视频系列</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          新建系列
        </button>
      </div>

      {seriesList.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">还没有视频系列</p>
          <p className="text-sm">点击"新建系列"开始创建</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {seriesList.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/editor/${s.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{s.name}</h3>
                  {s.category && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 mt-1 inline-block">{s.category}</span>}
                </div>
                <button
                  onClick={(e) => deleteSeries(s.id, e)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  删除
                </button>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>{s.question_count} 道题</span>
                <span>{new Date(s.updated_at).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

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
