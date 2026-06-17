# AURA Character Theme Runtime Spec V1

> 状态：Draft for Implementation
> 适用范围：Aura 扩展人物主题皮肤运行时
> 目标：把“角色 archetype / 题材风格 / 热门剧气质映射”收敛成统一运行时 contract，避免继续堆散落 if/patch。

## 1. 运行时原则

Aura 人物主题运行时统一遵守三条原则：

1. `右下是角色主体`
2. `左上是环境回声 + 信息层`
3. `运行时只消费结构化主题变量，不直接消费模糊文案需求`

因此任何人物主题皮肤，进入运行时前都必须先映射成固定字段，而不是只给一组图片和一段描述。

## 2. Registry Contract

人物主题皮肤在 `builtin-skins.json` 中使用：

- `category: "character"`
- `characterTheme: { ... }`
- `motionPreset` 对人物皮肤可省略，运行时按 `characterTheme.archetype` 推导基础 motion preset，再叠加 `motionLanguage` 补丁

### 2.1 必填字段

```json
{
  "category": "character",
  "characterTheme": {
    "layer": "mapped",
    "archetype": "ancient-general",
    "themeName": "桃林守望",
    "themeSlug": "peach-guard",
    "topLeftAtmosphere": {
      "motifs": ["桃枝", "月影"],
      "semanticHint": "桃林守望"
    },
    "bottomRightCharacter": {
      "role": "文人将军",
      "pose": "半身守望",
      "prop": "执杯"
    },
    "motionLanguage": {
      "focus": "视线轻偏",
      "accent": "披风边微动"
    },
    "microcopyTone": "restrained"
  }
}
```

## 3. 字段语义

### 3.1 `layer`

允许值：
- `base`
- `genre`
- `mapped`

含义：
- `base`：原创基础 archetype
- `genre`：题材风格层
- `mapped`：热门剧气质映射层

### 3.2 `archetype`

固定描述人物母版，例如：
- `ancient-lady`
- `ancient-general`

### 3.3 `themeName`

Aura 对外输出的原创主题名，例如：
- `桃林守望`
- `月下执扇`

禁止直接写剧名、角色名、演员名。

### 3.4 `topLeftAtmosphere`

左上角的环境回声层：
- `motifs`：素材关键词，用于信息层和调试展示
- `semanticHint`：左上优先语义标签

### 3.5 `bottomRightCharacter`

右下角色主体骨架：
- `role`
- `pose`
- `prop`

### 3.6 `motionLanguage`

角色动作语言：
- `focus`：最该动的主动作
- `accent`：补充动作或高光

### 3.7 `microcopyTone`

允许值：
- `gentle`
- `restrained`
- `cool`
- `playful`

运行时使用它来控制 utility/info 层的默认文案语气。

## 4. 运行时消费方式

### 4.1 皮肤选择

`recommendSkinByText()` 必须优先使用：
- `match.keywords`
- `themeName`
- `topLeftAtmosphere.semanticHint`
- `bottomRightCharacter.role`
- `bottomRightCharacter.pose`
- `bottomRightCharacter.prop`

当命中 `category: character` 皮肤时，来源标记为：
- `auto-character-theme`

### 4.1.1 动作运行时

`resolveMotionProfile()` 必须先按 `characterTheme.archetype` 选基础 motion preset，再把 `motionLanguage.focus` / `motionLanguage.accent` 叠加成具体 profile patch。

当前阶段至少要让人物线和宠物线动作明显区分：
- 人物皮肤默认关闭宠物式 react 探头
- `视线轻偏`、`扇面微移` 等 focus 要进入 blink / probe / drift 等真实 motion 参数
- `披风边微动`、`珠钗轻晃` 等 accent 要进入 mist / glint / sparkle 等真实 motion 参数

### 4.2 左上信息层

`buildInfoLayerModel()` 输出：
- `semanticLabel`
- `atmosphereLabel`
- `narrativeLabel`
- `promptText`
- `promptType`
- `utilityLabel`
- `metaLabel`
- `microcopyTone`

优先级：
1. `characterTheme.topLeftAtmosphere.semanticHint`
2. `showContext`
3. `skin.tags[0]`
4. `skin.name`

### 4.3 文案语气映射

示例：
- `gentle`：`回看 18:42` / `已标记 2 处`
- `restrained`：`回看点 18:42` / `已藏 2 处`
- `cool`：`续看 18:42` / `记录 2 处`
- `playful`：`接着看 18:42` / `收好 2 处`

### 4.4 状态持久化

status 层建议额外持久化：
- `skinCategory`
- `characterArchetype`
- `characterThemeName`
- `themeLayer`
- `atmosphereLabel`
- `narrativeLabel`
- `microcopyTone`

用于 popup、调试和后续 QA。

## 5. 第一阶段落地要求

当前阶段至少落地一套完整试点：
- `文人将军 · 桃林守望`

要求：
- registry 有完整 `characterTheme`
- auto resolve 能命中
- overlay 左上可见 atmosphere / narrative / utility 信息层
- popup / status 能读到主题字段
- smoke / test 覆盖 contract

## 6. 明确不做

运行时当前不承担：
- 具体影视角色复刻逻辑
- 剧名级别运营分支
- 演员脸识别或关联
- 左上第二张完整插画
- 宠物式夸张探头动作复用到人物皮肤
