import Link from "next/link";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">驾考视频制作系统</h1>
        <p className="text-gray-500">从题库选题，拖拽排序，实时预览，一键生成视频</p>
        <Link
          href="/series"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
        >
          开始编排视频
        </Link>
      </div>
    </div>
  );
}
