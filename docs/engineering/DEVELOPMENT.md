# Aura 开发说明

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript / CSS
- 轻量自定义构建脚本

## 核心模块

### `apps/extension/content.js`
负责：
- 腾讯视频页面注入
- 视频/播放器检测
- 黑边估算
- Aura 上下层渲染
- 剧名识别
- 快捷键处理

### `apps/extension/popup.js`
负责：
- popup 交互
- 开关与强度控制
- 主题切换
- 状态信息展示

### `themes/manifests/builtin-themes.json`
当前 Aura 的主题单一数据源：
- 默认主题
- 类型主题
- 剧集专属主题

### `scripts/build.mjs`
构建流程：
- 复制 `apps/extension` 到 `dist/`
- 复制 theme registry helper 到 `dist/theme-registry/`
- 复制 `builtin-themes.json` 到 `dist/theme-registry/`

## 开发命令

### 构建

```bash
npm run build
```

### 监听开发

```bash
npm run dev
```

## 当前工程原则

1. 黑边识别优先正确性，再谈花哨视觉
2. 主题以 manifest 为单一事实源
3. popup 面向用户，调试信息默认折叠
4. 腾讯视频单站点先做稳，再扩其他平台

## 当前待推进项

- 进一步收口 Theme Registry 刷新后的识别链
- 增加设置页
- 扩展剧集专属主题
- 建立远程主题分发机制
