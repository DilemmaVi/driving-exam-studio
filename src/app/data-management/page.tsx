"use client";

import { useState, useEffect, useRef } from "react";

interface Stats {
  questionCount: number;
  seriesCount: number;
  categoryCount: number;
  ttsCacheCount: number;
  dictionaryCount: number;
  dbSize: number;
  uploadsSize: number;
  totalSize: number;
}

interface Manifest {
  appVersion: string;
  exportDate: string;
  questionCount: number;
  seriesCount: number;
  categoryCount: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataManagementPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/backup/stats").then((r) => r.json()).then(setStats);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? decodeURIComponent(match[1]) : "backup.zip";
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "备份导出成功" });
    } catch (e) {
      setMessage({ type: "error", text: "导出失败: " + (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setManifest(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/backup/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "验证失败" });
        setImportFile(null);
        return;
      }
      setManifest(data.manifest);
    } catch (e) {
      setMessage({ type: "error", text: "验证失败: " + (e as Error).message });
      setImportFile(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const res = await fetch("/api/backup/import?confirm=true", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "导入失败" });
        return;
      }
      setMessage({ type: "success", text: "导入成功，页面将自动刷新..." });
      setManifest(null);
      setImportFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setMessage({ type: "error", text: "导入失败: " + (e as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setManifest(null);
    setImportFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">数据管理</h1>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">数据概览</h2>
        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.questionCount}</div>
              <div className="text-xs text-gray-500 mt-1">题目</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.seriesCount}</div>
              <div className="text-xs text-gray-500 mt-1">视频系列</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.categoryCount}</div>
              <div className="text-xs text-gray-500 mt-1">分类</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.ttsCacheCount}</div>
              <div className="text-xs text-gray-500 mt-1">TTS 缓存</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.dictionaryCount}</div>
              <div className="text-xs text-gray-500 mt-1">发音词典</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{formatSize(stats.totalSize)}</div>
              <div className="text-xs text-gray-500 mt-1">数据大小</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-4">加载中...</div>
        )}
      </div>

      {/* Export */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">导出备份</h2>
        <p className="text-sm text-gray-500 mb-4">将题库、系列配置、设置等打包为 zip 文件（不含 TTS 音频和渲染视频）</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? "导出中..." : "导出备份"}
        </button>
      </div>

      {/* Import */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">导入备份</h2>
        <p className="text-sm text-gray-500 mb-4">从 zip 文件恢复数据（将覆盖现有所有数据）</p>

        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />

        {manifest && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">确认导入</h3>
            <div className="text-sm text-amber-700 space-y-1 mb-3">
              <div>版本: v{manifest.appVersion}</div>
              <div>导出时间: {new Date(manifest.exportDate).toLocaleString("zh-CN")}</div>
              <div>题目数量: {manifest.questionCount}</div>
              <div>系列数量: {manifest.seriesCount}</div>
            </div>
            <p className="text-xs text-red-600 font-medium mb-3">⚠️ 导入将覆盖所有现有数据，此操作不可撤销</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelImport}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {importing ? "导入中..." : "确认导入"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
