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
- `enabled / mode / themeMode / selectedSkinId / sizeScale` 单一设置 contract
- 旧字段兼容读取
- settings 读写与 toggle helper

### `apps/extension/runtime/status.js`
- 统一状态 contract
- 以 `pageUrl` 为粒度写入 scoped runtime status
- popup 只读取当前活动标签页对应的状态，不消费全局单值状态
- 旧全局 `STATUS_KEY` 仅做一次性迁移，不再作为运行时真相

### `apps/extension/runtime/site-adapters.js`
- 统一站点 adapter 接口：
  - `id`
  - `matchesUrl(url)`
  - `isPlaybackPage(url)`
  - `createDetector(context)`
- 当前只启用腾讯视频 adapter

### `themes/manifests/builtin-skins.json`
当前 Aura 的皮肤单一数据源。内置皮肤均使用 `PNG RGBA` 双角单图资产：

- `cat-default-v1`：默认小猫
- `cat-suspense-v1`：悬疑侦探 · 黑猫
- `cat-rain-detective-v1`：雨夜悬疑 · 黑猫侦探
- `general-peach-guard-v1`：文人将军 · 桃林守望
- `lady-moon-fan-v1`：古风贵女 · 月下执扇
- `cat-hotblood-v1`：热血猫

### `apps/extension/runtime/skin-contract.js`
- 皮肤 contract 校验入口
- 约束 `assets / palette / tags / recommendedMode / motionPreset`
- 当前运行时只接受双角单图素材，不再接入 `motionAssets`
- 供 runtime 加载和 smoke 校验复用

### `apps/extension/runtime/motion-presets.js`
- Aura 动效单一真相
- 将 `motionPreset + mode + visualState` 解析为统一 motion profile
- 输出给 overlay 的 CSS 变量和 motion state，右下挂件保持单图低频动效

### `apps/extension/skin-studio.html`
- 本地皮肤预览台
- 可作为扩展页使用，也可通过本地预览服务打开
- 用于联调素材尺寸、layout 状态和 motion preset 差异

## 开发命令

### 构建

```bash
npm run build
```

### 监听开发

```bash
npm run dev
```

### 本地预览服务

```bash
npm run build
npm run preview
```

默认地址：

```text
http://127.0.0.1:4173/skin-studio.html
```

### 烟雾检查

```bash
npm run smoke
```

当前 `smoke` 额外覆盖：
- 皮肤素材与构建产物完整性
- 内置皮肤必须使用 PNG 主资源
- retired 右下替换帧不会进入 source / dist
- popup / background 不重复定义 settings / site logic
- 旧全局状态向 scoped status 的迁移
- 多页面 status 并存时不会互相覆盖

## 皮肤开发流程

1. 按 [`docs/engineering/AURA_SKIN_GENERATOR_WORKFLOW.md`](/Users/kartz/Development/Aura/docs/engineering/AURA_SKIN_GENERATOR_WORKFLOW.md) 使用 image2 生成候选图
2. 按 [`docs/design/AURA_SKIN_IMAGE_SPEC_V2.md`](/Users/kartz/Development/Aura/docs/design/AURA_SKIN_IMAGE_SPEC_V2.md) 确认尺寸与构图
3. 参考 [`docs/design/AURA_SKIN_EXECUTION_CHECKLIST_V1.md`](/Users/kartz/Development/Aura/docs/design/AURA_SKIN_EXECUTION_CHECKLIST_V1.md) 明确左上和右下的角色分工
4. 使用 `npm run skin:check -- --top-left <path> --bottom-right <path>` 检查候选素材硬门槛
5. 将通过验收的最终素材放入 [apps/extension/themes](/Users/kartz/Development/Aura/apps/extension/themes)
6. 在 [themes/manifests/builtin-skins.json](/Users/kartz/Development/Aura/themes/manifests/builtin-skins.json) 中补齐：
   - `assets.topLeft`
   - `assets.bottomRight`
   - `palette`
   - `recommendedMode`
   - `motionPreset`
   - `tags`
7. 执行 `npm run build && npm run smoke`
8. 在 `popup -> 打开皮肤预览台` 或本地预览服务中检查窗口态、全屏态、广告态和控件浮现态

## 腾讯回归

- 手动验收清单见 [docs/engineering/TENCENT_QA_CHECKLIST.md](/Users/kartz/Development/Aura/docs/engineering/TENCENT_QA_CHECKLIST.md)
- 本地真实浏览器 QA：`npm run qa:extension`
- 扩展重载卡死回归：`npm run qa:reload`
- 注意：`npm run build`、`npm run qa:extension`、`npm run qa:reload` 都会重建 `dist/`，不要并行运行。

## 本地开发 skill

- 本地开发约束 skill 位于 [skills/aura-karpathy-guidelines/SKILL.md](/Users/kartz/Development/Aura/skills/aura-karpathy-guidelines/SKILL.md)
- Aura 受约束前端设计 skill 位于 [skills/aura-frontend-design/SKILL.md](/Users/kartz/Development/Aura/skills/aura-frontend-design/SKILL.md)
- 多 agent 协作工作流位于 [docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md](/Users/kartz/Development/Aura/docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md)
- `aura-karpathy-guidelines` 是上位工程约束；`aura-frontend-design` 仅用于 popup / Skin Studio / 官网等前端界面打磨
- 适用场景：runtime 改动、皮肤接入、popup 调整、review、bugfix、重构与收口任务
- 使用要求：开始判断当前状态前，先读 `README.md`、`docs/engineering/DEVELOPMENT.md`、`docs/product/ROADMAP.md` 以及当前任务对应设计/QA 文档
- 多 agent 默认口径：实现类任务优先交给 `impl-worker`，验证类任务优先交给 `review-worker`
- 页面分析、静默观察、局部证据不能直接升级为“功能已通过”

## 当前工程原则

1. `storage` 是唯一设置真相，message 只负责唤醒同步
2. popup / background 不再本地维护设置或站点判断副本
3. content runtime 只保留一条 teardown 路径
4. 皮肤以 `builtin-skins.json` 为单一事实源
5. 腾讯视频单站点先做稳，再扩其他平台

## 当前待推进项

- 先固化当前稳定基线，见 [AURA_STABLE_BASELINE_0_1.md](/Users/kartz/Development/Aura/docs/product/AURA_STABLE_BASELINE_0_1.md)
- 更新和维护 [ROADMAP.md](/Users/kartz/Development/Aura/docs/product/ROADMAP.md) 的 Active 任务看板
- 腾讯视频页面的最终视觉联调与验收
- 继续细调右下角色在亮场和广告态下的存在感
- 建立皮肤体积预算并压缩内置 PNG
- 逐步预留多站点 adapter 扩展点
