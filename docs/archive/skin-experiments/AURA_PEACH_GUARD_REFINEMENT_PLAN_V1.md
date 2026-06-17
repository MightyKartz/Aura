# Aura 文人将军皮肤收口修改方案 V1

> 归档说明：这是多帧 `motionAssets / blink / react` 探索期文档，不代表当前 Aura MVP 主线。当前运行时已收口为双角单图素材，右下不再接入 blink/react/actionFrames。

> 状态：Draft for Implementation  
> 范围：`general-peach-guard-v1` 皮肤的资产、运行时布局、信息层、动效收口  
> 方法说明：本轮按“代码主链 + 资产 contract + 视觉投影”的方式分析。`flow-coding-guardrails` skill 当前会话不可用，因此采用同等粒度的结构化工程分析替代。

## 1. 结论摘要

当前 `文人将军 · 桃林守望` 的问题不是单点 bug，而是四条链同时未收口：

1. `asset chain`
   - `base / blink` 没有统一的同构图 contract
2. `layout chain`
   - character 默认尺寸模板偏大，右下挂件存在感过强
3. `info-layer chain`
   - 左上把内部语义字段直接投影成常驻 UI，像调试面板
4. `motion chain`
   - 角色动作仍是“通用挂件 motion + 一张 blink 帧”，人物行为语言没有成立

因此不能只靠改一处 CSS 收口。需要同时改：
- 资产规范
- 皮肤 manifest / contract
- overlay 呈现逻辑
- 左上信息层投影规则
- 人物 motion preset

## 2. 当前问题与代码根因映射

## 2.1 右下出现双影 / 双角色串帧

### 现象

截图中右下同时能看到睁眼和闭眼两个将军，说明 `base` 和 `blink` 不是“同图层切换”，而是“不同画布内容叠加”。

### 代码层根因

#### A. 素材尺寸和锚点不一致

当前生产资产尺寸：
- `skin-peach-guard-bottom-right.png`：`521 x 584`
- `skin-peach-guard-bottom-right-blink.png`：`538 x 507`

这两个文件：
- 画布尺寸不一致
- 宽高比不一致
- 人物在画布中的锚点不一致

而 [content-overlay.js](/Users/kartz/Development/Aura/apps/extension/runtime/content-overlay.js) 会把 `base` 和 `blink` 当成完全同槽位图片叠加：
- `bottom-right-base`
- `bottom-right-blink`

二者最终都通过 `.aura-ornament__image { inset: 0; width: 100%; height: 100%; object-fit: contain; }` 投影到同一个容器中，见 [content.css](/Users/kartz/Development/Aura/apps/extension/content.css)。

只要源图：
- 宽高比不同
- 角色在画布中的落点不同

就一定会出现“blink 不是在 base 上眨眼，而是在旁边叠出第二个人”。

#### B. 运行时没有校验“帧同构图 contract”

[skin-contract.js](/Users/kartz/Development/Aura/apps/extension/runtime/skin-contract.js) 目前只校验：
- 文件存在
- `motionAssets.bottomRight.blink` 是合法字段

但没有校验：
- `base / blink / react` 是否同尺寸
- 是否共享相同 anchor box
- 是否符合“帧替换而非独立插画” contract

#### C. CSS blink 逻辑默认就是覆盖层，不会自动对齐

[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 中：
- `.aura-ornament__image--blink` 通过 `opacity` 动画覆盖到 `base` 上
- 它不会帮我们做任何几何对齐，只会按当前画布比例直接叠加

所以这不是 CSS bug，本质是 `asset contract 缺失`。

### 结论

这是 P0，必须优先修。

## 2.2 右下挂件 still 太大，存在感过强

### 现象

右下将军已经接近“角色贴纸”，而不是“低打扰陪看挂件”。

### 代码层根因

#### A. character 默认布局参数过大

[layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js) 中 `character` profile 当前为：

- `bottomWidthRatio.windowed = 0.2`
- `bottomWidthRatio.compact = 0.214`
- `bottomWidthBounds = [196, 320]`

这意味着：
- 在桌面宽播放器下，人物挂件会被推到很大的视觉尺寸
- 对比默认猫的 `0.14 ~ 0.15`，character 被整体放大了一档以上

#### B. presentational scale 进一步放大存在感

`computeStatePresentation()` 中默认：
- `bottomLayoutScale = 0.98`

而 motion 中：
- `scalePeak` 对 `watchful / ancient-general` 仍有放大
- `drop-shadow`、`backdrop`、`sparkle` 继续抬高存在感

#### C. 视觉参数仍沿用“猫 / 悬疑猫”的强调思路

[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 对底部图片统一使用：
- `drop-shadow`
- 高亮 `glow`
- 比较厚的白描边素材

而新漫画风将军本身：
- 本体面积更大
- 描边更显眼
- 明暗对比更强

所以“统一效果参数”叠到角色皮肤上后，会让人物比猫更抢眼。

### 结论

当前不是单纯“图太大”，而是：
- 布局比例偏大
- 人物素材占画布比例偏大
- 统一 glow / outline / opacity 策略没有分角色类型

## 2.3 左上信息层像调试面板，不像产品 UI

### 现象

左上当前常驻内容包括：
- `桃林守望`
- `桃枝 · 月影`
- `文人将军 · 执杯`
- `回看点 00:05`

这更像状态标签堆叠，不像成熟产品的陪看信息层。

### 代码层根因

#### A. info-layer 把内部结构字段直接全量暴露

[info-layer.js](/Users/kartz/Development/Aura/apps/extension/runtime/info-layer.js) 当前输出：
- `semanticLabel`
- `atmosphereLabel`
- `narrativeLabel`
- `utilityLabel`
- `metaLabel`
- `promptText`

这是完整调试视图，不是产品视图。

#### B. narrative 和 atmosphere 直接来自内部语义字段

[character-theme.js](/Users/kartz/Development/Aura/apps/extension/runtime/character-theme.js) 中：
- `getCharacterThemeAtmosphereLabel()` 直接把 `motifs` 拼成 `桃枝 · 月影`
- `getCharacterThemeNarrativeLabel()` 直接把 `role + prop` 拼成 `文人将军 · 执杯`

这类字符串适合：
- 调试
- 方案验收
- 设计对照

不适合直接作为常驻用户 UI。

#### C. CSS 默认“只要有值就显示”

[content-overlay.js](/Users/kartz/Development/Aura/apps/extension/runtime/content-overlay.js) 中 `applyInfoLayer()` 会把所有字段写入；  
[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 中所有 `.is-visible` 默认都会显示。

这意味着当前没有“产品层 display policy”。

### 结论

问题不是文案措辞不好，而是：
- 缺了“结构字段 -> 用户展示字段”的第二层投影

## 2.4 左上整体过密，和播放器原生标题区打架

### 现象

左上同时叠了：
- 腾讯原生标题区
- Aura 角标
- Aura 多层文本 chip

它已经从“氛围位”滑向“信息位”。

### 代码层根因

#### A. 左上尺寸和信息层都偏积极

[layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js) 中 `character` 的左上参数：
- `topWidthRatio.windowed = 0.112`
- `topWidthBounds = [104, 176]`

这本身就不算保守。

#### B. 左上信息容器占用过大

[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 中：
- `.aura-ornament__info { top: 5%; left: 5%; gap: 5px; max-width: 88%; }`

在左上图块本来就不大的情况下，再叠 3 到 5 行 chip，必然变成密集信息区。

#### C. 没有做“原生 UI 竞争区”规避

当前 runtime 只识别：
- 控件区
- 广告态

没有识别腾讯左上标题信息区，也没有“当左上原生标题明显时，Aura 左上自动降级”逻辑。

### 结论

这是 `display policy + layout policy` 的缺失，不是单纯的 spacing 问题。

## 2.5 人物风格升级了，但和当前左上徽记还没完全统一

### 现象

右下已经是“漫画风俊朗将军”，左上仍然更像“装饰徽记 + sticker 气质”。

### 代码层根因

#### A. 运行时只知道“一个 topLeft 图片 + 一个 bottomRight 图片”

当前 manifest 只表达：
- `assets.topLeft`
- `assets.bottomRight`

见 [builtin-skins.json](/Users/kartz/Development/Aura/themes/manifests/builtin-skins.json)。

运行时并不知道：
- 两者是否属于同一风格族
- 左上是否需要更写实 / 更漫画化
- 左上是“纯 motif badge”还是“角色延伸纹章”

#### B. 左上叠加的 backdrop 和 sparkle 会进一步把它推向“装饰件”

[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 对左上统一增加了：
- charm 漂浮动画
- 发光 backdrop
- sparkle glint

这套语言对默认猫和悬疑猫成立，但对“漫画风人物”来说，会放大 sticker 感。

### 结论

问题不是“左上画得不好”，而是：
- 缺少 `skin style family` 或 `topLeft render tone` 这种运行时 contract

## 2.6 角色气质是对的，但动作感还不成立

### 现象

用户能看出这是“文人将军”，但还感受不到“他在陪你一起看”。

### 代码层根因

#### A. ancient-general 仍在复用通用 watchful 骨架

[character-theme.js](/Users/kartz/Development/Aura/apps/extension/runtime/character-theme.js) 中：
- `ancient-general -> watchful`

但 `watchful` 这个 preset 原本是从悬疑猫的“观察感”逻辑扩出来的，不是从人物角色行为语言长出来的。

#### B. ancient-general patch 太弱，且主动关闭 react

当前 `ancient-general` patch 只做了：
- backdrop / sparkle 微调
- `driftPx` / `liftPx` / `scalePeak` 轻微调整
- `frameBehavior.reactEnabled = false`

这意味着：
- 没有角色专属 react 行为
- 没有“抬眸 / 视线收束 / 杯沿微停 / 肩甲扫光”这类人物动作

#### C. 目前只有 blink，没有 react

manifest 中 `general-peach-guard-v1` 目前只接了：
- `motionAssets.bottomRight.blink`

没有：
- `react`

所以 attention 态不会进入一个真正有识别性的角色动作。

#### D. CSS 动效仍以“呼吸 + 倾斜 + 漂浮”为主

[content.css](/Users/kartz/Development/Aura/apps/extension/content.css) 中底部主链仍主要依赖：
- `auraBottomBreathe`
- `auraBottomTilt`

这对宠物和轻挂件有效，但对人物角色而言太泛化。

### 结论

当前人物 motion 的问题不是“没有动画”，而是：
- 动作存在
- 但没有建立人物专属行为语言

## 3. 根因分层

综合来看，这 6 个问题可以收敛成 4 类根因。

### 3.1 资产 contract 缺失

缺失内容：
- `base / blink / react` 同尺寸
- 同 anchor box
- 同裁切基线
- 同 outline 强度

### 3.2 角色皮肤没有独立的 layout/presentation 模板

当前 `character` 只比默认猫大一档，但没有细分：
- `manga-character`
- `soft-character`
- `badge-light`

### 3.3 左上缺失产品态投影规则

当前是：
- `结构字段 = 展示字段`

应该改成：
- `结构字段 -> display policy -> 展示字段`

### 3.4 人物 motion 仍挂在通用 ornament motion 上

当前是：
- `通用挂件运动 + 一张 blink 图`

应该改成：
- `人物角色专属 motion preset + 角色帧 contract + 角色触发规则`

## 4. 修改目标

本轮修改目标固定为：

1. 修掉右下 blink 串帧
2. 让右下将军收成“低打扰陪看挂件”
3. 让左上回到“氛围位 + 少量轻信息”
4. 让文人将军形成最小但成立的人物动作语言

## 5. 实施方案

## 5.1 Phase 1：修资产 contract 与串帧

### 要改什么

1. 为 `bottomRight base / blink / react` 建立统一帧规范
2. 在运行时和测试中显式校验
3. 重新导出 `peach-guard` 的 `base / blink`

### 具体改动

#### A. 新增帧一致性校验

修改 [skin-contract.js](/Users/kartz/Development/Aura/apps/extension/runtime/skin-contract.js)：
- 对于存在 `motionAssets.bottomRight.blink/react` 的皮肤，新增“资产一致性检查”
- 检查项至少包括：
  - 文件存在
  - base / blink / react 维度一致
  - 宽高比一致

第一阶段先做维度一致性；anchor box 一致性作为生产规范写入文档和测试夹具。

#### B. 为 peach-guard 重新出一组严格同构图帧

要求：
- `base` 与 `blink` 使用相同画布尺寸
- 角色轮廓和手部位置完全一致
- 只允许眼部和极少数面部细节变化

#### C. 调整 overlay 在缺 frame contract 时的降级策略

修改 [content-overlay.js](/Users/kartz/Development/Aura/apps/extension/runtime/content-overlay.js)：
- 若 `blink` 与 `base` 的宽高比不一致，则运行时直接禁用该 blink frame
- 不允许“错误 blink 帧硬叠加显示”

### 验收标准

- 同一时刻不会再看到双角色
- blink 只表现为眼部变化，不发生角色轮廓跳动

## 5.2 Phase 2：收右下尺寸、亮度和存在感

### 要改什么

1. 单独收 character 布局模板
2. 单独收 peach-guard 的 presentational tone

### 具体改动

#### A. 下调 character 默认底部宽度

修改 [layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js)：

把当前：
- `windowed: 0.2`
- `compact: 0.214`
- `bounds: [196, 320]`

建议调整为：
- `windowed: 0.17`
- `compact: 0.182`
- `bounds: [176, 276]`

并保留广告态 / 控件态上移逻辑。

#### B. 引入 skin-level presentation profile

建议在 manifest 或 runtime resolver 中增加轻量字段，例如：

```json
"presentation": {
  "bottomScale": 0.94,
  "imageBrightness": 0.96,
  "glowStrength": 0.72,
  "outlineTone": "soft"
}
```

第一阶段不必把字段铺到所有皮肤，只先让 `general-peach-guard-v1` 使用。

#### C. 降低人物默认 opacity 和 glow

修改：
- [layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js)
- [content.css](/Users/kartz/Development/Aura/apps/extension/content.css)

收口方向：
- bottomOpacity 再降低一档
- drop-shadow 弱化
- 对 `character` 类型减轻 glow/backdrop

### 验收标准

- 右下挂件在黑场中存在但不抢戏
- 字幕和角色之间不再有“贴纸压画面”的感觉

## 5.3 Phase 3：重做左上 display policy

### 要改什么

把左上从“结构字段调试台”改成“产品态展示层”。

### 具体改动

#### A. info-layer 不再默认全量显示

修改 [info-layer.js](/Users/kartz/Development/Aura/apps/extension/runtime/info-layer.js)：

新增一个 display policy，例如：

```js
{
  semanticLabel,
  utilityLabel,
  promptText,
  showAtmosphere: false,
  showNarrative: false,
  showMeta: false
}
```

对 `character` 皮肤默认规则改成：
- 常驻：`semanticLabel`
- 次级常驻：`utilityLabel` 仅有值时显示
- `promptText` 触发式短暂显示
- `atmosphereLabel / narrativeLabel / metaLabel` 默认不向用户显示

#### B. 把 narrative/atmosphere 留作调试字段，不再直接进入产品 UI

保留状态上报和 Skin Studio 调试，但不再在播放页常驻。

#### C. 语义文案改成用户态

对于 `桃林守望`，用户态只保留：
- `桃林守望`
- `回看点 00:05`

不再显示：
- `桃枝 · 月影`
- `文人将军 · 执杯`

### 验收标准

- 左上常驻不超过 2 行
- 用户一眼能理解，不像开发标签堆叠

## 5.4 Phase 4：降低左上与腾讯原生标题区冲突

### 要改什么

1. 缩左上
2. 减少左上文本行数
3. 加入标题区竞争规避

### 具体改动

#### A. 左上尺寸再收一档

修改 [layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js)：

对 `character` 皮肤左上建议收成：
- `windowed: 0.096`
- `compact: 0.09`
- `bounds: [92, 148]`

#### B. 左上信息容器缩窄并减少 gap

修改 [content.css](/Users/kartz/Development/Aura/apps/extension/content.css)：
- `max-width` 从 `88%` 收到 `72% ~ 76%`
- `gap` 从 `5px` 收到 `3px`
- chip padding 稍微减薄

#### C. 新增“标题竞争区”策略

在 Tencent detector 或 layout 层新增：
- 如果左上标题区明显存在，则 Aura 左上文本层自动降级为只显示 `semanticLabel`
- 最极端时只保留图形角标，不保留任何文字

### 验收标准

- 腾讯原生标题区可正常阅读
- 左上 Aura 不再像第二套 UI 系统

## 5.5 Phase 5：统一漫画风人物与左上徽记的风格

### 要改什么

1. 给皮肤增加 style family 概念
2. 让左上渲染 tone 可按角色类型收口

### 具体改动

#### A. skin manifest 增加风格字段

建议在 [builtin-skins.json](/Users/kartz/Development/Aura/themes/manifests/builtin-skins.json) 中增加：

```json
"styleFamily": "manga-character"
```

或：

```json
"topLeftTone": "ornament-comic"
```

#### B. runtime 按 style family 调整 top-left effect

修改：
- [content.css](/Users/kartz/Development/Aura/apps/extension/content.css)
- [content-overlay.js](/Users/kartz/Development/Aura/apps/extension/runtime/content-overlay.js)

对 `manga-character`：
- 降低左上 sparkle
- 降低 left badge 漂浮幅度
- 减少 sticker 感过强的 glow

### 验收标准

- 左上和右下看起来像同一套“漫画古风人物皮肤”
- 左上不再显得像独立贴纸

## 5.6 Phase 6：建立人物专属动作语言

### 要改什么

1. 给 `ancient-general` 独立 motion preset
2. 补 `react` 帧
3. 把人物动作从“泛 ornament 呼吸”切到“低频角色行为”

### 具体改动

#### A. 新建 `general-watchful` 或 `poetic-guard` preset

修改 [motion-presets.js](/Users/kartz/Development/Aura/apps/extension/runtime/motion-presets.js)：

不要继续让 `ancient-general -> watchful`。

建议新增专属 preset，特点：
- 底部 drift 幅度更小
- tilt 更小
- scale 变化更克制
- attention 时不是大幅探头，而是轻微视线收束
- scan-glint 应弱化或禁用

#### B. ancient-general 允许低频 react

修改 [character-theme.js](/Users/kartz/Development/Aura/apps/extension/runtime/character-theme.js)：
- 不再强制 `reactEnabled = false`
- 改成角色专属的轻 react

#### C. 为 peach-guard 补一张真正的 react 帧

建议表现：
- 微抬眼
- 视线更聚焦
- 酒杯停顿

不建议：
- 大幅侧身
- 大表情
- 宠物式探头

#### D. 缩减通用 sparkle / backdrop 在人物皮肤中的存在

人物动作应由：
- blink
- 轻 react
- 低频 gaze shift

来承担，而不是靠大量 sparkle 假装“它活着”。

### 验收标准

- 3 到 5 秒内能感知“他是活的”
- 但不会打扰观影

## 6. 文件级改动清单

优先会动到这些文件：

- [content-overlay.js](/Users/kartz/Development/Aura/apps/extension/runtime/content-overlay.js)
- [layout.js](/Users/kartz/Development/Aura/apps/extension/runtime/layout.js)
- [info-layer.js](/Users/kartz/Development/Aura/apps/extension/runtime/info-layer.js)
- [character-theme.js](/Users/kartz/Development/Aura/apps/extension/runtime/character-theme.js)
- [motion-presets.js](/Users/kartz/Development/Aura/apps/extension/runtime/motion-presets.js)
- [content.css](/Users/kartz/Development/Aura/apps/extension/content.css)
- [skin-contract.js](/Users/kartz/Development/Aura/apps/extension/runtime/skin-contract.js)
- [builtin-skins.json](/Users/kartz/Development/Aura/themes/manifests/builtin-skins.json)

会替换的资产：

- [skin-peach-guard-top-left.png](/Users/kartz/Development/Aura/apps/extension/themes/skin-peach-guard-top-left.png)
- [skin-peach-guard-bottom-right.png](/Users/kartz/Development/Aura/apps/extension/themes/skin-peach-guard-bottom-right.png)
- [skin-peach-guard-bottom-right-blink.png](/Users/kartz/Development/Aura/apps/extension/themes/skin-peach-guard-bottom-right-blink.png)
- 新增 `skin-peach-guard-bottom-right-react.png`

## 7. 实施顺序

顺序固定为：

1. 修 `base / blink` 资产 contract 和串帧
2. 收右下尺寸与存在感
3. 收左上 display policy
4. 再做风格统一
5. 最后补人物专属 motion

这个顺序不能反。因为：
- 串帧不修，任何视觉评价都会失真
- 尺寸不收，动效越做越抢戏
- 左上 policy 不收，信息再美也还是像调试台

## 8. 验收标准

### P0

- 右下不再出现双影
- blink 帧与 base 完全对齐
- 腾讯播放页不再出现“第二个将军”

### P1

- 右下尺寸更克制
- 左上只保留产品态信息，不像调试面板
- 左上不再和腾讯原生标题区强竞争

### P2

- 左上和右下风格统一
- 人物动作语言成立

## 9. 最终判断

这套 `桃林守望` 当前的问题，不是“图不行”，而是：

- 资产 contract 还不够严格
- 人物 runtime 模板还没真正从“猫挂件时代”独立出来

只要按本方案收口，`文人将军 · 桃林守望` 是有机会成为 Aura 第一套真正成立的人物皮肤模板的。
