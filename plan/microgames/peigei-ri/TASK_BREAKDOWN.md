# TASK_BREAKDOWN: 配给日

## Worker Execution Order & Dependencies

```
foundation → state → content → ui → integration → qa
                  ↘         ↗         ↑
                   (并行)             |
```

- foundation 必须先完成
- state 和 content 可并行
- ui 依赖 foundation 骨架
- integration 依赖 state + content + ui 全部完成
- qa 最后执行

---

## 1. peigei-ri-foundation

- **lane:** foundation
- **level:** M
- **goal:** 建立项目骨架和类型定义，让后续 worker 有文件可以填充

### 输入合同
- 读取 DIRECTION_LOCK.md 中的 Required State 定义
- 读取 MINI_GDD.md 中的 UI Zones 布局

### 输出要求
- `index.html`：主页面，包含游戏容器和 3 个区域（状态栏、口粮堆+称盘、队列区）
- `src/types.ts`：GameState 接口定义（food, hunger, trust, suspicion, day, NPC_ID 常量）
- `src/main.ts`：空游戏入口，导出 init() 函数
- `src/style.css`：基础 CSS Grid 布局，3 行（状态栏 / 游戏区 / 队列区）

### 验收标准
- `index.html` 可在浏览器打开，显示空布局框架
- TypeScript 类型与 DIRECTION_LOCK Required State 一一对应
- 无游戏逻辑代码

### 禁止
- 不实现拖动逻辑
- 不实现状态计算
- 不添加 NPC 数据或事件文本

---

## 2. peigei-ri-state

- **lane:** logic
- **level:** M
- **goal:** 实现纯函数状态引擎：分配结算、日推进、崩溃检测

### 输入合同
- 读取 types.ts 中的 GameState 接口
- 读取 MECHANIC_SPEC.md 全部公式

### 输出要求
- `src/state.ts`：导出以下纯函数
  - `distribute(state, allocations): GameState` — 执行一次分配结算
  - `nextDay(state): GameState` — 日推进（重置 food，day++）
  - `checkCollapse(state): CollapseResult | null` — 崩溃检测
  - `getFairShare(state): number` — 返回公平线
  - `previewChanges(state, allocations): Preview` — 预览变化（不修改 state）
- 每个函数必须 100% 符合 MECHANIC_SPEC.md 公式

### 验收标准
- 公平分配 300g/人 → hunger 各降 5，trust 不变
- 老周 200g（少 100g）→ trust -5，hunger +2
- 张姐 < 公平线 * 0.7 → 额外 trust -5
- Day 5 方差 > 150g → suspicion +10
- hunger >= 80 → checkCollapse 返回崩溃
- suspicion >= 70 → checkCollapse 返回崩溃
- trust <= 10 → checkCollapse 返回崩溃
- 不依赖 DOM 或外部状态

### 禁止
- 不引入 UI 代码
- 不修改 types.ts
- 不硬编码 NPC 数据（通过参数传入）

---

## 3. peigei-ri-content

- **lane:** content
- **level:** M
- **goal:** 创建事件池和 NPC 对话文本

### 输入合同
- 读取 MINI_GDD.md 中的 NPC Roster 和 Day Pacing
- 读取 MECHANIC_SPEC.md 中的结算触发条件

### 输出要求
- `src/content.ts`：导出以下
  - `npcProfiles`: NPC 名字和人设数据
  - `getPhaseEvents(day): Event[]` — 返回当日可用事件
  - `getReaction(npcId, allocation, fairShare): string` — 返回 NPC 对分配的一句话反应
  - `getCollapseMessage(result): string` — 返回崩溃描述文本
- 总文本量控制在 100 行以内
- 4 个阶段事件：Phase A 无事件、Phase B 请求、Phase C 警告、Phase D 危机

### 验收标准
- Phase B 返回 NPC 请求文本（至少 2 条不同内容）
- Phase C 返回工头警告文本
- getReaction 对不同分配差额返回不同反应
- getCollapseMessage 对 3 种崩溃条件返回不同文本
- 所有文本为中文

### 禁止
- 不包含状态计算逻辑
- 不修改 types.ts
- 不依赖 DOM

---

## 4. peigei-ri-ui

- **lane:** ui
- **level:** M
- **goal:** 实现拖动粮块到称盘的交互组件

### 输入合同
- 读取 foundation 的 index.html 和 CSS 布局
- 读取 SCENE_INTERACTION_SPEC.md 全部规格

### 输出要求
- `src/ui.ts`：导出以下
  - `renderGame(container, state): void` — 渲染完整游戏界面
  - `renderFoodPile(container, food, onDragStart): void` — 口粮堆
  - `renderScales(container, npcs, allocations, fairShare): void` — 4 个称盘
  - `renderPreview(container, preview): void` — 关系预览面板
  - `renderQueue(container, events): void` — 队列/事件区
  - `onConfirm(callback): void` — 确认按钮回调注册
- 拖动实现：mousedown/mousemove/mouseup（或 HTML5 drag API）
- 精细调整：点击称盘粮块弹出 ±50g 步进器
- 称盘视觉：克数对比公平线的颜色反馈（绿/黄/灰）

### 验收标准
- 可拖动粮块到 4 个称盘
- 称盘显示实时克数
- 口粮堆块数随拖动减少
- 预览面板实时更新
- 至少 2 个称盘有粮块时确认按钮启用
- 称盘克数 > 公平线时绿色高亮

### 禁止
- 不实现状态计算
- 不触发游戏结算
- 不添加 NPC 对话逻辑
- 不使用"给 A / 给 B / 不给"按钮代替拖动

---

## 5. peigei-ri-integration

- **lane:** integration
- **level:** M
- **goal:** 把 state/content/ui 接成完整主循环

### 输入合同
- 引入 state.ts 的所有纯函数
- 引入 content.ts 的事件和反应函数
- 引入 ui.ts 的渲染函数
- 读取 ACCEPTANCE_PLAYTHROUGH.md Day 1 流程

### 输出要求
- 修改 `src/main.ts`：实现 init() 函数
  - 初始化 GameState
  - 调用 renderGame 显示界面
  - 注册拖动→称盘→预览→确认的完整交互链
  - 确认时：调用 distribute → getReaction → checkCollapse → nextDay
  - 崩溃时：显示失败画面
  - Day 8 结算无崩溃：显示成功画面
- 确保主循环：查看 → 称量 → 分发 → 结算 → 下一日

### 验收标准
- Day 1 完整流程可操作（ACCEPTANCE_PLAYTHROUGH.md Step 1-4）
- 公平分配后数值与预期一致
- NPC 反应文本正确显示
- Day 过渡正常
- 崩溃条件可触发并显示失败画面
- Day 8 完成显示成功画面

### 禁止
- 不修改 state.ts 的计算逻辑
- 不修改 content.ts 的文本
- 不修改 ui.ts 的渲染组件
- 不偏离 DIRECTION_LOCK 方向

---

## 6. peigei-ri-qa

- **lane:** qa
- **level:** S
- **goal:** 验证主循环数值正确性和崩溃条件

### 输入合同
- 引入 state.ts 的纯函数
- 读取 ACCEPTANCE_PLAYTHROUGH.md 全部验证点

### 输出要求
- `tests/state.test.ts`：单元测试覆盖
  - 公平分配数值
  - 偏私分配数值（含张姐特殊规则）
  - 怀疑机制（Day 5+ 方差触发）
  - 崩溃条件（hunger/trust/suspicion 阈值）
  - Day 推进和 food 重置
  - previewChanges 不修改原 state
- `tests/playthrough.md`：手工试玩记录模板

### 验收标准
- 所有 MECHANIC_SPEC 公式有对应测试
- ACCEPTANCE_PLAYTHROUGH.md 中每条 [ ] 有对应验证
- 测试可通过 `npm test` 运行
- 试玩记录覆盖 Day 1 和至少一条崩溃路径

### 禁止
- 不修改游戏实现代码
- 不跳过任何 ACCEPTANCE_PLAYTHROUGH 验证点
