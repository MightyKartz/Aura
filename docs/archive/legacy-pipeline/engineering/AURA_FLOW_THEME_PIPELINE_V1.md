# Aura × Flow 主题生产管线 v1

## 目标

建立一条可重复的半自动主题生产闭环：

```text
主题需求 -> Flow 生成母图 -> 人工筛选 -> Aura 切片 -> manifest 接入 -> 腾讯视频联调
```

当前不做运行时动态生成。

---

## 一、角色分工

### Aura
负责：
- 主题消费
- manifest 管理
- top / bottom overlay 渲染
- popup 诊断

### Flow
负责：
- 主题母图生成
- 生成任务执行
- 返回生成结果

### 人工审核
负责：
- 审美筛图
- 判断是否污染字幕区
- 判断是否需要重跑 prompt

---

## 二、默认资源策略

默认不要分别生成 top / bottom。

推荐流程：
1. 先生成一张超宽母图
2. 基于母图切出 top / bottom
3. 额外保留 preview 与 master

---

## 三、推荐尺寸

### 当前 V1 推荐
- 母图：16:9 首版可先用 Flow 默认输出
- 长期标准：`4096 × 1024`
- top / bottom：由母图裁切

### 当前 Aura 试点资产
`tai-ping-nian` 当前使用：
- `tai-ping-nian-master.jpg`
- `tai-ping-nian-preview.jpg`
- `tai-ping-nian-top.png`
- `tai-ping-nian-bottom.png`

---

## 四、Flow 当前可用接口

### 1. 图片生成
```http
POST /api/generate-images
```

### 示例请求体
```json
{
  "prompt": "ultra-wide imperial Chinese atmosphere for a premium drama theme, prosperous dynasty court at night, restrained dark gold patterns, palace eaves silhouettes, subtle cloud texture, deep indigo and muted gold palette, elegant decorative composition, center area kept relatively clean, no characters, no text, no logo, no watermark, no modern objects, cinematic, refined, majestic, not poster-like",
  "referenceImages": [],
  "aspectRatio": "16:9",
  "stylePrompt": "premium cinematic border art, elegant, restrained, atmospheric, suitable for video letterbox overlay theme pack"
}
```

### 示例返回
```json
{
  "status": "SUCCEED",
  "output_images": ["/generated/xxx.jpg"]
}
```

---

## 五、《太平年》试点风格方向

### 关键词
- 古装
- 朝堂
- 盛世
- 夜色金纹
- 克制
- 精致
- 不要廉价金色

### 负面约束
- no text
- no logo
- no watermark
- no modern objects
- no central face
- not poster-like

---

## 六、Aura 侧接入步骤

1. 生成母图
2. 落本地或下载到 Aura 工作区
3. 切出：
   - top
   - bottom
   - preview
   - master
4. 更新 `themes/manifests/builtin-themes.json`
5. 把 theme 的 `assetStatus` 改为 `ready`
6. `npm run build`
7. 在腾讯视频页面联调

---

## 七、manifest 接入约定

试点 theme 至少应包含：

```json
{
  "id": "tai-ping-nian",
  "name": "太平年 · 专属 Aura",
  "category": "show",
  "description": "为《太平年》试点准备的专属氛围主题，风格方向为盛世金纹与朝堂夜色。",
  "match": {
    "keywords": ["太平年", "tai-ping-nian"]
  },
  "assets": {
    "top": "themes/tai-ping-nian-top.png",
    "bottom": "themes/tai-ping-nian-bottom.png",
    "preview": "themes/tai-ping-nian-preview.jpg"
  },
  "assetStatus": "ready",
  "assetSource": "flow",
  "recommendedIntensity": 56,
  "tags": ["太平年", "专属", "朝堂", "盛世", "试点", "Flow"]
}
```

---

## 八、联调验收标准

1. 命中 show theme 正确
2. 页面渲染的不是默认素材
3. top / bottom 不明显污染正片
4. 字幕区可接受
5. 普通播放 / 网页全屏 / 原生全屏都能看

---

## 九、后续优化方向

1. 同一主题生成多候选图
2. 引入自动切片脚本
3. 增加透明渐变 / 羽化参数
4. 补文档与审美筛选准则
5. 为第二个 show theme 复制整条链路
