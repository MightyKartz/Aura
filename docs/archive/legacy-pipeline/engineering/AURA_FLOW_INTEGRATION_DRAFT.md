# Aura × Flow 生成链路接入草案

## 1. 目标

打通 Aura 与 Flow / 阿里云生成链，使 Aura 可以基于统一规范：
- 触发主题母版图生成
- 获取生成产物
- 自动切片为 top / bottom
- 生成 Aura theme pack
- 最终接入插件主题系统

目标不是让用户实时生成，而是先建立：
> **稳定的半自动主题生产与接入闭环**

---

## 2. 角色分工

## 2.1 主控角色
### 由我主控（OpenClaw / 机器猫）
负责：
- 设计主题生产规范
- 设计并调用 Flow 生成接口
- 选图 / 质检 / 切片策略
- 写回 Aura theme manifest
- 在插件里挂载和验证

## 2.2 Flow 项目角色
Flow 负责：
- 执行图片生成工作流
- 管理生成任务
- 存储中间产物与最终产物
- 提供查询/回传接口

## 2.3 阿里云部署 skill 角色
阿里云 skill 负责：
- 服务器命令执行
- 部署/更新
- 端口和防火墙调整
- 服务重启与运维

### 重要边界
阿里云 skill 是：
- **运维与部署通道**

不是：
- 业务级图片生成 API 本身

因此推荐模式是：
> **Aura 调 Flow API，阿里云 skill 负责维护 Flow 服务端运行环境。**

---

## 3. 推荐接入模式

## 3.1 总体链路

```text
Aura 主题需求
  ↓
Aura 主题生产脚本 / 管理脚本
  ↓
Flow API（生成母版图）
  ↓
阿里云生成系统执行工作流
  ↓
返回母版图 URL / 路径 / 任务结果
  ↓
Aura 侧裁切 top / bottom
  ↓
生成 theme pack + manifest
  ↓
接入 Aura 插件
```

---

## 4. API 设计建议

## 4.1 生成接口
### `POST /api/aura/generate`

用途：
- 触发 Aura 主题母版图生成任务

### 请求体建议
```json
{
  "showTitle": "逐玉",
  "themeId": "zhu-yu",
  "themeType": "show",
  "mood": "cold-moon-gold",
  "promptPreset": "aura-show-zhu-yu-v1",
  "outputMode": "aura-master",
  "count": 4,
  "size": "4096x1024"
}
```

### 返回建议
```json
{
  "taskId": "aura_gen_001",
  "status": "queued"
}
```

---

## 4.2 任务查询接口
### `GET /api/aura/tasks/:taskId`

用途：
- 查询生成任务状态

### 返回建议
```json
{
  "taskId": "aura_gen_001",
  "status": "succeeded",
  "results": [
    {
      "id": "img_01",
      "url": "https://example.com/generated/aura/zhu-yu/master-01.png",
      "width": 4096,
      "height": 1024
    }
  ]
}
```

状态建议：
- `queued`
- `running`
- `succeeded`
- `failed`

---

## 4.3 主题包固化接口（可选）
### `POST /api/aura/theme-pack`

用途：
- 将筛选后的生成结果固化为 Aura 主题包

### 请求体建议
```json
{
  "themeId": "zhu-yu",
  "showTitle": "逐玉",
  "masterImageUrl": "https://example.com/generated/aura/zhu-yu/master-01.png",
  "topImageUrl": "https://example.com/generated/aura/zhu-yu/top.png",
  "bottomImageUrl": "https://example.com/generated/aura/zhu-yu/bottom.png",
  "description": "为《逐玉》准备的专属氛围主题，偏冷月与鎏金边光。",
  "recommendedIntensity": 54,
  "tags": ["逐玉", "专属", "冷月", "鎏金"]
}
```

---

## 5. 产物格式规范

## 5.1 输出层级
每个主题包建议包含：

```text
themes/generated/<themeId>/
├── master.png
├── top.png
├── bottom.png
└── manifest.json
```

## 5.2 产物说明
### `master.png`
- 生成母版图
- 默认推荐：`4096 × 1024`

### `top.png`
- 从母版切出的顶部遮罩图
- 默认推荐：`3072 × 384`

### `bottom.png`
- 从母版切出的底部遮罩图
- 默认推荐：`3072 × 384`

### `manifest.json`
- 主题元数据
- 用于接入 Aura Theme Registry

---

## 6. 母版图生成策略

## 6.1 默认策略
不直接生成 top / bottom 两张图，而是：

> **先生成一张高分辨率超宽母版图**

原因：
- 上下风格一致
- 色调统一
- 光感统一
- 更适合后期切片和多版本适配

## 6.2 Prompt 目标
Prompt 不应要求“海报图”，而应要求：
- 超宽横幅母版图
- 上下边缘可裁切
- 中央区域克制
- 左右和边缘有足够氛围信息

---

## 7. 自动切片策略

## 7.1 默认切片规则
如果母版为 `4096 × 1024`：
- top 从上方截取约 `384px`
- bottom 从下方截取约 `384px`

## 7.2 切片后处理
建议自动追加：
- 边缘透明渐变
- 羽化
- 局部暗化/柔化
- 导出 PNG

## 7.3 保持一致性原则
- top / bottom 默认必须来自同一母版
- 除特殊主题外，不采用“分开生成两张”的默认流程

---

## 8. 主题命中与接入

## 8.1 主题接入方式
生成完 theme pack 后，由 Aura 写入：
- `themes/manifests/builtin-themes.json`
或后续远程主题清单

## 8.2 命中优先级
1. show 专属主题
2. genre 类型主题
3. default 默认主题

例如：
- 《逐玉》 → `zhu-yu`
- 未命中 show 时，再回退到 `ancient-romance`

---

## 9. 实施顺序建议

## 阶段 1：接口确认
先确认 Flow 当前已有能力：
- 是否已有图片生成 API
- 是否已有任务查询接口
- 生成产物落地路径是什么
- 结果 URL 如何获取

## 阶段 2：主题生产规范落地
- 固定母版图尺寸
- 固定 top / bottom 切片规范
- 固定命名规范

## 阶段 3：第一批主题生产
建议首批只做：
- 腾讯默认 Aura 正式版
- 古装仙侠正式版
- 悬疑刑侦正式版
- 逐玉专属 Aura 正式版

## 阶段 4：自动接入 Aura
- 生成结果入库
- 写 manifest
- 在插件中自动命中和显示

---

## 10. 最终建议

### 谁调
**由我直接调 Flow API。**

### 怎么调
- Aura 侧触发主题生成任务
- Flow 服务负责生成与产物输出
- 阿里云 skill 负责运维与部署支持

### 产物格式
统一为：
- `master.png`
- `top.png`
- `bottom.png`
- `manifest.json`

### 默认生成策略
> **先生成一张高分辨率超宽母版图，再切 top / bottom。**

这是当前在：
- 审美一致性
- 清晰度
- 工程稳定性
- 后续批量化

四个维度下最优的接入方式。
