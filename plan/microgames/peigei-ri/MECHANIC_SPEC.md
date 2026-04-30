# MECHANIC_SPEC: 配给日

## Primary Mechanic

- mechanic: 称量分配 + 队列压力 + 人情债
- primary_input: 拖动粮块到不同人物的称盘并调整克数
- minimum_interaction: 玩家必须把有限粮块分到至少两个人物称盘，看到称量差额和关系预览后确认发放

## Mechanic Steps

1. 观察每个人 hunger/trust/suspicion
2. 拖动粮块到称盘
3. 比较每人分量和剩余 food
4. 确认发放并结算偏私后果

## State Coupling

每次有效操作必须同时推动两类后果：

- 生存/资源/进度压力：从 Required State 中选择至少一个直接变化
- 关系/风险/秩序压力：从 Required State 中选择至少一个直接变化

## Not A Choice List

- 不能只展示 2-4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作
- integration worker 必须让这个操作进入状态结算，而不是只写叙事反馈
