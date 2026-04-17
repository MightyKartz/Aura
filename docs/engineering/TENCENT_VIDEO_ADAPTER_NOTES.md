# 腾讯视频适配说明（当前主线）

## 目标

Aura 在腾讯视频上不再做黑边测量，而是稳定识别播放器容器，并把主题挂件锚定在容器左上角和右下角。

## 当前 adapter contract

- `id`: `tencent-video`
- `matchesUrl(url)`: 判断是否为腾讯视频页面
- `isPlaybackPage(url)`: 判断是否为腾讯视频播放页
- `createDetector(context)`: 创建腾讯视频检测器

## 当前检测策略

### 1. 站点判断
- 域名：`https://v.qq.com/*`
- 播放页规则：
  - `/x/cover/`
  - `/x/page/`
  - query 中包含 `vid` 或 `cid`
  - `txp/iframe-player.html`

### 2. 容器优先级
- 优先识别主播放器壳层，而不是单纯依赖 `video rect`
- 当前重点候选：
  - `#player-component`
  - `#main-player`
  - `.main-player-container`
  - `.main-player-wrapper`
  - `.txp_player` / `.txp-player`

### 3. 状态感知
- 控件出现时右下挂件上移并减弱
- 广告态下整体弱化
- 网页全屏与原生全屏使用同一条布局链

## 当前已完成

1. 腾讯视频 adapter 已接入共享 site contract
2. content runtime 与 popup/background 共用同一套站点判断
3. 快捷键与 popup 修改设置后会向当前页发送 `force-sync`
4. 关闭 Aura 时会立即清 overlay，并解绑目标监听，避免残留挂件

## 当前待验证

1. 普通播放页稳定显示
2. 网页全屏边距与控件避让稳定
3. 原生全屏下角落挂件不压控制区
4. 广告态弱化在真实页观感合理
