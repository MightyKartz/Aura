# Aura 阶段总结（2026-03-15）

## 结论

Aura 在腾讯视频单站点上的 MVP 运行时主链，已经从“结构探索期”推进到“稳定化收口期”。

当前已经完成：
- 主播放器容器识别优先级重排
- 内容区矩形测量优先级重排
- 原生 fullscreen / 腾讯视频 fake web fullscreen 区分
- 切集 / 刷新重进行为建模
- popup 诊断字段补强
- sync 调度去重与收敛
- 多轮真实页联调与构建验证

当前还未完成：
- 基于真实加载扩展后的最终视觉验收闭环
- 更完善的主题资产验收标准
- 多平台站点扩展

---

## 一、已完成

### 1. 腾讯视频主容器识别链
已提高以下容器优先级：
- `#main-player`
- `#player-component`
- `.main-player-container`
- `.main-player-wrapper`

目标是减少落入弱 fallback 容器的概率，优先命中真实播放器宿主。

### 2. 内容区矩形测量链
已明确将以下节点作为高价值候选：
- `.thumbplayer-webvtt-overlay`
- `.txp_subtitles_container`

并下压以下控件类 overlay 的优先级：
- `.player__overlay--above-control`

当前工程判断：腾讯视频场景下，内容区 overlay 比单纯 `video rect` 更稳定代表“真实内容区矩形”。

### 3. fullscreen-like 状态建模
已区分两种不同模式：
- 原生全屏：`document.fullscreenElement`
- 网页全屏：腾讯视频 fake fullscreen class

已纳入识别的 class 特征：
- `thumbplayer-fake-fullscreen`
- `plugin_ctrl_txp_mode_fullscreen`
- `plugin_ctrl_fake_fullscreen`
- `webfullscreen`
- `web-fullscreen`

### 4. 切集 / 刷新重进建模
真实页联调已确认：
- 切集后 URL 与标题链都会切到新 episode
- 网页全屏态可在切集后继续保留
- 刷新后 episode 保持，但网页全屏会丢失并回到窗口态

该行为已视为站点行为，不再作为 Aura 运行时故障处理。

### 5. popup 诊断能力
当前 popup 已补齐关键诊断字段：
- `playbackMode`
- `containerSource`
- `geometryStrategy`
- `measurementSource`
- `measurementConfidence`
- `renderOpacity`
- `lastSyncReason`
- `syncReasons`
- `generation`
- `frameState`
- `webFullscreen`
- `childFrameHint`
- `measuredTop/Bottom`
- `renderedTop/Bottom`

### 6. 调度链收敛
已完成：
- mutation 触发 signature 去重
- sync 原因合并
- status 写入 fingerprint 去重
- poll 频率收敛

目标是让页面稳定后状态安静下来，而不是持续抖动。

---

## 二、已验证

### 1. 构建验证
已多次执行：

```bash
npm run build
```

结果通过，`dist/` 已持续更新。

### 2. 真实页联调验证
已在腾讯视频《逐玉》页面完成多轮采样。

#### 窗口态样本
- 主播放器容器约 `698x393`
- 内容区 overlay 约 `698x267`
- 可近似反推出上下黑边约 `63 / 63`

#### 原生全屏样本
- fullscreen 根为 `#main-player`
- 主播放器容器约 `1200x792`
- 内容区 overlay 约 `1200x460`
- 可近似反推出上下黑边约 `166 / 166`

#### 网页全屏样本
- fake fullscreen class 生效
- `#main-player` 铺满视口
- 内容区仍与容器有差异，说明不能只拿容器当内容区

#### 切集样本
- 第 02 集 / 第 03 集之间切换成功
- URL 与 `.player-play-title` 同步切换
- 网页全屏态切集后仍可保持

#### 刷新重进样本
- 当前 episode 保持
- 网页全屏态丢失并回到窗口态
- 视为站点行为

---

## 三、当前已知边界

### 1. 视觉验收仍是半闭环
当前已能根据几何链、样式链、截图样本做工程级视觉判断，但还没有在“真实加载 Aura 扩展后的最终页面”上完成完整截图闭环。

### 2. 主题资产验收尚未标准化
虽然试点主题资产已进入接入状态，但对以下维度尚未形成统一验收表：
- 贴边准确性
- 字幕区污染风险
- 暗场压黑程度
- 高亮场景过曝风险
- 主题强度舒适度

### 3. 当前仍以腾讯视频单站点为主
本轮所有关键判断都服务于腾讯视频主链稳定化，尚未推广到其他平台。

---

## 四、视觉验收（第一版）

### 验收方法
本轮视觉验收采用两层方法：
1. 样式规则审查
2. 真实页截图 + 几何样本联合判断

### 样式规则结论
当前 `apps/extension/content.css` 中：
- `#aura-root` 使用 `pointer-events: none`，不会抢交互
- Aura 顶/底 layer 仅做边缘覆盖，不会整块压在内容区中央
- 当前 fill + gradient + shadow 组合偏保守，整体更偏“压边氛围层”而不是“强干扰特效层”

### 真实页样本结论
基于当前窗口态截图与几何样本：
- 内容区位于播放器中央
- 顶部 gap 与底部 gap 都足以容纳 Aura 顶/底 layer
- 当前工程方向满足“不遮剧情主内容”的基本要求

### 当前视觉风险点
1. 字幕区风险仍需重点看
   - 底部黑边在部分场景可能较浅
   - 若 bottom layer 过重，容易压字幕观感
2. 暗场风险仍需重点看
   - 当前样式含较深阴影与渐变
   - 暗场素材若本身偏黑，可能产生压暗感
3. 高亮场景风险仍需重点看
   - `::before` 高光渐变若主题素材也偏亮，顶部可能显得略浮

### 当前视觉判断
- **工程可接受**：是
- **可进入下一轮产品验收**：是
- **已完成最终视觉验收**：否

也就是说，当前版本已经达到了“值得继续做真实扩展视觉验收”的程度，但还不宜宣称视觉完全定稿。

---

## 五、下一步建议

### P0
- 在真实加载 Aura 扩展的浏览器里做一轮最终视觉截图验收
- 重点验收窗口态 / 网页全屏 / 切集后三个场景

### P1
- 补一版主题视觉验收清单：
  - 是否遮剧情
  - 是否压字幕
  - 是否过暗
  - 是否过亮
  - 是否有廉价感 / 漂浮感

### P1
- 输出可对外同步的阶段进展汇报

### P2
- 再决定是否进入：
  - theme 资产结构细化
  - popup 控制项增强
  - 多平台扩展
