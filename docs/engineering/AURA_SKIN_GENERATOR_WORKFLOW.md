# Aura Skin Generator Workflow

这份流程把 Codex / image2 生成皮肤、素材验收、manifest 接入、Skin Studio QA 串成一条固定生产线。

目标不是让插件运行时调用模型，而是把 image2 变成 Aura 的内部皮肤工厂：生成素材在开发阶段完成，进入扩展时必须是本地、稳定、可审核的 PNG 资产。

## 适用范围

适用于新增或替换 Aura 双角皮肤：

- 左上角题材氛围：`assets.topLeft`
- 右下角主角色挂件：`assets.bottomRight`

不适用于：

- 插件运行时实时生图
- 用户在线 prompt 生成
- 右下替换帧 / 眨眼帧 / 反应帧
- 多帧整图动作序列
- 未审核的热门剧 IP 角色直出

## 生产原则

1. 先做 Aura 原创或气质映射，不直接复刻热门剧角色。
2. 每套皮肤只保留一个左上角标和一个右下主角色。
3. 右下角色使用单张高质量主图，避免替换帧串线、跳帧和卡顿风险。
4. 运行时只接入最终 PNG，不接入临时图、概念图或大母图。
5. 动效优先放在左上氛围层，例如花瓣、雾气、星点或雨丝，允许从左上向左侧中部缓慢延展。
6. 质量优先级固定为：透明干净 > 暗亮场可读 > 构图低打扰 > 画风细节。

## 目录约定

image2 候选图先放在临时目录，不直接进入运行时：

```text
tmp/skin-candidates/<skin-id>/
  prompt.md
  source-top-left.png
  source-bottom-right.png
```

通过验收后，最终运行时文件放入：

```text
apps/extension/themes/
  skin-<slug>-top-left.png
  skin-<slug>-bottom-right.png
```

## Step 1: 写皮肤 brief

每次生成前先写清楚这 8 项：

- `skinId`：例如 `general-peach-guard-v1`
- `slug`：例如 `peach-guard`
- `category`：`default | genre | character`
- `emotionalTarget`：例如克制守望、侦查感、温柔陪伴
- `topLeftRole`：左上是氛围/题材提示，不是第二主角，也不是文字信息板
- `bottomRightRole`：右下是陪看主体
- `motionPlan`：右下单图低频动效，左上氛围动效类型
- `copyrightBoundary`：原创 / 气质映射 / 不可用

## Step 2: image2 生成提示词

### 左上角标提示词模板

```text
Aura browser video companion skin, top-left corner atmosphere ornament only, [theme motifs],
small-to-medium diagonal ornament composition drifting from top-left toward left-middle,
transparent background, clean silhouette, semi-transparent soft edges,
no full scene, no poster, no text, no logo, no rectangular background,
readable on dark and bright video, cohesive with [bottom-right character style],
PNG cutout, 1:1 or 3:2, 1536x1536 or 1536x1024.
```

### 右下角色提示词模板

```text
Aura browser video companion skin, bottom-right companion character only,
[character description], [emotional target], half-body or leaning pose,
right-bottom corner ornament composition, transparent background,
clean silhouette, thin edge separation, no full scene background,
no text, no logo, no chibi unless the skin intentionally uses pet style,
no thick white outline, semi-transparent soft edges,
readable on dark and bright video, PNG cutout, 4:5, 1536x1920.
```

## Step 3: 候选素材硬检查

先用脚本检查候选素材是否满足进入项目的最低门槛：

```bash
npm run skin:check -- \
  --top-left tmp/skin-candidates/<skin-id>/source-top-left.png \
  --bottom-right tmp/skin-candidates/<skin-id>/source-bottom-right.png
```

脚本会检查：

- PNG 签名
- RGBA 色彩类型
- 左上是否为方图或安全横向氛围图
- 右下是否为 Aura 安全竖图比例

脚本不会替代人工检查：

- 是否有透明背景脏边
- 是否有黑底/白底残留
- 角色是否过大或抢戏
- 左上是否像调试标签而不是角标
- 风格是否统一

## Step 4: 人工 Go / No-Go

进入 manifest 前必须人工看这 6 点：

- 左上是否只是题材氛围，不抢播放器标题区
- 右下是否像陪看挂件，不像海报贴纸
- 暗场和亮场都能读出轮廓
- 透明边缘没有灰底、黑底、硬矩形
- 左上氛围元素不会像调试面板或文字标签
- 没有具体热门剧 IP 的高相似角色复刻

任何一项不通过，回到 image2 重新生成或清理，不进入 manifest。

## Step 5: 接入 manifest

只接入最终路径：

```json
{
  "id": "skin-id",
  "assets": {
    "topLeft": "themes/skin-slug-top-left.png",
    "bottomRight": "themes/skin-slug-bottom-right.png"
  }
}
```

注意：

- 不要写 `motionAssets`，右下替换帧已从当前主线退出。
- 不要写 `actionFrames`，整图多帧动作序列也已从当前主线退出。
- 不要让 manifest 指向 `tmp/`、`source-*`、`generated-*`。

## Step 6: Skin Studio QA

打开 Skin Studio 进行静态与状态检查：

```text
file:///Users/kartz/Development/Aura/apps/extension/skin-studio.html
```

必须检查：

- `windowed`
- `web-fullscreen`
- `native-fullscreen`
- `paused`
- `controlsVisible`
- `adActive`
- `attention`

验收目标：

- 左上不压标题
- 右下不压控件和字幕
- 回看点反馈在右下短暂出现，不占用左上原生标题区
- popup 的挂件大小滑杆在刷新后仍能记忆，并同时影响左上与右下
- 关闭状态没有残留

## Step 7: 项目门禁

每次接入后必跑：

```bash
npm test
npm run build
npm run smoke
npm run qa:extension
npm run qa:reload
```

如果只是生成候选素材，还没接 manifest，可以先只跑：

```bash
npm run skin:check -- --top-left <path> --bottom-right <path>
```

## 当前推荐路线

短期最优：

- 高质量静态主图
- 左上氛围动效，例如花瓣、雨丝、星点
- 右下单图低频呼吸、轻微位移、轻微 glow
- Skin Studio 和腾讯 QA 稳定后再考虑更复杂动作

暂不推荐：

- 右下 blink/react 替换帧
- 整图 cup-lift / pose sequence
- 运行时调用 image2
- 用户无审核 prompt 直接发布皮肤
- 热门剧角色高相似二创

## 完成定义

一套 image2 皮肤只有同时满足以下条件，才算进入 Aura：

- 候选素材通过 `npm run skin:check`
- 文件进入 `apps/extension/themes/` 且命名规范
- manifest 只引用最终路径
- `npm test && npm run build && npm run smoke` 通过
- Skin Studio 人工检查通过
- `npm run qa:extension` 至少覆盖目标皮肤一次
