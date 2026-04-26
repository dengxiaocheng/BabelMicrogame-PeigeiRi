# MINI_GDD: 配给日

## Scope

- runtime: web
- duration: 20min
- project_line: 配给日
- single_core_loop: 查看人物饥饿和队列 -> 称量口粮 -> 分发 -> 结算饱腹/信任/怀疑 -> 下一日

## Core Loop
1. 执行核心循环：查看人物饥饿和队列 -> 称量口粮 -> 分发 -> 结算饱腹/信任/怀疑 -> 下一日
2. 按 20 分钟节奏推进：正常分粮 -> 熟人插队 -> 工头抽查 -> 口粮减半危机

## State

- resource
- pressure
- risk
- relation
- round

## UI

- 只保留主界面、结果反馈、结算入口
- 不加多余菜单和后台页

## Content

- 用小型事件池支撑主循环
- 一次只验证一条 Babel 创意线

## Constraints

- 总体规模目标控制在 5000 行以内
- 单个 worker 任务必须服从 packet budget
- 如需扩线，交回 manager 重新拆
