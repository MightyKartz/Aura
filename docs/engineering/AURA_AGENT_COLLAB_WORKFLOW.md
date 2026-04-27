# Aura 多 Agent 协作工作流

> 状态：Active  
> 适用范围：Aura Chrome 插件主线开发、回归、收口  
> 配套 skill：[`skills/aura-karpathy-guidelines/SKILL.md`](/Users/kartz/Development/Aura/skills/aura-karpathy-guidelines/SKILL.md)

## 1. 目标

把 Aura 的多 agent 协作固定成稳定口径，避免出现：
- 总控自己下场做大规模实现，导致失去收口视角
- implementer 没读项目文档就直接开改
- reviewer 只看局部现象就下“功能通过”结论
- 关键结论只停留在聊天里，不沉淀到项目资料

## 2. 默认角色分工

### dev-lead
负责：
- 先读 `README.md`、`docs/engineering/DEVELOPMENT.md`、`docs/product/ROADMAP.md`
- 识别目标、范围、交付标准、风险
- 拆任务、派任务、跟进任务、统一口径
- 决定哪些结论需要沉淀到项目文档

### impl-worker
负责：
- 按任务范围做最小实现
- 默认先加载 `aura-karpathy-guidelines`
- 不做无关重构，不顺手扩范围
- 明确报告：改动点、验证结果、未验证部分

### review-worker
负责：
- 按验收标准验证结果
- 默认先加载 `aura-karpathy-guidelines`
- 区分“已验证事实”和“尚未证明结论”
- 不把页面观察、静默分析、局部证据升级为“功能通过”

## 3. 总控派单前固定检查

派单前先回答：
1. 当前任务属于实现、验证，还是收口判断？
2. 当前真相源文件是哪几份？
3. 本次任务的最小完成定义是什么？
4. 哪些验证是必须的，哪些只是加分项？
5. 有哪些高风险边界不能碰？

如果以上 5 项说不清，就不要直接派实现任务。

## 4. 默认加载规则

### 实现任务
默认要求 `impl-worker` 加载：
- `aura-karpathy-guidelines`

若任务明确属于 popup / Skin Studio / 官网 / 展示页的 UI 打磨，再追加加载：
- `aura-frontend-design`

### 验证任务
默认要求 `review-worker` 加载：
- `aura-karpathy-guidelines`

若验证重点包含视觉层级、可读性、品牌气质与前端呈现质量，再追加加载：
- `aura-frontend-design`

### 复杂收口任务
若任务涉及实现 + 验证 + 结论统一：
- `dev-lead` 先做任务拆分
- 实现与验证分开派发
- 最后由 `dev-lead` 统一收口

## 5. 固定派单模板

以下模板用于把 `aura-karpathy-guidelines` 真正接进 Aura 开发主链。

---

## 5.1 impl-worker 模板

```text
你在 Aura 仓库中执行实现任务。

开始前必须先读取：
- README.md
- docs/engineering/DEVELOPMENT.md
- docs/product/ROADMAP.md
- 当前任务对应的设计 / QA 文档
- skills/aura-karpathy-guidelines/SKILL.md
- 若任务属于 UI / 视觉打磨，再读 skills/aura-frontend-design/SKILL.md

任务目标：
[填写本次实现目标]

任务边界：
- 只实现与本任务直接相关的最小改动
- 不做无关重构
- 不扩张到未要求的多站点 / 多皮肤 / 新架构
- 不把猜测当事实

必须关注的主链：
- 腾讯播放页识别
- 窗口态 / 网页全屏 / 原生全屏稳定
- popup 与页面状态一致
- 快捷键稳定
- teardown 无残留

输出要求：
1. 改动文件
2. 改动目的
3. 已执行验证
4. 未执行验证
5. 当前仍存在的风险 / 缺口

如果验收条件不明确，先停下并指出缺口，不要硬做。
```

---

## 5.2 review-worker 模板

```text
你在 Aura 仓库中执行验证 / 评审任务。

开始前必须先读取：
- README.md
- docs/engineering/DEVELOPMENT.md
- docs/product/ROADMAP.md
- 当前任务对应的设计 / QA 文档
- skills/aura-karpathy-guidelines/SKILL.md
- 若任务属于 UI / 视觉打磨，再读 skills/aura-frontend-design/SKILL.md

验证目标：
[填写本次验证目标]

验证边界：
- 只基于当前文件、日志、环境、测试结果和实际观测下结论
- 页面分析 / 静默观察 / 局部证据 ≠ 功能通过
- 如果没有 Aura 实际注入、生效或真实交互证据，不能下“功能通过”结论

至少检查：
1. 是否符合任务原始要求
2. 是否引入无关改动或过度设计
3. 是否具备足够验证闭环
4. 是否有未覆盖但重要的风险

输出结构：
1. 结论
2. 依据
3. 风险 / 当前缺口
4. 下一步建议

若证据不足，明确写“证据不足”，不要补脑。
```

---

## 5.3 dev-lead 收口模板

```text
当前任务在 Aura 仓库中推进。

先读取：
- README.md
- docs/engineering/DEVELOPMENT.md
- docs/product/ROADMAP.md
- 当前任务相关设计 / QA 文档
- impl-worker 输出
- review-worker 输出
- skills/aura-karpathy-guidelines/SKILL.md

你的职责不是重做实现或重做验收，而是：
- 判断当前是否达到交付标准
- 明确哪些结论已成立
- 明确哪些结论还不能成立
- 判断哪些信息需要沉淀到项目文档

对外输出结构固定为：
1. 结论
2. 依据
3. 风险 / 当前缺口
4. 下一步建议
```

## 6. 常见错误与禁止事项

### 错误 1：总控自己直接接管大规模实现
后果：失去范围控制，收口判断失真。

### 错误 2：实现和验收混在一个 worker 身上
后果：实现者替自己背书，结论不稳。

### 错误 3：review 只看页面现象就宣布通过
后果：把“宿主页面正常”误报成“Aura 功能通过”。

### 错误 4：任务结束后不沉淀
后果：下次继续重复口头约定，项目失去稳定真相源。

## 7. 建议沉淀的内容

以下内容默认优先写进文档：
- 新的稳定开发约束
- 新的验收口径
- 新的回归清单
- 新的运行时 contract 变化
- 皮肤 / adapter / popup 的稳定结论

## 8. 最小执行闭环

每个 Aura 任务至少应形成：
1. 总控判断任务范围
2. 实现 worker 执行最小改动
3. review worker 独立验证
4. dev-lead 统一收口
5. 需要长期保留的结论写入文档

这套流程的目标不是显得流程很多，而是让 Aura 的实现、验证和收口都可重复、可交付、可复盘。
