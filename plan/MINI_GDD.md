# MINI_GDD: 配给日

## Scope

- runtime: web
- duration: 15min
- project_line: 饥饿与配给
- single_core_loop: 分配口粮并结算饱腹、关系和风险变化

## Core Loop

1. 玩家进入当前情境
2. 玩家做一次关键选择或操作
3. 系统更新状态并反馈
4. 进入下一轮或结算

## State

- 主状态不超过 5 项
- 只保留服务于主循环的变量
- 不引入长链大型系统

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
