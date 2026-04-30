# SCENE_INTERACTION_SPEC: 配给日

## Scene Objects

- 口粮堆
- 人物称盘
- 排队队列
- 工头抽查标记

## Player Input

- primary_input: 拖动粮块到不同人物的称盘并调整克数
- minimum_interaction: 玩家必须把有限粮块分到至少两个人物称盘，看到称量差额和关系预览后确认发放

## Feedback Channels

- 称盘重量变化
- 人物饥饿下降或恶化
- trust/suspicion 预览
- 队列骚动文本

## Forbidden UI

- 不允许只用“给 A/给 B/不给”按钮
- 不允许做餐厅经营菜单

## Acceptance Rule

- 首屏必须让玩家看到至少一个可直接操作的场景对象
- 玩家操作必须产生即时可见反馈，且反馈能追溯到 Required State
- 不得只靠随机事件文本或普通选择按钮完成主循环
