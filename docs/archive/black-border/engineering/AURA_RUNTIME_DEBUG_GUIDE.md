# Aura 运行时调试指南

## 目标

这份文档用于快速判断 Aura 在腾讯视频页面上的问题属于哪一层：

1. 播放上下文识别链
2. 黑边几何链
3. sync 调度链
4. 渲染链
5. 主题资产链

---

## 一、联调前检查

### 构建

```bash
npm run build
```

### Chrome 扩展重载

- 打开 Chrome 扩展管理页
- 重新加载 Aura 扩展
- 确认 `dist/` 为当前加载目录

### 打开目标页面

- 腾讯视频普通播放页
- 腾讯视频网页全屏
- 浏览器原生全屏

---

## 二、优先看 popup 的诊断字段

当前 popup 已可查看以下关键信息：

### 播放上下文
- 当前剧集
- 当前主题
- 推荐来源
- `playbackMode`
- `containerSource`

### 几何链
- `geometryStrategy`
- `letterboxTop` / `letterboxBottom`（通过状态摘要观察）
- `leftGap` / `rightGap`
- `intrinsicReady`

### 调度链
- `lastSyncReason`
- `syncReasons`
- `generation`
- `frameState`
- `childFrameHint`

### 渲染链
- `renderActive`
- `renderThemeId`
- `renderThemeSource`
- `renderOpacity`

### 资产链
- `assetStatus`
- `assetSource`
- `preview=present`

---

## 三、如何判断是哪一层出问题

## 1. 播放上下文识别链问题

### 典型现象
- 页面明明在播，但 Aura 完全不出现
- popup 中当前剧名识别异常
- `playbackMode` 长期显示异常
- `containerSource` 长期退回到弱 fallback

### 优先检查
- 是否正确识别到主 `video`
- `containerSource` 是否长期是 `parent-fallback` 或 `global-best`
- 普通播放 / 网页全屏 / 原生全屏下模式切换是否正常

### 当前目标状态
- 普通播放：`windowed`
- 网页全屏：`web-fullscreen`
- 原生全屏：`fullscreen`

---

## 2. 黑边几何链问题

### 典型现象
- top / bottom 高度明显不对
- 全屏切换时黑边高度乱跳
- 实际是左右补边，但 Aura 仍按上下黑边处理

### 优先检查
- `geometryStrategy` 是否为 `intrinsic`
- `leftGap` / `rightGap` 是否异常大
- `intrinsicReady` 是否一直为 false

### 解释
- `intrinsic`：最可信
- `rect-diff`：可接受 fallback
- `guessed`：兜底态，说明测量链还不够稳
- `unavailable`：几何链没拿到有效数据

---

## 3. sync 调度链问题

### 典型现象
- 页面静止时状态仍频繁刷新
- 全屏切换后短时间大量抖动
- popup 看起来一直在变

### 优先检查
- `lastSyncReason`
- `syncReasons`
- `generation`

### 当前预期
- 页面稳定后，poll 只做低频兜底
- mutation 不应持续打爆主链
- fullscreen 切换应快速收敛，而不是连续震荡
- 相同 DOM 态的重复 mutation 不应反复写状态

### 当前实现补充（2026-03-15 下午）
- mutation 现在会先做轻量 signature 去重，再按短延迟合并
- status 写入 `chrome.storage.local` 前会做 fingerprint 去重，避免 popup 被重复无意义刷新
- popup 已能直接看到 `frameState` / `childFrameHint`，用于判断是不是让位给子 frame 了

---

## 4. 渲染链问题

### 典型现象
- 识别和几何都正常，但页面上还是没效果
- 主题已切换，但视觉没有变化
- opacity 太低导致“像没生效”

### 优先检查
- `renderActive`
- `renderThemeId`
- `renderThemeSource`
- `renderOpacity`

### 判断方法
- `renderThemeId` 正确，但页面无变化：先查 DOM 应用链
- `renderActive=false`：先查 render plan
- `renderOpacity` 很低：先查强度与 fallback penalty

---

## 5. 主题资产链问题

### 典型现象
- show theme 逻辑命中了，但还是显示默认素材
- 当前主题可选，但 preview / 资产状态不清楚

### 优先检查
- manifest 中的 `assets.top` / `assets.bottom` / `assets.preview`
- `assetStatus`
- `assetSource`
- popup 中的 asset 信息

### 状态约定
- `placeholder`：逻辑位已准备，但还未接真实资产
- `ready`：真实资产已接入，可正式联调
- `missing`：逻辑存在，但资源缺失

---

## 四、《太平年》试点主题当前状态

当前 `tai-ping-nian` 已进入试点接入状态：

- theme id：`tai-ping-nian`
- 资产来源：Flow 首版生成 + Aura 本地切片
- 资产状态：`ready`
- 当前产物：
  - `apps/extension/themes/tai-ping-nian-top.png`
  - `apps/extension/themes/tai-ping-nian-bottom.png`
  - `apps/extension/themes/tai-ping-nian-preview.jpg`
  - `apps/extension/themes/tai-ping-nian-master.jpg`

如果页面效果不佳，优先判断：
1. 贴边不准
2. 字幕区污染
3. 主题过亮或过重
4. 需要重跑 Flow 候选图

---

## 五、推荐联调顺序

1. 普通播放页
2. 网页全屏
3. 浏览器原生全屏
4. 明亮场景
5. 暗场
6. 字幕密集场景

每一轮都先看 popup，再看页面实际视觉。

## 六、2026-03-15 真实页采样结论（腾讯视频《逐玉》）

已在真实页面采到两组关键样本：

### 窗口态
- 主播放器容器约 `698x393`
- `.thumbplayer-webvtt-overlay` 约 `698x267`
- 可近似反推出上下黑边约 `63 / 63`

### 原生全屏
- fullscreen 根为 `#main-player`
- 主播放器容器约 `1200x792`
- `.thumbplayer-webvtt-overlay` 约 `1200x460`
- 可近似反推出上下黑边约 `166 / 166`

### 工程结论
- 腾讯视频上，`#main-player` / `#player-component` / `.main-player-container` 这组主容器应提升优先级
- 在窗口态与原生全屏下，`.thumbplayer-webvtt-overlay` 比单纯 `video rect` 更能稳定代表“内容区矩形”
- `player__overlay--above-control` 更像控件区 overlay，适合作为次级候选，不宜压过字幕/内容区 overlay

## 七、2026-03-15 网页全屏 + 切集/刷新重进结论

### 网页全屏
- 腾讯视频网页全屏不是原生 `document.fullscreenElement`
- 页面主要通过 class 切换进入 fake fullscreen：
  - `body`: `tvplayer-fake-fullscreeen plugin_ctrl_fake_fullscreen`
  - `html`: `thumbplayer-fake-fullscreen plugin_ctrl_txp_mode_fullscreen`
- 此时 `#main-player` 会铺满视口，但真实内容区仍可能明显窄于容器
- 因此 Aura 不能只靠原生 fullscreen 判定，必须识别腾讯视频 fake fullscreen class

### 切集
- 切集后 URL 会切换到新的 episode 页面
- 标题链（`document.title` / `.player-play-title`）会正常切到新剧集
- 网页全屏态可在切集后继续保留

### 刷新重进
- 刷新后 episode 仍保持在当前集
- 但腾讯视频自身不会保留 fake fullscreen，页面会回到窗口态
- 这不应被 Aura 误判为 runtime 故障，而应视为站点行为

### 对 Aura 的直接要求
- root 挂载和 fullscreen-like 判定要同时覆盖：原生 fullscreen + 腾讯视频 fake fullscreen
- popup 诊断中的 `frameState` 应明确区分 `fullscreen` / `web-fullscreen` / `windowed`

## 七、当前工程原则

1. 黑边正确性优先于视觉花样
2. 运行时稳定优先于自动化程度
3. Flow 先做离线/半自动资产生产，不进入运行时主链
4. 腾讯视频单站点先做稳，再扩其他平台

---

## 六、当前工程原则

1. 黑边正确性优先于视觉花样
2. 运行时稳定优先于自动化程度
3. Flow 先做离线/半自动资产生产，不进入运行时主链
4. 腾讯视频单站点先做稳，再扩其他平台
