# TASKS: 配给日

本文件保留给旧入口兼容；任务真源见 `TASK_BREAKDOWN.md`。

# TASK_BREAKDOWN: 配给日

## Standard Worker Bundle

1. `peigei-ri-foundation`
   - lane: foundation
   - level: M
   - goal: 建立只服务「查看人物饥饿和队列 -> 称量口粮 -> 分发 -> 结算饱腹/信任/怀疑 -> 下一日」的可运行骨架

2. `peigei-ri-state`
   - lane: logic
   - level: M
   - goal: 实现 Direction Lock 状态的一次分配/操作结算

3. `peigei-ri-content`
   - lane: content
   - level: M
   - goal: 用事件池强化「称量分配 + 队列压力 + 人情债」

4. `peigei-ri-ui`
   - lane: ui
   - level: M
   - goal: 让玩家看见核心压力、可选操作和后果反馈

5. `peigei-ri-integration`
   - lane: integration
   - level: M
   - goal: 把已有 state/content/ui 接成单一主循环

6. `peigei-ri-qa`
   - lane: qa
   - level: S
   - goal: 用测试和 scripted playthrough 确认方向没跑偏
