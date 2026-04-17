# Aura 开发说明

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript / CSS
- 轻量自定义构建脚本

## 当前运行时结构

### `apps/extension/content.js`
- 顶层 content bootstrap
- 负责防重注入
- 动态加载 runtime controller

### `apps/extension/runtime/content-controller.js`
- 唯一运行时状态机
- 统一 `boot -> ready -> sync -> teardown`
- 协调 settings、site adapter、skin registry、status reporter

### `apps/extension/runtime/content-overlay.js`
- 角落挂件 DOM 结构
- 资源绑定
- 容器 position lock

### `apps/extension/runtime/content-lifecycle.js`
- video 事件绑定
- resize / mutation / fullscreen / visibility 监听
- storage onChanged 与 runtime message 唤醒

### `apps/extension/runtime/settings.js`
- `enabled / mode / themeMode / selectedSkinId` 单一设置 contract
- 旧字段兼容读取
- settings 读写与 toggle helper

### `apps/extension/runtime/status.js`
- 统一状态 contract
- popup 与 content 共享 pageUrl 归属判断
- content 状态写回 `chrome.storage.local`

### `apps/extension/runtime/site-adapters.js`
- 统一站点 adapter 接口：
  - `id`
  - `matchesUrl(url)`
  - `isPlaybackPage(url)`
  - `createDetector(context)`
- 当前只启用腾讯视频 adapter

### `themes/manifests/builtin-skins.json`
当前 Aura 的皮肤单一数据源：
- 默认皮肤
- 悬疑皮肤
- 古偶皮肤
- 热血皮肤

## 开发命令

### 构建

```bash
npm run build
```

### 监听开发

```bash
npm run dev
```

### 烟雾检查

```bash
npm run smoke
```

## 当前工程原则

1. `storage` 是唯一设置真相，message 只负责唤醒同步
2. popup / background 不再本地维护设置或站点判断副本
3. content runtime 只保留一条 teardown 路径
4. 皮肤以 `builtin-skins.json` 为单一事实源
5. 腾讯视频单站点先做稳，再扩其他平台

## 当前待推进项

- 腾讯视频页面的最终视觉联调与验收
- 继续细调右下角色在亮场和广告态下的存在感
- 建立更统一的皮肤模板与素材规范
- 逐步预留多站点 adapter 扩展点
