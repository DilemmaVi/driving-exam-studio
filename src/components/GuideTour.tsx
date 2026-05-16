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
        description: "左侧是题库。可以按关键字搜索、按分类筛选、按题型（判断/单选/多选）过滤。点击题目右侧的「+」将题目添加到编排列表。底部有翻页控制。",
        side: "right" as const,
      },
    },
    {
      element: "#tour-selected-list",
      popover: {
        title: "编排列表",
        description: "右侧是已选题目列表。顶部显示系列名称、分类标签、题目数量和预估时长。题目支持拖拽排序（按住⋮⋮图标）。",
        side: "left" as const,
      },
    },
    {
      element: "#tour-select-all",
      popover: {
        title: "全选与批量操作",
        description: "勾选「全选」或单独勾选题目后，可以在底部状态栏进行批量操作：批量设置是否显示解析/技巧、语速、思考时间，或批量删除。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-settings-btn",
      popover: {
        title: "系列全局设置",
        description: "点击齿轮图标打开全局设置面板。接下来将自动打开设置窗口，逐一介绍各个配置项。",
        side: "bottom" as const,
        onNextClick: () => {
          const btn = document.getElementById("tour-settings-btn");
          if (btn && !document.getElementById("tour-settings-modal")) {
            btn.click();
          }
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 400);
        },
      },
    },
    {
      element: "#tour-settings-modal",
      popover: {
        title: "设置 - 基本信息",
        description: "「基本信息」标签页配置：\n\n• 片头标题/副标题：视频开头显示的文字\n• 片尾标题/副标题：视频结尾显示的文字\n• 分类标签：显示在视频中的科目标签\n• MIMO API Key：TTS 语音合成的密钥",
        side: "bottom" as const,
        onNextClick: () => {
          const tab = document.getElementById("tour-settings-tab-视频风格");
          if (tab) tab.click();
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 300);
        },
      },
    },
    {
      element: "#tour-settings-modal",
      popover: {
        title: "设置 - 视频风格",
        description: "「视频风格」标签页配置：\n\n• 主题风格：清新浅色/专业深色/时尚渐变\n• 字体大小：自适应/小/中/大/超大\n• 头像位置：右下角/左下角/不显示\n• 头像大小：拖动滑块调整（160-360px）\n• 关键词样式：红圈/下划线/高亮底色\n• 底部面板高度：自适应/小/中/大\n\n右侧有实时预览窗口可以即时看到效果。",
        side: "bottom" as const,
        onNextClick: () => {
          const tab = document.getElementById("tour-settings-tab-语音设置");
          if (tab) tab.click();
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 300);
        },
      },
    },
    {
      element: "#tour-settings-modal",
      popover: {
        title: "设置 - 语音设置",
        description: "「语音设置」标签页配置：\n\n• 语速：稍慢/适中/稍快（TTS 生成速度）\n• 默认思考时间：答案揭示前等待秒数\n• 默认语音风格：教学/轻快/权威\n• 语速倍率：0.8x~1.3x 精细调节\n• 选项朗读：总是读/不读/按题干字数决定\n• 答案朗读：单选/多选是否读选项内容\n• 过渡话术：每个环节间的衔接语（如「大家先想一想」「公布答案」），可开关和自定义文案",
        side: "bottom" as const,
        onNextClick: () => {
          const tab = document.getElementById("tour-settings-tab-播放控制");
          if (tab) tab.click();
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 300);
        },
      },
    },
    {
      element: "#tour-settings-modal",
      popover: {
        title: "设置 - 播放控制",
        description: "「播放控制」标签页配置：\n\n• 显示过场页（想一想）：题目之间是否显示过渡动画\n• 视频开头停顿：首帧停留时间（0-10秒）\n• 视频结尾停顿：尾帧停留时间（0-10秒）\n• 技巧前停顿：解析结束到技巧开始的等待时间",
        side: "bottom" as const,
        onNextClick: () => {
          const tab = document.getElementById("tour-settings-tab-动画效果");
          if (tab) tab.click();
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 300);
        },
      },
    },
    {
      element: "#tour-settings-modal",
      popover: {
        title: "设置 - 动画效果",
        description: "「动画效果」标签页配置：\n\n• 朗读下划线进度：选择在哪些环节显示（题干/选项/解析/技巧），以及下划线颜色\n• 关键字闪动：讲解文本中【】标记的关键词是否有闪烁动画\n\n设置完成后点击「保存」按钮生效。",
        side: "bottom" as const,
        onNextClick: () => {
          // Close the settings modal
          const overlay = document.querySelector(".fixed.inset-0.bg-black\\/40");
          if (overlay instanceof HTMLElement) overlay.click();
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 300);
        },
      },
    },
    {
      element: "#tour-save-btn",
      popover: {
        title: "保存编排",
        description: "每次修改配置后需要手动保存。保存会将题目顺序、所有配置参数写入数据库。未保存的修改在刷新页面后会丢失。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-tts-btn",
      popover: {
        title: "生成语音 (TTS)",
        description: "为所有「待生成」状态的题目批量生成 TTS 语音。系统会为每道题分别生成：题干朗读、各选项朗读、答案揭示、官方解析、答题技巧的语音文件。生成完成后状态变为「就绪」。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-render-btn",
      popover: {
        title: "生成视频",
        description: "所有题目 TTS 就绪后才能点击。提交后系统在后台用 Remotion 渲染完整视频。渲染进度可在「渲染任务」页面查看。旁边的「只渲染技巧」按钮会生成只包含答题技巧部分的精简视频。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-question-expand",
      popover: {
        title: "展开题目配置",
        description: "点击「编排」按钮展开该题的详细配置面板。每道题都可以独立配置各种参数。点击「下一步」将自动展开。",
        side: "bottom" as const,
        onNextClick: () => {
          const btn = document.getElementById("tour-question-expand");
          if (btn && !document.getElementById("tour-config-section")) {
            btn.click();
          }
          setTimeout(() => {
            (window as any).__driverInstance?.moveNext();
          }, 400);
        },
      },
    },
    {
      element: "#tour-teacher-exp",
      popover: {
        title: "老师讲解文本",
        description: "这里编辑讲解文本。用【】包裹的文字会在视频中高亮显示并画红圈标注，用{}包裹的文字会以蓝色高亮。\n\n例如：注意【禁止标线】表示该区域{不允许}通行\n\n下方会实时预览高亮效果。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-show-toggles",
      popover: {
        title: "显示开关",
        description: "控制视频中是否包含「答题解析」和「答题技巧」环节。取消勾选后，对应的底部面板和语音都不会出现在视频中，视频时长也会相应缩短。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-params-row",
      popover: {
        title: "音频与排版参数",
        description: "• 思考时间：答案揭示前的等待秒数（给观众思考）\n• 语音风格：TTS 语气（教学/轻快/权威）\n• 选项朗读：是否朗读选项文字（长题干时可跳过）\n• 语速：TTS 朗读速度\n• 揭示停留：答案揭示后停留时间\n• 选项间距：选项之间的像素间距\n• 题干/选项/解析字号：各部分的字体大小",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-prefix-delay",
      popover: {
        title: "变色延迟",
        description: "控制文字开始变色的延迟帧数（30帧=1秒）。\n\n当变色跑在语音前面时，增加延迟；当变色落后语音时，减少延迟。默认8帧。\n\n这是精调参数，建议配合预览反复调整。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-speed-ratio",
      popover: {
        title: "变色速率",
        description: "控制文字变色的整体速度倍率。\n\n• <1.0（如0.8）：变色更慢\n• >1.0（如1.2）：变色更快\n\n当变色在开头匹配但中间偏移时，调整此值。配合「变色延迟」一起使用效果最佳。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-panel-adjust",
      popover: {
        title: "弹窗适配",
        description: "控制解析/技巧面板弹出时，上方题目内容如何调整：\n\n• 自动上移：计算溢出量，自动上移让选项可见（推荐）\n• 自动缩小：等比缩放内容到面板上方区域\n• 手动上移：自定义上移像素值\n• 不调整：保持原位（适合短题目）\n\n对于长题目建议用「自动上移」，短题目用「不调整」。",
        side: "bottom" as const,
      },
    },
    {
      element: "#tour-stem-keywords",
      popover: {
        title: "题干关键字波浪线",
        description: "输入关键字（逗号分隔多个），这些关键字会在视频中显示红色波浪下划线，帮助观众注意题干重点。\n\n例如输入：限速80km/h,105km/h\n\n下方「触发阶段」控制波浪线在哪些环节显示：\n• 读题：朗读题干时显示\n• 解析：解析面板时显示\n• 技巧：技巧面板时显示",
        side: "top" as const,
      },
    },
    {
      element: "#tour-preview-btn",
      popover: {
        title: "预览视频",
        description: "TTS 就绪后点击可实时预览该题的视频效果。预览窗口支持播放、暂停、拖动进度条。可以反复调整配置后预览，直到效果满意再提交渲染。\n\n旁边的「试听」按钮可以只听语音不看视频。",
        side: "left" as const,
      },
    },
    {
      popover: {
        title: "完整工作流程总结",
        description: "1️⃣ 从题库选题添加到编排列表\n2️⃣ 展开配置，编辑讲解文本和参数\n3️⃣ 点击「生成语音」生成 TTS\n4️⃣ 用「预览」检查效果，调整参数\n5️⃣ 满意后「保存」再「生成视频」\n6️⃣ 到「渲染任务」页面下载成品\n\n💡 提示：修改讲解文本或语音参数后需要重新生成 TTS；修改视觉参数（字号/间距/弹窗适配等）只需保存后直接预览或渲染。",
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
        (window as any).__driverInstance = null;
        d.destroy();
      },
    });

    (window as any).__driverInstance = d;
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
