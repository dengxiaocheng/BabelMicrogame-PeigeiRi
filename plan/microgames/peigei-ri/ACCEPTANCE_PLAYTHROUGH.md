# ACCEPTANCE_PLAYTHROUGH: 配给日

## Minimum Playable Flow

以下是验证主循环是否可运行的最低脚本。执行 worker 必须让这个流程完整可操作。

### Day 1 — 基本操作验证

**初始状态：**
```
day=1, food=1200, suspicion=0
hunger={ laozhou:20, xiaochen:25, zhangjie:30, zhaoliu:20 }
trust ={ laozhou:50, xiaochen:50, zhangjie:50, zhaoliu:50 }
```

**Step 1: 查看人物饥饿和队列**
- [ ] 界面显示 4 个 NPC 称盘，每人显示 hunger/trust
- [ ] 状态栏显示 Day 1、剩余口粮 1200g、怀疑 0
- [ ] 公平线显示 300g/人

**Step 2: 称量口粮**
- [ ] 玩家从口粮堆拖动粮块到老周称盘，放入 300g（6 块）
- [ ] 玩家从口粮堆拖动粮块到小陈称盘，放入 300g
- [ ] 玩家从口粮堆拖动粮块到张姐称盘，放入 300g
- [ ] 玩家从口粮堆拖动粮块到赵六称盘，放入 300g
- [ ] 口粮堆显示 0g 剩余

**Step 3: 预览确认**
- [ ] 预览面板显示：每人差额 = 0g（公平分配）
- [ ] 预期 hunger 变化：各 ↓5（300/15=20，20-15=5 减少）
- [ ] 预期 trust 变化：各 → 不变
- [ ] 预期 suspicion 变化：→ 不变
- [ ] 玩家点击"确认发放"

**Step 4: 结算**
- [ ] 结算后状态：
  ```
  hunger={ laozhou:15, xiaochen:20, zhangjie:25, zhaoliu:15 }
  trust ={ laozhou:50, xiaochen:50, zhangjie:50, zhaoliu:50 }
  suspicion=0
  ```
- [ ] 无崩溃条件触发
- [ ] 过渡到 Day 2

### Day 1 — 偏私操作验证

**替代路径（测试偏私机制）：**

**Step 2-alt: 不均匀分配**
- 老周：200g，小陈：300g，张姐：400g，赵六：300g
- 总计 1200g

**Step 3-alt: 预览**
- [ ] 预览显示差额：老周 -100g，张姐 +100g
- [ ] 预期 hunger：老周 ↑10，张姐 ↓12，其余正常
- [ ] 预期 trust：老周 ↓5，张姐 ↑5，其余不变
- [ ] suspicion：不变（Day 1 无工头）

**Step 4-alt: 结算**
- [ ] 结算后：
  ```
  hunger_change:
    laozhou: +15 - 200/15 = +15 - 13.3 ≈ +2 → hunger: 22
    xiaochen: +15 - 300/15 = +15 - 20 = -5 → hunger: 20
    zhangjie: +15 - 400/15 = +15 - 26.7 ≈ -12 → hunger: 18
    zhaoliu:  +15 - 300/15 = -5 → hunger: 15
  trust_change:
    laozhou: (200-300)/20 = -5 → trust: 45
    xiaochen: 0 → trust: 50
    zhangjie: (400-300)/20 = +5 → trust: 55
    zhaoliu: 0 → trust: 50
  ```
- [ ] 无崩溃

### Day 5 — 怀疑机制验证

**前置：假设 Day 1-4 都已正常通过，suspicion=0**

**Step: 大方差分配触发 suspicion**
- 老周：150g，小陈：150g，张姐：450g，赵六：450g
- 方差 = 450-150 = 300g > 150g
- [ ] 预览显示 suspicion 预计 ↑10
- [ ] 结算后 suspicion = 10

### Day 7 — 危机验证

**Step: 口粮减半**
- [ ] 状态栏显示 food = 600g
- [ ] 公平线显示 150g/人
- [ ] 不可能让所有人满意，考验 trust 缓冲

### 崩溃验证

**任一崩溃路径：**
- [ ] 持续不给张姐口粮 → trust <= 10 → 触发"关系破裂"失败
- [ ] Day 5-6 大方差分配 → suspicion >= 70 → 触发"工头干预"失败
- [ ] 持续少给某人 → hunger >= 80 → 触发"人物倒下"失败

## Pass Criteria

1. Day 1 完整流程可操作：从查看到结算，所有 Step 通过
2. 拖动粮块操作流畅：拖入称盘 → 克数增加 → 预览更新
3. 结算数值与 MECHANIC_SPEC 公式一致
4. 至少一条崩溃路径可触发
5. Day 7 口粮减半生效

## Direction Gate

- integration worker 必须让上述 Day 1 完整流程可试玩
- qa worker 必须用测试验证数值计算和崩溃条件
- 如试玩要求需要偏离 Direction Lock，停止并回交 manager
