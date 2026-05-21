"use client";

import { useState } from "react";
import { changelog } from "@/lib/changelog";
import packageJson from "../../package.json";

interface Props {
  open: boolean;
  onClose: () => void;
  currentOnly?: boolean;
}

export function ChangelogModal({ open, onClose, currentOnly }: Props) {
  const [showAll, setShowAll] = useState(!currentOnly);
  const currentVersion = packageJson.version;

  if (!open) return null;

  const displayVersions = showAll
    ? changelog
    : changelog.filter((v) => v.version === currentVersion);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[560px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">更新日志</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {displayVersions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">暂无更新记录</p>
          )}
          {displayVersions.map((v) => (
            <div key={v.version}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-blue-600">v{v.version}</span>
                {v.version === currentVersion && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">当前</span>
                )}
                <span className="text-xs text-gray-400">{v.date}</span>
              </div>
              <ul className="space-y-1.5">
                {v.changes.map((change, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!showAll && changelog.length > 1 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              查看历史版本 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
