import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/brand-logo.png" alt="全安驾考" width={80} height={80} className="rounded-xl" />
          <h1 className="text-3xl font-bold">
            <span className="text-blue-600">全安驾考</span>
            <br />
            <span className="text-xl font-medium text-gray-700">教学视频制作系统</span>
          </h1>
        </div>
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
