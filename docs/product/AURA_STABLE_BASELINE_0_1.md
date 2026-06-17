# Aura Stable Baseline 0.1

> 日期：2026-04-27
> 状态：当前稳定开发基线
> 适用范围：Aura Chrome 插件主线

## 基线目标

本基线用于冻结 Aura 当前可持续迭代的事实状态，避免后续开发回到旧黑边、多帧动作或未收口的实验路线。

当前 Aura 的产品主线是：

> 腾讯视频优先的 Chrome 观影氛围插件，通过左上氛围位、右下角色位、单图低频动效和轻 utility 提升观影体验。

## 当前产品事实

- Aura 当前只官方支持腾讯视频 `v.qq.com`。
- Aura 不做视频黑边覆盖，不做播放器主体遮挡。
- Aura 不做 LLM 陪聊，不做字幕/弹幕语义驱动。
- Aura 不做多帧 actionFrames 主线。
- Aura 当前用高质量双角 PNG 皮肤建立产品识别。
- Aura 的第一收入方向应优先围绕皮肤包、模板定制和后续官方联名，而不是广告或观看数据。

## 当前技术事实

- 技术栈：Chrome Extension Manifest V3、原生 JavaScript、原生 CSS。
- 构建方式：轻量 Node 脚本复制扩展工程到 `dist/`。
- 入口：
  - `apps/extension/content.js`
  - `apps/extension/background.js`
  - `apps/extension/popup.html`
  - `apps/extension/skin-studio.html`
- 核心 runtime：
  - `apps/extension/runtime/content-controller.js`
  - `apps/extension/runtime/content-overlay.js`
  - `apps/extension/runtime/content-lifecycle.js`
  - `apps/extension/runtime/tencent-detect.js`
  - `apps/extension/runtime/site-adapters.js`
  - `apps/extension/runtime/status.js`
  - `apps/extension/runtime/settings.js`

## 当前 contract

### 设置 contract

当前设置以 `chrome.storage.sync` 为唯一真相：

```json
{
  "enabled": true,
  "mode": "quiet | standard | lively",
  "themeMode": "auto | manual",
  "selectedSkinId": "",
  "sizeScale": 1
}
```

### 皮肤 contract

当前皮肤以 `themes/manifests/builtin-skins.json` 为单一事实源。

每个皮肤必须使用双角单图资产：

```json
{
  "assets": {
    "topLeft": "themes/<skin>-top-left.png",
    "bottomRight": "themes/<skin>-bottom-right.png"
  }
}
```

硬约束：

- 内置皮肤必须使用 PNG RGBA。
- 不允许内置皮肤回退到 SVG 占位资源。
- 不允许重新引入 `motionAssets`、`blink`、`react`、`actionFrames`。
- 左上负责氛围和题材提示。
- 右下负责角色陪伴和轻交互。

### 站点 adapter contract

当前只启用腾讯视频 adapter，但接口为后续扩站保留：

```js
{
  id,
  label,
  matchesUrl(url),
  isPlaybackPage(url),
  createDetector(context)
}
```

## 当前内置皮肤

| ID | 名称 | 类型 | Motion |
| --- | --- | --- | --- |
| `cat-default-v1` | 默认小猫 | default | `soft` |
| `cat-suspense-v1` | 悬疑侦探 · 黑猫 | genre | `watchful` |
| `cat-rain-detective-v1` | 雨夜悬疑 · 黑猫侦探 | genre | `detective-cat` |
| `general-peach-guard-v1` | 文人将军 · 桃林守望 | character | `poetic-guard` |
| `lady-moon-fan-v1` | 古风贵女 · 月下执扇 | character | `graceful` |
| `cat-hotblood-v1` | 热血猫 | genre | `energetic` |

## 当前 utility

当前只保留低打扰观影 utility：

- 标记此刻
- 最近回看点
- 调大小
- 暂隐

能力策略：

- 只有当前播放器具备标准 `HTMLVideoElement.currentTime` 读取能力时，才显示“标记此刻”。
- 只有存在最近回看点并且当前播放器可 seek 时，才显示“回看”。
- 如果当前只是播放器壳或非标准 video，隐藏不可用动作，而不是弹失败提示。

## 当前验证门禁

基础门禁：

```bash
npm test
npm run build
npm run smoke
```

真实浏览器门禁：

```bash
npm run qa:extension
npm run qa:reload
```

注意：

- `npm run build`、`npm run qa:extension`、`npm run qa:reload` 都会重建 `dist/`。
- 不要并行运行这些命令，否则会出现 `dist/` 竞争。
- `qa:extension` 默认不截图；需要截图时使用 `AURA_QA_SCREENSHOTS=1 npm run qa:extension`。

## 当前已退休路线

以下路线不得作为当前 MVP 主线恢复：

- 黑边覆盖
- 主题边框全屏包边
- 多帧动作序列
- `blink/react/actionFrames`
- LLM 陪看评论
- 字幕/弹幕语义驱动反应
- 复杂宠物属性和进化系统
- 用户公开皮肤市场
- 多站点同时扩张

## 当前风险

- `content-controller.js` 仍承担较多职责，后续应逐步拆出 playback control、overlay action、utility summary 等边界。
- 新 PNG 资产质量高，但体积偏大，下一阶段需要建立皮肤体积预算。
- `cat-suspense-v1` 与 `cat-rain-detective-v1` 当前视觉接近，后续应决定合并或差异化。
- 腾讯页面选择器仍可能随站点更新漂移，需要继续用真实页面 QA 兜底。

## 下一步

按 [ROADMAP.md](/Users/kartz/Development/Aura/docs/product/ROADMAP.md) 的 Active 看板继续：

1. 更新 README / DEVELOPMENT 的皮肤清单。
2. 建立皮肤体积预算，压缩内置 PNG，并让 `smoke` 输出皮肤包总大小。
3. 进行真实腾讯视频手动验收。
4. 进入阶段 1 的交互面板和默认小猫打磨。
