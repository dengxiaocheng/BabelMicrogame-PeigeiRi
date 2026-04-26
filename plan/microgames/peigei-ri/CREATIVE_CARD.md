# CREATIVE_CARD: 配给日

- slug: `peigei-ri`
- creative_line: 配给日
- target_runtime: web
- target_minutes: 20
- core_emotion: 称量分配 + 队列压力 + 人情债
- core_loop: 查看人物饥饿和队列 -> 称量口粮 -> 分发 -> 结算饱腹/信任/怀疑 -> 下一日
- failure_condition: 关键状态崩溃，或在本轮主循环中被系统淘汰
- success_condition: 在限定时长内完成主循环，并稳定进入至少一个可结算结局

## Intent

- 做一个 Babel 相关的单创意线微游戏
- 只保留一个主循环，不扩成大项目
- 让 Claude worker 能按固定 packet 稳定并行
