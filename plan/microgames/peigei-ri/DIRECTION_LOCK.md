# Direction Lock: 配给日

## One Sentence
玩家在饥饿、偏私和秩序压力下分配有限口粮，并承担关系与生存后果。

## Core Loop
1. 查看人物饥饿和队列 -> 称量口粮 -> 分发 -> 结算饱腹/信任/怀疑 -> 下一日
2. 按 20 分钟节奏推进，8 天 4 阶段：正常分粮(1-2) -> 熟人插队(3-4) -> 工头抽查(5-6) -> 口粮减半危机(7-8)

## Must Keep
- 核心机制：称量分配 + 队列压力 + 人情债
- 核心循环：查看 -> 称量 -> 分发 -> 结算 -> 下一日
- 4 名 NPC（老周、小陈、张姐、赵六），每人独立 hunger/trust/suspicion
- 全局 food（每日口粮池）和 day（当前天数，1-8）
- 20 分钟结构只作为节奏，不扩成大项目

## Must Not Add
- 不做经营餐厅；核心是短缺中的分配伦理
- 不新增第二套主循环
- 不把小游戏扩成长期经营或开放世界
- 不增加第 5 名及以上 NPC
- 不超过 8 天

## Required State
- food: number — 当日剩余口粮克数
- hunger: Record<NPC_ID, number> — 每 NPC 饥饿值 0-100
- trust: Record<NPC_ID, number> — 每 NPC 信任值 0-100
- suspicion: number — 工头怀疑值 0-100
- day: number — 当前天数 1-8

## Success
在 8 天内完成主循环，未触发任何崩溃条件，进入结算

## Failure（任一触发即结束）
- 任一 NPC hunger >= 80：人物倒下
- suspicion >= 70：工头干预
- 任一 NPC trust <= 10：关系破裂
