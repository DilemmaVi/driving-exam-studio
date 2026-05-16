"use client";
import React, { useState } from "react";

interface Props {
  selectedCount: number;
  onBatchShowExplanation: (val: boolean) => void;
  onBatchShowTip: (val: boolean) => void;
  onBatchSpeechRate: (val: number) => void;
  onBatchThinkTime: (val: number) => void;
  onBatchDelete: () => void;
}

function Toggle({ label, onToggle }: { label: string; onToggle: (val: boolean) => void }) {
  const [on, setOn] = useState(true);
  const toggle = () => {
    const next = !on;
    setOn(next);
    onToggle(next);
  };
  return (
    <button onClick={toggle} className="flex items-center gap-1.5 text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition"
      style={{
        background: on ? "#ECFDF5" : "#F9FAFB",
        borderColor: on ? "#6EE7B7" : "#E5E7EB",
        color: on ? "#047857" : "#6B7280",
      }}
    >
      <span className="inline-block w-3 h-3 rounded-full border transition" style={{
        background: on ? "#10B981" : "#D1D5DB",
        borderColor: on ? "#059669" : "#9CA3AF",
      }} />
      {label}
    </button>
  );
}

export function BatchActionBar({
  selectedCount, onBatchShowExplanation, onBatchShowTip,
  onBatchSpeechRate, onBatchThinkTime, onBatchDelete,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-xl px-5 py-3 flex items-center gap-3 z-40 whitespace-nowrap">
      <span className="text-sm font-medium text-blue-600 shrink-0">已选 {selectedCount} 题</span>
      <div className="h-5 w-px bg-gray-200 shrink-0" />
      <Toggle label="解析" onToggle={onBatchShowExplanation} />
      <Toggle label="技巧" onToggle={onBatchShowTip} />
      <div className="h-5 w-px bg-gray-200 shrink-0" />
      <select onChange={(e) => { if (e.target.value) onBatchSpeechRate(Number(e.target.value)); e.target.value = ""; }} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 shrink-0" defaultValue="">
        <option value="" disabled>批量语速</option>
        <option value="0.8">0.8x</option>
        <option value="1.0">1.0x</option>
        <option value="1.2">1.2x</option>
      </select>
      <select onChange={(e) => { if (e.target.value) onBatchThinkTime(Number(e.target.value)); e.target.value = ""; }} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 shrink-0" defaultValue="">
        <option value="" disabled>批量思考时间</option>
        {[0, 1, 2, 3, 5, 8, 10].map((v) => <option key={v} value={v}>{v}秒</option>)}
      </select>
      <div className="h-5 w-px bg-gray-200 shrink-0" />
      <button onClick={onBatchDelete} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 shrink-0">删除选中</button>
    </div>
  );
}
