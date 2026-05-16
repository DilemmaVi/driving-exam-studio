# 文字水印功能设计

## 目标

在渲染的视频中叠加可配置的文字水印，兼顾品牌展示和防盗用。

## 配置项

全局设置（settings 表），所有视频统一应用：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| watermark_enabled | boolean | false | 水印开关 |
| watermark_text | string | "" | 水印文案（如 @账号名） |
| watermark_position | enum | bottom-right | 位置：top-left, top-right, bottom-left, bottom-right, center |
| watermark_opacity | number | 30 | 透明度 10-80 |
| watermark_font_size | enum | medium | 字体大小：small(28px), medium(36px), large(48px) |

## 组件设计

### `src/remotion/Watermark.tsx`

纯展示组件，接收配置 props，渲染定位文字。

Props:
- text: string
- position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center"
- opacity: number (10-80)
- fontSize: "small" | "medium" | "large"

渲染逻辑：
- `position: absolute` 定位到对应角落（边距 40px）
- 白色文字，opacity 由配置决定（值/100）
- `textShadow: "0 1px 3px rgba(0,0,0,0.5)"` 确保在浅色背景上可见
- 全程静态显示，无动画
- z-index 高于内容但低于 BottomPanel

### 集成点

在三个视频组件的 `<AbsoluteFill>` 内最后添加 `<Watermark />`：
- `src/remotion/MultipleChoice.tsx`
- `src/remotion/TrueFalseQuestion.tsx`
- `src/remotion/ScrollableQuestion.tsx`

条件渲染：仅当 `watermarkText` 非空时显示。

### 设置界面

在 `src/components/SettingsModal.tsx` 现有 tab 中添加水印配置区：
- 开关 toggle
- 文案输入框
- 位置下拉选择（5 选项）
- 透明度滑块（10-80）
- 字体大小选择（小/中/大）

### 数据流

1. SettingsModal 读写 `/api/settings`（现有 CRUD）
2. 渲染 API (`/api/render/route.ts`) 读取水印设置
3. 通过 inputProps 传入 Remotion composition
4. `DynamicCombinedExam.tsx` 将水印 props 透传给各题目组件

## 不做的事

- 图片 logo（仅文字）
- 全屏平铺（仅单点定位）
- 系列级别覆盖（仅全局）
- 水印动画效果
