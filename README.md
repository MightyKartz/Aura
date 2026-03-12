# Aura

Aura 是一个面向 Chrome 的浏览器插件 MVP，当前阶段先适配腾讯视频，目标是在播放器上下黑边区域叠加 AI 氛围边框，做到“不遮剧情，只加氛围”。

## 当前阶段
- 浏览器：Chrome
- 目标站点：腾讯视频
- 目标能力：视频检测、黑边覆盖、主题加载、开关控制

## 开发目录
- `apps/extension`：Chrome 插件主工程
- `packages/aura-engine`：视频检测、黑边估算、覆盖层引擎
- `packages/shared`：通用类型与工具
- `packages/theme-registry`：主题清单与缓存逻辑
- `themes/`：主题资源与 manifests
- `docs/`：产品、设计、工程文档

## 本地开发
当前工程先采用无外部构建器的轻量骨架，后续再按需要接入 Vite / Bun build / Plasmo。

主要命令：
- `npm run build`
- `npm run dev`

## Chrome 加载方式
1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 选择“加载已解压的扩展程序”
4. 选择 `dist/` 目录
