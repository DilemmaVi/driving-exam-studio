import Link from "next/link";
import Image from "next/image";
import { FluidBackground } from "@/components/FluidBackground";

export default function Home() {
  return (
    <div className="relative flex items-center justify-center min-h-[calc(100vh-57px)] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
      <FluidBackground />
      <div className="relative z-10 text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-2xl">
            <Image src="/brand-logo.png" alt="全安驾考" width={88} height={88} className="rounded-xl" />
          </div>
          <h1>
            <span className="block text-4xl font-bold text-white tracking-wide">全安驾考</span>
            <span className="block text-lg font-medium text-indigo-300 mt-2">教学视频制作系统</span>
          </h1>
        </div>
        <p className="text-gray-400 text-sm max-w-md mx-auto">从题库选题，拖拽排序，实时预览，一键生成专业教学视频</p>
        <Link
          href="/series"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl text-lg font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
        >
          开始编排视频
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </Link>
      </div>
    </div>
  );
}
