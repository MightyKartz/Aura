# Aura

Aura 是一个面向 Chrome 的观影氛围层插件，当前 V1 先适配腾讯视频。它会在影视剧播放器的上下黑边区域叠加 AI 氛围边框，做到：

> 不遮剧情，只加氛围。

## 当前状态

Aura 当前已完成：
- Chrome MV3 插件骨架
- 腾讯视频窗口态 / 全屏态黑边覆盖主链
- `Ctrl + Shift + A` 主快捷键切换
- 基础 Theme Registry
- popup 产品化第一版
- 默认 / 类型 / 剧集专属主题结构
- 《逐玉》专属 Aura 主题

## 目录结构

```text
Aura/
├── apps/extension/              # Chrome 插件主工程
├── packages/shared/             # 共享工具
├── packages/aura-engine/        # Aura 引擎占位
├── packages/theme-registry/     # 主题注册表辅助函数
├── themes/manifests/            # 主题清单 JSON
├── docs/                        # 文档
├── scripts/                     # 构建与开发脚本
├── dist/                        # 构建输出
└── AURA_MVP_PLAN.md             # MVP 方案
```

## 快速开始

### 1. 本地构建

```bash
cd /Users/kartz/Development/Aura
npm run build
```

### 2. Chrome 安装

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择 `dist/`

### 3. 使用方式

1. 打开腾讯视频播放页
2. 播放影视剧内容
3. Aura 会自动识别剧名与黑边区域
4. 使用 popup 调节主题与强度
5. 用快捷键快速开关

## 快捷键

- 主快捷键：`Ctrl + Shift + A`
- 辅助快捷键：`Option + Command + A`

## 主题系统

当前主题分为三层：
- 默认主题：腾讯默认 Aura
- 类型主题：古装仙侠 / 都市爱情 / 悬疑刑侦
- 剧集专属主题：逐玉 · 专属 Aura

## 当前限制

- 当前仅适配腾讯视频
- 主题 registry 仍在持续收口
- 远程主题分发尚未接入
- 更多剧集专属主题仍在补充

## 下一步重点

- 稳定 Theme Registry 刷新后的识别链
- 扩充首批剧集专属主题
- 增加设置页与用户偏好持久化
- 准备 Aura V1 对外演示版
