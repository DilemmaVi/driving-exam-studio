"use client";
import { useState, useEffect } from "react";

interface DictEntry {
  id: number;
  original: string;
  replacement: string;
  enabled: number;
  note: string;
}

export default function TtsDictionaryPage() {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [original, setOriginal] = useState("");
  const [replacement, setReplacement] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const load = () => fetch("/api/tts-dictionary").then(r => r.json()).then(setEntries);

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!original.trim() || !replacement.trim()) return;
    if (editingId) {
      await fetch("/api/tts-dictionary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, original, replacement, note }),
      });
      setEditingId(null);
    } else {
      const res = await fetch("/api/tts-dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original, replacement, note }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "保存失败");
        return;
      }
    }
    setOriginal("");
    setReplacement("");
    setNote("");
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("确认删除？")) return;
    await fetch(`/api/tts-dictionary?id=${id}`, { method: "DELETE" });
    load();
  };

  const toggle = async (entry: DictEntry) => {
    await fetch("/api/tts-dictionary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, enabled: !entry.enabled }),
    });
    load();
  };

  const startEdit = (entry: DictEntry) => {
    setEditingId(entry.id);
    setOriginal(entry.original);
    setReplacement(entry.replacement);
    setNote(entry.note || "");
  };

  const filtered = entries.filter(e =>
    !search || e.original.includes(search) || e.replacement.includes(search) || (e.note || "").includes(search)
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TTS 发音词典</h1>
          <p className="text-sm text-gray-500 mt-1">管理文本替换规则，在语音合成前自动应用</p>
        </div>
        <span className="text-sm text-gray-400">{entries.length} 条规则</span>
      </div>

      {/* Add/Edit form */}
      <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">原文</label>
            <input
              type="text" value={original} onChange={e => setOriginal(e.target.value)}
              placeholder="如：12分"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="text-gray-400 text-lg pb-2">→</div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">TTS 读作</label>
            <input
              type="text" value={replacement} onChange={e => setReplacement(e.target.value)}
              placeholder="如：十二分"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">备注（可选）</label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="为什么要替换"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
            {editingId ? "更新" : "添加"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setOriginal(""); setReplacement(""); setNote(""); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索词典..."
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">状态</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">原文</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">TTS 读作</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">备注</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => (
              <tr key={entry.id} className={`border-b hover:bg-gray-50 ${!entry.enabled ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(entry)} className={`w-8 h-5 rounded-full transition-colors ${entry.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${entry.enabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-red-600">{entry.original}</td>
                <td className="px-4 py-3 font-mono text-green-600">{entry.replacement}</td>
                <td className="px-4 py-3 text-gray-500">{entry.note}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(entry)} className="text-blue-600 hover:text-blue-700">编辑</button>
                  <button onClick={() => remove(entry.id)} className="text-red-500 hover:text-red-600">删除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                {search ? "无匹配结果" : "暂无词典规则，点击上方添加"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
