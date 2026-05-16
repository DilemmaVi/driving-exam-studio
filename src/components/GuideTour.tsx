"use client";
import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_DONE_KEY = "guide-tour-done";

function getSeriesPageSteps() {
  return [
    {
      element: "#tour-header",
      popover: {
        title: "欢迎使用驾考视频工作室",
        description: "这是一个驾考短视频自动生成工具。系统能将题库自动转化为带语音讲解的短视频，接下来带你了解完整流程。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-create-btn",
      popover: {
        title: "第一步：创建视频系列",
        description: "点击这里新建一个视频系列。每个系列代表一组题目的合集，最终会渲染成一个完整视频。你需要填写系列名称和分类（如「小车科目一」「小车科目四」）。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-search",
      popover: {
        title: "搜索与筛选",
        description: "当系列变多时，可以通过名称搜索、分类筛选、排序来快速找到目标系列。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-series-grid",
      popover: {
        title: "系列列表",
        description: "所有创建的系列会显示在这里。每个卡片展示系列名称、分类、题目数量。点击卡片进入编排页面。",
        side: "top" as const,
      },
    },
    {
      popover: {
        title: "整体工作流程",
        description: "完整流程为：\n\n① 创建系列 → ② 添加题目并编排 → ③ 生成语音(TTS) → ④ 预览效果 → ⑤ 提交渲染 → ⑥ 获取视频\n\n接下来进入编排页面了解更多细节。",
      },
    },
  ];
}

function getEditorPageSteps() {
  return [
    {
      element: "#tour-question-bank",
      popover: {
        title: "题库面板",
        description: "左侧是题库，可以搜索和筛选题目。点击题目右侧的「+」按钮即可将题目添加到右侧的编排列表中。",
        side: "right" as const,
      },
    },
    {
      element: "#tour-selected-list",
      popover: {
        title: "编排列表",
        description: "右侧是当前系列已选的题目。可以拖拽排序，点击展开编辑每道题的详细配置。题目支持批量操作（全选后生成TTS等）。",
        side: "left" as const,
      },
    },
    {
      element: "#tour-batch-bar",
      popover: {
        title: "批量操作栏",
        description: "全选/取消、批量生成TTS语音、保存编排、提交渲染——所有关键操作都在这里。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-tts-btn",
      popover: {
        title: "生成TTS语音",
        description: "选择题目后点击「生成TTS」，系统会为题干、选项、答案、解析、技巧分别生成语音。语音生成完成后才能预览和渲染。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-save-btn",
      popover: {
        title: "保存编排",
        description: "修改了配置后记得保存。保存会将当前的题目顺序和所有配置写入数据库。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-render-btn",
      popover: {
        title: "提交渲染",
        description: "所有TTS就绪后，点击提交渲染。系统会在后台调用 Remotion 生成最终的短视频文件。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-question-expand",
      popover: {
        title: "展开题目配置",
        description: "点击题目可以展开详细配置面板，包含多种可自定义选项。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-config-section",
      popover: {
        title: "题目配置详情",
        description: "每道题可独立配置：\n\n• 字体大小（题干/选项/解析）\n• 选项间距\n• 变色延迟 & 速率（控制文字变色与语音同步）\n• 弹窗适配（解析面板出现时内容如何调整）\n• 题干关键字红色波浪线\n• 触发阶段（读题/解析/技巧）",
        side: "left" as const,
      },
    },
    {
      element: "#tour-prefix-delay",
      popover: {
        title: "变色延迟",
        description: "控制文字开始变色的延迟帧数。如果变色比语音快，增加延迟；如果慢，减少延迟。默认8帧。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-speed-ratio",
      popover: {
        title: "变色速率",
        description: "控制文字变色的整体速度。<1.0 变色更慢，>1.0 变色更快。配合延迟使用，让变色节奏完美匹配语音。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-panel-adjust",
      popover: {
        title: "弹窗适配",
        description: "当解析/技巧面板弹出时如何处理上方内容：\n\n• 自动上移：根据溢出量上移（推荐）\n• 自动缩小：等比缩放内容\n• 手动上移：指定上移像素\n• 不调整：保持原位",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-stem-keywords",
      popover: {
        title: "题干关键字波浪线",
        description: "输入关键字（逗号分隔），这些关键字会在指定阶段显示红色波浪下划线，帮助观众注意重点。",
        side: "top" as const,
      },
    },
    {
      element: "#tour-preview-btn",
      popover: {
        title: "预览视频",
        description: "TTS生成完成后，点击预览按钮可以实时查看视频效果，包括文字动画、语音同步、面板切换等。调整配置后可以反复预览直到满意。",
        side: "left" as const,
      },
    },
  ];
}

function getRendersPageSteps() {
  return [
    {
      element: "#tour-render-tabs",
      popover: {
        title: "渲染任务管理",
        description: "这里查看所有渲染任务的状态：进行中、已完成、失败。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-render-list",
      popover: {
        title: "任务列表",
        description: "每个任务显示系列名称、状态、进度和操作。已完成的任务可以下载视频文件。失败的任务可以查看错误信息并重试。",
        side: "top" as const,
      },
    },
  ];
}

export function useGuideTour(page: "series" | "editor" | "renders") {
  const startTour = useCallback(() => {
    let steps;
    switch (page) {
      case "series":
        steps = getSeriesPageSteps();
        break;
      case "editor":
        steps = getEditorPageSteps();
        break;
      case "renders":
        steps = getRendersPageSteps();
        break;
    }

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "guide-popover",
      nextBtnText: "下一步",
      prevBtnText: "上一步",
      doneBtnText: "完成",
      progressText: "{{current}} / {{total}}",
      steps,
      onDestroyStarted: () => {
        d.destroy();
      },
    });

    setTimeout(() => d.drive(), 300);
  }, [page]);

  return { startTour };
}

export function GuideTourButton({ page }: { page: "series" | "editor" | "renders" }) {
  const { startTour } = useGuideTour(page);

  return (
    <button
      onClick={startTour}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
      title="使用引导"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      使用引导
    </button>
  );
}
