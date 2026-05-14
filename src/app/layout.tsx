import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "驾考视频制作系统",
  description: "选题、排序、预览、一键生成驾考教学视频",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-blue-600">
            驾考视频工作台
          </Link>
          <Link href="/series" className="text-sm text-gray-600 hover:text-gray-900">
            视频系列
          </Link>
          <Link href="/questions" className="text-sm text-gray-600 hover:text-gray-900">
            题库管理
          </Link>
          <Link href="/renders" className="text-sm text-gray-600 hover:text-gray-900">
            渲染任务
          </Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
