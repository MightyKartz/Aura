# Aura 皮肤质量统一实施方案 V1

## 目标

把 Aura 首批内置皮肤统一到 `文人将军 · 桃林守望` 的成品质感：暗场可读、边缘干净、不过度 Q 版、不像厚白边贴纸。

## 本轮范围

- `默认小猫`：重做为暖白月光与奶油猫的高级通用款。
- `悬疑侦探 · 黑猫`：替换旧悬疑 Q 版，保留黑猫侦探方向但增强冷蓝轮廓光。
- `雨夜悬疑 · 黑猫侦探`：使用同一套新版黑猫资产，保证悬疑自动匹配不会回退到低质图。
- `古风贵女 · 月下执扇`：重做为 2D 日漫 + 水墨质感的人物线第二套皮肤。
- `热血猫`：从旧 SVG 占位升级为 PNG 灵兽主题。
- `文人将军 · 桃林守望`：作为质量标杆保留，不在本轮重做。

## 统一标准

- 左上角只承担题材氛围或徽记，不放第二个主角色。
- 右下角只承担陪伴角色，锚定右下并保留上方空气感。
- 运行资产固定为 PNG RGBA。
- 左上推荐画布为 `1536x1536`。
- 右下推荐画布为 `1536x1920`。
- 不使用厚白边、整块背景板、海报式矩形构图。
- 暗场下必须能看清主体轮廓，亮场下不能显脏边。

## 本轮落地

- 生成并接入新版默认小猫 PNG：
  - `apps/extension/themes/skin-default-top-left.png`
  - `apps/extension/themes/skin-default-bottom-right.png`
- 生成并接入新版黑猫侦探 PNG：
  - `apps/extension/themes/skin-rain-detective-top-left.png`
  - `apps/extension/themes/skin-rain-detective-bottom-right.png`
  - `apps/extension/themes/skin-suspense-top-left.png`
  - `apps/extension/themes/skin-suspense-bottom-right.png`
- 生成并接入新版古风贵女 PNG：
  - `apps/extension/themes/skin-moon-fan-top-left.png`
  - `apps/extension/themes/skin-moon-fan-bottom-right.png`
- 生成并接入新版热血 PNG：
  - `apps/extension/themes/skin-hotblood-top-left.png`
  - `apps/extension/themes/skin-hotblood-bottom-right.png`
- `cat-suspense-v1` 从旧 Q 版悬疑猫调整为新版黑猫侦探资产。
- `cat-hotblood-v1` 不再引用旧 SVG，占位 SVG 退出主线。

## 后续建议

- 下一轮只做真实页面视觉微调，不再大规模换图。
- 如果要继续新增皮肤，应先做 `top-left + bottom-right` 成套资产，再接入 manifest。
- 不建议恢复多帧动作系统，短期以单图高质量 + 克制呼吸/光感为主。
