# MECHANIC_SPEC: 配给日

## Primary Mechanic

- mechanic: 称量分配 + 队列压力 + 人情债
- primary_input: 拖动粮块到不同人物的称盘并调整克数
- minimum_interaction: 玩家必须把有限粮块分到至少两个人物称盘，看到称量差额和关系预览后确认发放

## Distribution Phase（每日核心操作）

### Step 1: 观察
- 显示每个 NPC 的当前 hunger、trust
- 显示当日 food 池总量和公平线（food / 4）
- 显示队列顺序（影响谁先反应）

### Step 2: 称量分配
- 玩家从口粮堆拖动粮块到 NPC 称盘
- 每个称盘显示已放克数
- 称盘支持增减：点击已放粮块可调克数（±50g 步进）或拖回口粮堆
- 约束：所有称盘总克数 <= 当日 food

### Step 3: 预览确认
- 显示每人分配克数 vs 公平线
- 显示预计 hunger/trust 变化方向（↑↓箭头）
- 显示预计 suspicion 变化（如有）
- 玩家点击"确认发放"进入结算

### Step 4: 结算
- 执行状态计算（见公式）
- 触发 NPC 对话/事件
- 检查崩溃条件
- 若 Day < 8：进入下一日
- 若 Day = 8：进入结局

## State Calculation Formulas

### 饥饿变化（每人）
```
hunger_change = +15 (基础代谢) - grams_received / 15
hunger_new = clamp(hunger_old + hunger_change, 0, 100)
```
- 拿到 300g：hunger 不变（+15 - 20 = -5，微饱）
- 拿到 225g：hunger +0（刚好抵消代谢）
- 拿到 0g：hunger +15

### 信任变化（每人）
```
fair_share = total_food / 4
relative = grams_received - fair_share
trust_change = round(relative / 20)  // 每 20g 偏差 = ±1 trust
trust_new = clamp(trust_old + trust_change, 0, 100)
```
- 拿到公平份额：trust 不变
- 多拿 100g：trust +5
- 少拿 100g：trust -5

### 张姐特殊规则
- 当 grams_received < fair_share * 0.7 时：额外 trust -5（孩子吃不饱）
- 反映其"给少了 trust 暴降"的人设

### 怀疑变化（全局）
```
分配 = [g1, g2, g3, g4]
variance = max(分配) - min(分配)
if day >= 5:  // Phase C 工头抽查
  if variance > 150: suspicion += 10
  elif variance > 80: suspicion += 3
```
- Day 1-4：suspicion 不因分配方差变化
- Day 5-6：工头监督，大方差涨 suspicion

### 赵六特殊规则
- 当 zhaoliu 获得 > fair_share * 1.3 时：suspicion -= 3（他替你打掩护）
- 当 zhaoliu 获得 < fair_share * 0.5 时：trust 额外 -8（记仇）

## Day Transition

```
day += 1
if day <= 6: food = 1200
if day >= 7: food = 600
```
- Day transition 时触发事件（见 MINI_GDD 阶段描述）
- NPC 对话/请求在分配前显示

## Collapse Conditions（每次结算后检查）

| 条件 | 阈值 | 结果 |
|------|------|------|
| 任一 NPC hunger >= 80 | 人物倒下 | 失败结局 |
| suspicion >= 70 | 工头干预 | 失败结局 |
| 任一 NPC trust <= 10 | 关系破裂 | 失败结局 |
| Day 8 结算完成且无崩溃 | - | 成功结局 |

## Ending Conditions

### 成功结局
- Day 8 结算后无任何崩溃条件触发
- 结算画面显示：每人 hunger/trust 最终值、suspicion 最终值、总评价

### 失败结局
- 触发崩溃条件即进入
- 显示崩溃原因和当日状态快照
- 允许重新开始（从 Day 1）

## Not A Choice List

- 不能只展示 2-4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作
- integration worker 必须让拖动操作进入状态结算，而不是只写叙事反馈
