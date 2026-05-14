"use client";
import React from "react";

interface Props {
  selectedCount: number;
  onBatchShowExplanation: (val: boolean) => void;
  onBatchShowTip: (val: boolean) => void;
  onBatchSpeechRate: (val: number) => void;
  onBatchThinkTime: (val: number) => void;
  onBatchDelete: () => void;
}

export function BatchActionBar({
  selectedCount, onBatchShowExplanation, onBatchShowTip,
  onBatchSpeechRate, onBatchThinkTime, onBatchDelete,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-xl px-5 py-3 flex items-center gap-4 z-40">
      <span className="text-sm font-medium text-blue-600">已选 {selectedCount} 题</span>
      <div className="h-5 w-px bg-gray-200" />
      <button onClick={() => onBatchShowExplanation(true)} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">开启解析</button>
      <button onClick={() => onBatchShowExplanation(false)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">关闭解析</button>
      <button onClick={() => onBatchShowTip(true)} className="text-xs px-2.5 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100">开启技巧</button>
      <button onClick={() => onBatchShowTip(false)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">关闭技巧</button>
      <div className="h-5 w-px bg-gray-200" />
      <select onChange={(e) => { if (e.target.value) onBatchSpeechRate(Number(e.target.value)); e.target.value = ""; }} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" defaultValue="">
        <option value="" disabled>批量语速</option>
        <option value="0.8">0.8x</option>
        <option value="1.0">1.0x</option>
        <option value="1.2">1.2x</option>
      </select>
      <select onChange={(e) => { if (e.target.value) onBatchThinkTime(Number(e.target.value)); e.target.value = ""; }} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" defaultValue="">
        <option value="" disabled>批量思考时间</option>
        {[0, 1, 2, 3, 5, 8, 10].map((v) => <option key={v} value={v}>{v}秒</option>)}
      </select>
      <div className="h-5 w-px bg-gray-200" />
      <button onClick={onBatchDelete} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">删除选中</button>
    </div>
  );
}
