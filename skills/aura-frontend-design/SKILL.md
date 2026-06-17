---
name: aura-frontend-design
description: Aura 受约束的前端设计 skill。用于 popup、Skin Studio、官网/展示页等界面的视觉与交互打磨，但必须服从 Aura 的低打扰、可验证、单主链原则。不能替代 aura-karpathy-guidelines，也不能主导 runtime 或验收结论。
license: Derived adaptation; keep upstream anthropics/skills frontend-design attribution in project notes if redistributed externally.
---

# Aura Frontend Design

本 skill 基于 `anthropics/skills/frontend-design` 的思路改写，但它是 **Aura 约束下的设计增强层**，不是自由发挥的 UI 炫技器。

## 使用定位

这个 skill 只用于以下任务：
- `apps/extension/popup.html` / `popup.css` 的视觉与交互优化
- `apps/extension/skin-studio.html` / `skin-studio.css` 的布局、信息层级、预览体验优化
- Aura 官网、落地页、展示页、文档展示页面
- 设计稿转 Aura 风格前端代码

## 不适用范围

以下任务不要把本 skill 当主导：
- `content-controller` / `content-lifecycle` / `content-overlay` 运行时逻辑
- 腾讯视频页面适配
- 站点 detector / adapter
- 状态 contract、storage contract、message contract
- “功能是否通过”的最终验收判断
- 任何需要把局部证据升级成结论的任务

这些任务应由 `aura-karpathy-guidelines` 主导；本 skill 只能作为辅助手段。

## 加载顺序

在 Aura 中使用本 skill 时，默认顺序是：
1. 先读 `README.md`
2. 先读 `docs/engineering/DEVELOPMENT.md`
3. 先读 `docs/product/ROADMAP.md`
4. 再读当前任务相关设计 / QA 文档
5. 先加载 `aura-karpathy-guidelines`
6. 只有当前任务确实是 UI / 视觉 / 交互打磨时，再加载 `aura-frontend-design`

**结论：`aura-karpathy-guidelines` 是上位约束，`aura-frontend-design` 是下位增强。**

## Aura 设计目标

Aura 不是高打扰炫技型 UI，也不是花哨的 AI 仪表盘。Aura 当前设计目标是：
- 轻陪伴
- 低打扰
- 克制但不平
- 有气质，但不抢戏
- 可信、清楚、可操作

### 对 Aura 的直接约束

设计时必须保证：
- 不压过“观影陪伴”主语义
- 不做会分散剧情注意力的重动画、重发光、重闪烁
- 不为了“设计感”牺牲信息可读性
- 不为了“高级感”牺牲操作清晰度
- 不引入与当前任务无关的结构性重写

## Aura 视觉原则

### 1. 低打扰优先于高存在感
- 优先清楚、安静、可信
- 避免过强对比、过强发光、过强噪点、过强动效
- popup 和 Skin Studio 可以有氛围，但不能像独立潮流海报

### 2. 统一模板优先于局部炫技
- 优先强化 Aura 当前统一的视觉语言
- 不要让 popup、Skin Studio、未来官网各说各话
- 先收口字重、边框、圆角、色板、标签风格、卡片节奏

### 3. 信息层级优先于装饰层
- 用户首先要快速看懂：当前状态、皮肤、模式、调试信息入口
- 设计强化必须服务信息获取，而不是反过来遮蔽信息

### 4. 让“陪伴感”来自气质，不来自噪声
- 用细节、留白、柔和色阶、轻微层次感建立氛围
- 不依赖夸张动画或大量视觉特效来制造存在感

## 可参考的 Aura 审美方向

允许探索，但必须收敛到 Aura 主线：
- 轻雾感 / 夜色观影面板
- 温柔科技感 / 安静陪伴式控制面板
- 低照度影院感 / 克制发光
- 东方轻氛围 / 柔和角色化 UI

不建议直接滑向：
- 赛博霓虹大爆炸
- 仪表盘式高压信息密度
- 过度社交媒体卡片风
- 泛 AI SaaS 紫色渐变审美

## 字体与排版

- 优先延续 Aura 当前中文环境的可读性与克制感
- 若调整字体，先保证中文显示稳定、层级明确、尺寸合理
- 不为了“设计感”引入会破坏中文阅读体验的夸张显示字体
- 标题可以更有性格，但正文与状态信息必须稳

## 色彩与背景

- 优先基于 Aura 当前暗色、柔和高光、暖/冷局部点缀体系做增强
- 色彩应服务观影氛围，而不是制造视觉竞争
- 背景可以有层次、氛围、纹理，但应克制
- 不要把 popup 或 Skin Studio 做成过度复杂的插画背景页

## 动效原则

- 本 skill 只指导界面动效，不主导角色 runtime 动作
- UI 动效应轻、短、服务反馈
- 优先：hover、focus、切换、展开、状态变化的细节动效
- 避免：长时循环、频闪、抢注意力的大面积运动

## 布局原则

### popup
- 优先单屏内快速完成：状态确认、皮肤选择、模式切换、调试入口折叠
- 不要为了视觉实验打散当前核心操作流
- 任何布局改动都要回答：用户是否更快理解 Aura 当前状态？

### Skin Studio
- 优先预览效率、场景切换清楚、皮肤信息摘要清楚
- 舞台区始终是主角，侧栏是控制与摘要
- 不要把联调工具做成花哨展示站

## 输出要求

用本 skill 产出设计方案或代码时，至少说明：
1. 本次设计方向
2. 为什么它符合 Aura 的低打扰主线
3. 改动影响哪些文件
4. 哪些地方只是视觉调整，哪些地方影响交互
5. 已执行验证
6. 未执行验证

## 默认验证要求

若改动 popup / Skin Studio：
- `npm run build`
- `npm run smoke`
- 对应页面手动检查信息层级、操作路径、暗色对比度、可读性
- 如果有真实交互路径变化，补充说明具体验证方式

## 给 worker 的使用口径

### 给 impl-worker

```text
Load `aura-karpathy-guidelines` first. If the task is specifically about popup, Skin Studio, or Aura UI polish, then load `aura-frontend-design` as a secondary skill. Keep the Aura low-distraction principle above visual boldness.
```

### 给 review-worker

```text
Review under `aura-karpathy-guidelines` first, and use `aura-frontend-design` only to judge visual hierarchy, consistency, readability, and whether the UI polish still respects Aura's low-distraction product goal.
```

## 结束前必须回答的问题

1. 这次设计是否仍然服务 Aura 的“轻陪伴、低打扰”主线？
2. 这次视觉增强是否损害了信息清晰度或操作效率？
3. 是否为了设计感引入了不必要的结构复杂度？
4. 是否越界碰到了 runtime / 验收 / 主链 contract？
5. 是否明确区分了“视觉更好看”和“功能已验证”这两件事？
