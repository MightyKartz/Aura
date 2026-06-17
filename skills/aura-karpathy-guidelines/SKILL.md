---
name: aura-karpathy-guidelines
description: Aura 开发约束 skill。用于实现、评审、重构和排障时，减少错误假设、过度设计、顺手乱改，并要求可验证的成功标准。适用于 Aura Chrome 插件主线，尤其是 runtime、skin、popup、adapter 与 QA 收口任务。
license: MIT
---

# Aura Karpathy Guidelines

本 skill 基于 `forrestchang/andrej-karpathy-skills` 改写，用于 Aura 本地开发与多 agent 协作。

它不是业务功能模块，也不是运行时依赖；它是 **Aura 的开发约束层**。

## 适用场景

在以下任务中优先加载：
- runtime 逻辑修改
- popup / background / content 协调改动
- 皮肤 manifest、素材接入、Skin Studio 联调
- 站点 adapter 调整
- bugfix / refactor / review / smoke 前检查

## Aura 工作前提

在判断当前状态前，先读取：
1. `README.md`
2. `docs/engineering/DEVELOPMENT.md`
3. `docs/product/ROADMAP.md`
4. 与当前任务直接相关的设计或 QA 文档

不要跳过这些步骤后直接对 Aura 当前状态下结论。

## Aura 协作约束

- 多 agent 协作时：
  - 实现类任务优先交给 `impl-worker`
  - 验证类任务优先交给 `review-worker`
- 总控负责：范围判断、风险识别、阶段结论、统一口径
- 不把局部证据包装成最终功能通过
- 稳定事实、阶段结论、验收口径尽量沉淀到项目文档，而不是只留在聊天里

## 1. Think Before Coding

**不要乱假设。不要隐藏困惑。明确权衡。**

开始改 Aura 之前，先明确：
- 改动目标属于 runtime、skin、popup、adapter、preview 还是 QA 收口
- 受影响文件是否已经有单一真相源
- 当前改动是否会破坏以下主链：
  - 腾讯播放页识别
  - 窗口态 / 网页全屏 / 原生全屏稳定
  - popup 与页面状态一致
  - 快捷键稳定
  - teardown 无残留

如果存在多种理解：
- 明确列出分支，不要静默选择
- 有更简单路径时，主动指出
- 验收条件不足时，先收口，不硬推结论

## 2. Simplicity First

**只做够用的最小改动，不做未来感过强的抽象。**

在 Aura 中具体表现为：
- 不为暂时只有一个站点的逻辑提前做复杂多站点框架
- 不为单一皮肤需求引入重配置系统
- 不把本可在现有 runtime contract 内完成的需求改造成新平行链路
- 不为“以后可能会用到”而增加多余字段、层次或兼容分支

自检问题：
- 这次改动是不是直接服务当前任务？
- 这段抽象是不是已经有第二个真实使用点？
- 这次新增的复杂度会不会伤到腾讯主链稳定性？

## 3. Surgical Changes

**只改必须改的。只清理自己造成的残留。**

在 Aura 中必须遵守：
- 不顺手重构无关 runtime 文件
- 不因为改 popup 就顺带重写 settings / status 主链
- 不因为做新皮肤就清扫一批与当前任务无关的历史文件
- 不删除旧逻辑，除非本次任务明确要求替换并验证完成

如果你的改动产生了孤儿内容：
- 删除本次改动导致无用的导入、变量、资源引用
- 不借机清理整个项目的历史债务

判定标准：
- 每一处改动都能直接追溯到当前任务
- diff 中不应充满“顺手优化”

## 4. Goal-Driven Execution

**定义成功标准，并用验证闭环证明它。**

把任务改写成可验证目标：
- “修腾讯全屏问题” → 给出复现路径，修复后验证窗口态 / 网页全屏 / 原生全屏
- “接入新皮肤” → manifest、素材、motion、Skin Studio、build/smoke/test 全部通过
- “优化 popup” → 明确状态项、交互项、回归项，而不是只看视觉

建议执行结构：
1. 说明目标
2. 说明最小改动路径
3. 执行修改
4. 运行验证
5. 给出仍未验证部分

## Aura-Specific Acceptance Rules

### Runtime / 功能类
若涉及 runtime 行为，至少说明：
- 改动点
- 影响范围
- 已执行验证
- 未覆盖验证

### 皮肤 / 素材类
若涉及皮肤接入，默认回归：
- `npm test`
- `npm run build`
- `npm run smoke`
- `Skin Studio` 预览

### 页面观察类
- 页面分析、console 观察、静默检查 ≠ 功能验收通过
- 若未明确加载 Aura 扩展或未完成实际交互验证，只能报告“页面 / 宿主状态”
- 不能把“看起来正常”升级为“功能通过”

## 推荐给 worker 的使用方式

- 固定派单模板见 [`docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md`](/Users/kartz/Development/Aura/docs/engineering/AURA_AGENT_COLLAB_WORKFLOW.md)

### 给 impl-worker

```text
Load skill `aura-karpathy-guidelines` before implementation. Follow its constraints: inspect Aura docs first, avoid hidden assumptions, keep changes minimal, avoid unrelated refactors, and define verifiable success criteria.
```

### 给 review-worker

```text
Load skill `aura-karpathy-guidelines` before review. Check for hidden assumptions, overengineering, drive-by changes, weak success criteria, and any claim that upgrades partial evidence into final acceptance.
```

## 结束时必须回答的问题

提交结果前，自问：
1. 这次结论是否基于当前文件、日志、环境和验证结果？
2. 我是否把未验证部分明确写出来了？
3. 我是否把局部证据误报成功能通过？
4. 这次改动是否真的服务 Aura 当前主线，而不是扩散范围？
5. 需要沉淀的阶段结论，是否已经进入项目资料？
