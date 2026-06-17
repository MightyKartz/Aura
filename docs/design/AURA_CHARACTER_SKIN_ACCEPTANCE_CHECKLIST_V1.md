# Aura 人物皮肤验收清单 V1

这份清单用于把 Aura 的人物皮肤接入流程固定成可复用模板，避免每套皮肤再次回到占位素材和临时分支。

当前阶段已经有两套正式人物模板：

1. `general-peach-guard-v1`
2. `lady-moon-fan-v1`

---

## 1. 正式人物模板：`general-peach-guard-v1`

### 1.1 Registry / Manifest
- [x] `id` 为 `general-peach-guard-v1`
- [x] `category` 为 `character`
- [x] 保留完整 `characterTheme`
- [x] 不再回退到 `skin-ancient-*.svg` 占位主资源

### 1.2 资源锁定
正式资源文件必须是：
- `skin-peach-guard-top-left.png`
- `skin-peach-guard-bottom-right.png`
- `skin-peach-guard-bottom-right-blink.png`

Manifest 中必须对应：
- `themes/skin-peach-guard-top-left.png`
- `themes/skin-peach-guard-bottom-right.png`
- `themes/skin-peach-guard-bottom-right-blink.png`

### 1.3 动作与运行时
- [x] `characterTheme.archetype = ancient-general`
- [x] 由运行时推导基础 motion preset，不靠冗余 manifest 字段重复描述
- [x] blink 帧可以被 runtime 正常消费
- [x] 当前阶段不强塞 pet-style react

### 1.4 色板验收
当前正式 palette 需与真实图面对齐：
- `primary: #2f4a58`
- `accent: #d2a062`
- `glow: #f3d7c7`

---

## 2. 正式人物模板：`lady-moon-fan-v1`

### 2.1 Registry / Manifest
- [x] `id` 为 `lady-moon-fan-v1`
- [x] `category` 为 `character`
- [x] 保留完整 `characterTheme`
- [x] 不再回退到 `skin-ancient-*.svg` 占位主资源

### 2.2 资源锁定
正式资源文件必须是：
- `skin-moon-fan-top-left.png`
- `skin-moon-fan-bottom-right.png`
- `skin-moon-fan-bottom-right-blink.png`

Manifest 中必须对应：
- `themes/skin-moon-fan-top-left.png`
- `themes/skin-moon-fan-bottom-right.png`
- `themes/skin-moon-fan-bottom-right-blink.png`

### 2.3 动作与运行时
- [x] `characterTheme.archetype = ancient-lady`
- [x] 由运行时推导基础 motion preset，不靠冗余 manifest 字段重复描述
- [x] blink 帧可以被 runtime 正常消费
- [x] 当前阶段不强塞 pet-style react

### 2.4 色板验收
当前正式 palette 需与真实图面对齐：
- `primary: #5b4d7a`
- `accent: #d9c0a8`
- `glow: #f3dff7`

---

## 3. 通用人物皮肤验收标准

### 3.1 资源层
- top-left / bottom-right / blink 文件命名统一
- 透明背景干净，无脏边
- blink 与主图锚点一致
- 小尺寸下轮廓清楚

### 3.2 Manifest 层
- `category: character`
- `characterTheme` 完整
- 不重复写人物线冗余 `motionPreset`
- palette 贴合实际图面

### 3.3 Runtime 层
- auto resolve 可命中
- top-left info layer 语义正常
- derived motion preset 正常
- blink 帧可消费
- 人物线不复用宠物夸张 react

### 3.4 QA 层
- `Skin Studio` 检查通过
- 普通窗口态检查通过
- 网页全屏检查通过
- 字幕和控件不被明显遮挡
- build / smoke / test 全通过

---

## 4. 每次人物皮肤改动后的固定回归
- `npm test`
- `npm run build`
- `npm run smoke`
- `Skin Studio` 预览
