# Aura

Aura 是一个面向 Chrome 的观影氛围层插件，当前 V1 先打透腾讯视频。它会在播放器左上角和右下角挂载高质量双角角色皮肤，在不遮剧情的前提下增加陪看氛围。

> 不遮剧情，只加氛围。

## 当前状态

Aura 当前主链已收口到：
- Chrome MV3 插件骨架
- 腾讯视频窗口态 / 网页全屏 / 原生全屏角落挂件
- `Ctrl + Shift + A` / `Command + Shift + A` 快捷键切换
- 共享 runtime contract：设置、站点判断、状态写回、force-sync 消息
- `content bootstrap -> controller -> overlay/lifecycle` 运行时结构
- popup 产品化收口版
- 双角 PNG 皮肤 contract：`assets.topLeft` + `assets.bottomRight`
- 默认小猫 / 悬疑黑猫 / 雨夜黑猫 / 文人将军 / 古风贵女 / 热血灵兽六套内置皮肤
- 单图低频动效主线，`motionAssets` / `blink` / `react` / `actionFrames` 已退出当前运行时
- 轻 utility：标记此刻、最近回看点、调大小、暂隐
- 内置 `Skin Studio` 本地预览页，用于素材和动效联调

## 目录结构

```text
Aura/
├── apps/extension/              # Chrome 插件主工程
├── packages/aura-engine/        # 引擎方向占位说明
├── packages/theme-registry/     # 皮肤 registry 辅助函数
├── themes/manifests/            # 当前运行时皮肤清单
├── docs/                        # 当前文档与归档文档
├── scripts/                     # 构建、dev、smoke
├── skills/                      # 本地开发与协作 skills
└── dist/                        # 构建输出
```

## 快速开始

### 1. 本地构建

```bash
cd /Users/kartz/Development/Aura
npm run build
```

### 1.5. 本地预览皮肤台

```bash
npm run build
npm run preview
```

然后打开 `http://127.0.0.1:4173/skin-studio.html`。

### 2. Chrome 安装

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择 `dist/`

### 3. 使用方式

1. 打开腾讯视频播放页
2. 播放影视剧内容
3. Aura 自动识别播放器容器并挂载角落挂件
4. 使用 popup 调节皮肤、动效强度和挂件大小
5. 使用快捷键快速开关
6. 需要制作或验收皮肤时，可在 popup 中打开 `Skin Studio`

## 快捷键

- Windows / Linux：`Ctrl + Shift + A`
- macOS：`Command + Shift + A`

## 运行时结构

- `apps/extension/content.js`
  只负责顶层防重注入与加载 controller。
- `apps/extension/runtime/content-controller.js`
  负责唯一运行态流转：boot、ready、sync、teardown。
- `apps/extension/runtime/content-overlay.js`
  负责角落挂件 DOM、资源应用和容器锁定。
- `apps/extension/runtime/content-lifecycle.js`
  负责 video 监听、observer、storage/message 唤醒链。
- `apps/extension/popup.js`
  只负责设置读写、状态展示和皮肤选择。
- `apps/extension/background.js`
  只负责初始化、快捷键切换和当前页 force-sync / reinject。
- `apps/extension/skin-studio.html`
  独立皮肤预览页，用于在本地联调素材、边距和动效状态。

## 当前限制

- 当前仅官方支持腾讯视频
- 自动推荐仍主要依赖剧名和页面标签
- 广告态、亮场和极端布局仍需持续微调
- 所有内置皮肤当前走单图低频动效，不恢复多帧动作帧主线
- 远程皮肤分发尚未接入

## 文档说明

- 当前主线文档位于 `docs/product`、`docs/engineering`、`docs/design`
- 当前交付路线图位于 [ROADMAP.md](/Users/kartz/Development/Aura/docs/product/ROADMAP.md)
- 当前人物角色线方案位于 [AURA_CHARACTER_ROLE_LINE_V1.md](/Users/kartz/Development/Aura/docs/design/AURA_CHARACTER_ROLE_LINE_V1.md)
- 当前人物角色与热门剧气质映射策略位于 [AURA_CHARACTER_THEME_MAPPING_STRATEGY_V1.md](/Users/kartz/Development/Aura/docs/design/AURA_CHARACTER_THEME_MAPPING_STRATEGY_V1.md)
- 当前皮肤执行清单位于 [AURA_SKIN_EXECUTION_CHECKLIST_V1.md](/Users/kartz/Development/Aura/docs/design/AURA_SKIN_EXECUTION_CHECKLIST_V1.md)
- 当前 image2 皮肤生成工作流位于 [AURA_SKIN_GENERATOR_WORKFLOW.md](/Users/kartz/Development/Aura/docs/engineering/AURA_SKIN_GENERATOR_WORKFLOW.md)
- 当前稳定基线位于 [AURA_STABLE_BASELINE_0_1.md](/Users/kartz/Development/Aura/docs/product/AURA_STABLE_BASELINE_0_1.md)
- 当前盈利模式策略位于 [AURA_MONETIZATION_STRATEGY_V1.md](/Users/kartz/Development/Aura/docs/product/AURA_MONETIZATION_STRATEGY_V1.md)
- Aura 本地开发约束 skill 位于 [skills/aura-karpathy-guidelines/SKILL.md](/Users/kartz/Development/Aura/skills/aura-karpathy-guidelines/SKILL.md)
- Aura 受约束前端设计 skill 位于 [skills/aura-frontend-design/SKILL.md](/Users/kartz/Development/Aura/skills/aura-frontend-design/SKILL.md)
- Aura 多 agent 协作工作流位于 [docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md](/Users/kartz/Development/Aura/docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md)
- 旧黑边方案与历史探索已迁入 `docs/archive/`
