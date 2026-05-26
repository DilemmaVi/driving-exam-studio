"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

interface ActiveTask {
  id: string;
  status: string;
  series_name?: string;
  phase_label?: string;
}

interface RenderStatusContextValue {
  activeTasks: ActiveTask[];
}

const RenderStatusContext = createContext<RenderStatusContextValue>({ activeTasks: [] });

export function RenderStatusProvider({ children }: { children: ReactNode }) {
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const prevStatuses = useRef<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const poll = async () => {
      try {
        const res = await fetch("/api/render?status=active&pageSize=50");
        const data = await res.json();
        const tasks: ActiveTask[] = data.tasks || [];
        setActiveTasks(tasks);

        const currentMap = new Map(tasks.map((t) => [t.id, t.status]));

        for (const [id, prevStatus] of prevStatuses.current) {
          if ((prevStatus === "tts" || prevStatus === "rendering" || prevStatus === "pending") && !currentMap.has(id)) {
            const doneRes = await fetch(`/api/render?taskId=${id}`);
            const doneTask = await doneRes.json();
            if (doneTask.status === "done") {
              const name = doneTask.series_name || id.slice(0, 8);
              setToast({ id, name });
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => setToast(null), 8000);

              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("渲染完成", { body: `${name} 已完成渲染` });
              }
            }
          }
        }

        prevStatuses.current = currentMap;
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <RenderStatusContext.Provider value={{ activeTasks }}>
      {children}
      {toast && (
        <div className="fixed top-16 right-6 z-50 animate-fade-in">
          <div className="bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3">
            <span>🎬 「{toast.name}」渲染完成</span>
            <Link href="/renders" className="underline font-medium hover:text-green-100">
              查看
            </Link>
            <button onClick={() => setToast(null)} className="text-green-200 hover:text-white ml-1">×</button>
          </div>
        </div>
      )}
    </RenderStatusContext.Provider>
  );
}

export function RenderStatusBadge() {
  const { activeTasks } = useContext(RenderStatusContext);

  if (activeTasks.length === 0) return null;

  const rendering = activeTasks.find((t) => t.status === "rendering" || t.status === "tts");
  const pending = activeTasks.filter((t) => t.status === "pending").length;

  return (
    <Link href="/renders" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 transition text-xs">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      {rendering ? (
        <span className="text-blue-700 font-medium max-w-[140px] truncate">{rendering.phase_label || "渲染中..."}</span>
      ) : (
        <span className="text-blue-700 font-medium">{pending} 个排队中</span>
      )}
    </Link>
  );
}
