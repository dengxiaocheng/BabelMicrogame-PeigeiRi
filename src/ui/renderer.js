/* ──────────────────────────────────────────────
   配给日 · Scene-based UI Renderer
   Primary input: drag ration blocks to character bowls
   Core loop: 查看饥饿 → 称量口粮 → 分发 → 结算 → 下一日
   ────────────────────────────────────────────── */

// Character metadata (synced with content/characters.json)
const CHARS = {
  old_chen:   { name: "老陈",     role: "长老", hungry: "我不要紧……让孩子们先吃。", fed: "这口粮来得不容易，我记在心里。" },
  xiao_mei:   { name: "小梅",     role: "孩子", hungry: "爷爷，我肚子咕咕叫……",     fed: "谢谢！我吃饱啦！" },
  shi_fu:     { name: "石匠老赵", role: "工人", hungry: "今天搬了三百块砖，你说我能不能吃？", fed: "有劲了。明天继续。" },
  lin_sao:    { name: "林嫂",     role: "厨子", hungry: "锅里就剩这些了，我都数过。", fed: "分我的那份给别人吧，我能扛。" },
  guard_wang: { name: "守卫王虎", role: "守卫", hungry: "我守着粮仓，你看着办。",     fed: "公平就好。我认你这个人。" },
  shu_sheng:  { name: "书生李",   role: "书生", hungry: "我可以少吃，但墨不能断。",   fed: "思路清晰多了。" },
};
const CHAR_ORDER = ["old_chen", "xiao_mei", "shi_fu", "lin_sao", "guard_wang", "shu_sheng"];

function hColor(h) {
  if (h <= 1) return "#27ae60";
  if (h <= 3) return "#e2b714";
  if (h <= 5) return "#ff9800";
  return "#c0392b";
}

function hBar(h) {
  return "\u2588".repeat(Math.min(h, 10)) + "\u2591".repeat(Math.max(10 - h, 0));
}

// ── Styles ────────────────────────────────────
const CSS = `
:root{--bg:#1a1a2e;--fg:#e0e0e0;--accent:#e2b714;--card:#16213e;--border:#0f3460;--danger:#c0392b;--success:#27ae60}
*{box-sizing:border-box;margin:0;padding:0}
#app{width:min(720px,100%);padding:1.2rem;font-family:"Noto Serif SC","Songti SC",serif;color:var(--fg)}
.title{color:var(--accent);margin-bottom:.6rem;font-size:1.4rem}
.status-bar{display:flex;gap:.8rem;flex-wrap:wrap;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:.6rem;margin-bottom:.8rem;font-size:.9rem}
.scene{display:flex;flex-direction:column;gap:.8rem}
.narrative-panel{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:1rem;line-height:1.7;white-space:pre-wrap}
.section-label{color:var(--accent);font-size:.85rem;margin-bottom:.3rem}
.ration-pool{display:flex;flex-wrap:wrap;gap:6px;min-height:44px;padding:6px;background:rgba(22,33,62,.5);border-radius:6px;border:1px dashed var(--border)}
.ration-block{width:36px;height:36px;background:linear-gradient(135deg,#c9a227,#a8841a);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#1a1a2e;cursor:grab;user-select:none;touch-action:none;font-weight:bold;transition:transform .15s,opacity .15s}
.ration-block:hover{transform:scale(1.08)}
.ration-block.allocated{opacity:.25;pointer-events:none;cursor:default}
.ration-block.dragging-source{opacity:.3}
.dragging-ghost{position:fixed;z-index:1000;pointer-events:none;transform:scale(1.15);box-shadow:0 4px 12px rgba(0,0,0,.5)}
.char-card{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:.7rem .9rem;transition:border-color .2s}
.char-card:hover{border-color:var(--accent)}
.char-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.3rem}
.char-name{font-weight:bold;color:var(--fg);font-size:1rem}
.char-role{color:var(--accent);font-size:.75rem;opacity:.7}
.char-hunger{font-family:monospace;font-size:.8rem;margin-bottom:.3rem}
.char-dialogue{font-size:.8rem;color:#999;font-style:italic;margin-bottom:.4rem;min-height:1.2em}
.char-bowl{min-height:40px;padding:4px 6px;border:2px dashed var(--border);border-radius:8px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;transition:border-color .2s,background .2s;cursor:pointer}
.char-bowl.has-rations{border-color:var(--accent);background:rgba(226,183,20,.06)}
.char-bowl.drop-highlight{border-color:var(--success);background:rgba(39,174,96,.12);box-shadow:0 0 8px rgba(39,174,96,.3)}
.bowl-label{color:var(--border);font-size:.75rem;margin-right:4px}
.bowl-block{width:28px;height:28px;background:linear-gradient(135deg,#c9a227,#a8841a);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#1a1a2e;cursor:grab;touch-action:none;font-weight:bold}
.bowl-empty{color:var(--border);font-size:.75rem}
.char-rel{font-size:.75rem;color:#888;margin-top:.3rem}
.preview-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;padding:.5rem .7rem;background:var(--card);border:1px solid var(--border);border-radius:6px;font-size:.8rem}
.preview-effects{color:#aaa;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.action-bar{display:flex;gap:.6rem}
.action-btn{flex:1;padding:.7rem;border:1px solid var(--border);border-radius:6px;font:inherit;font-size:.95rem;cursor:pointer;transition:background .2s,border-color .2s}
.confirm-btn{background:rgba(226,183,20,.12);color:var(--accent);border-color:var(--accent)}
.confirm-btn:disabled{opacity:.35;cursor:default;border-color:var(--border)}
.confirm-btn:not(:disabled):hover{background:rgba(226,183,20,.25)}
.reset-btn{background:var(--card);color:var(--fg)}
.reset-btn:hover{border-color:var(--accent)}
.continue-btn{background:var(--card);color:var(--accent);border-color:var(--accent)}
.continue-btn:hover{background:rgba(226,183,20,.12)}
.feedback-panel{background:var(--card);border-left:3px solid var(--accent);padding:1.2rem;line-height:1.8;border-radius:4px}
.ending{text-align:center;padding:2rem}
.ending.success h2{color:var(--success)}
.ending.failure h2{color:var(--danger)}
.ending p{margin-top:1rem;line-height:1.8}
.min-warn{color:var(--danger);font-size:.8rem;padding:.3rem .5rem}
`;

// ── Renderer ──────────────────────────────────
export class UIRenderer {
  constructor(el) {
    this.el = el;
    this.app = document.getElementById("app");
    this._alloc = {};       // charId → count
    this._drag = null;
    this._state = null;
    this._onChoose = null;
    this._event = null;
    this._phaseText = "";
    this._ptrMove = this._onMove.bind(this);
    this._ptrUp = this._onUp.bind(this);
  }

  // ── Public API (compatible with index.html) ──

  renderStatus(state, phaseName) {
    this._state = state;
    const sb = this.app?.querySelector(".status-bar");
    if (sb) sb.innerHTML = this._statusHTML(state, phaseName);
  }

  renderEvent(event, onChoose) {
    this._onChoose = onChoose;
    this._event = event;
    this._alloc = {};
    this._buildScene();
  }

  renderFeedback(text) {
    const scene = this.app?.querySelector(".scene");
    if (scene) scene.innerHTML = `<div class="feedback-panel"><p>${text}</p></div>`;
  }

  renderPhaseTransition(text) { this._phaseText = text || ""; }

  showContinue(onContinue) {
    const scene = this.app?.querySelector(".scene");
    if (!scene) return;
    const btn = document.createElement("button");
    btn.className = "action-btn continue-btn";
    btn.textContent = this._phaseText ? `${this._phaseText} — 继续` : "继续";
    btn.addEventListener("click", () => onContinue());
    scene.appendChild(btn);
  }

  renderEnding(ending) {
    this.app.innerHTML = `<style>${CSS}</style><h1 class="title">配给日</h1>
      <div class="ending ${ending.type}"><h2>${ending.name}</h2><p>${ending.text}</p></div>`;
  }

  // ── Scene Construction ──────────────────────

  _buildScene() {
    const s = this._state;
    const ev = this._event;
    this.app.innerHTML = `<style>${CSS}</style>
      <h1 class="title">配给日</h1>
      <div class="status-bar">${this._statusHTML(s)}</div>
      <div class="scene">
        <div class="narrative-panel">${ev ? ev.narrative : "查看队列，开始分配口粮。"}</div>
        <div><div class="section-label">口粮堆 · <span id="pool-count">${s.player.rations}</span> 份</div>
          <div class="ration-pool" id="pool"></div></div>
        <div><div class="section-label">排队队列 — 拖动粮块到碗称中</div>
          <div id="queue" style="display:flex;flex-direction:column;gap:.5rem"></div></div>
        <div class="preview-bar">
          <span id="pv-alloc">已分配: 0 / ${s.player.rations}</span>
          <span class="preview-effects" id="pv-fx"></span>
        </div>
        <div id="pv-warn"></div>
        <div class="action-bar">
          <button class="action-btn confirm-btn" id="btn-confirm" disabled>确认发放</button>
          <button class="action-btn reset-btn" id="btn-reset">重置</button>
        </div>
      </div>`;

    this._fillPool(s.player.rations);
    this._fillQueue(s);
    document.getElementById("btn-confirm").addEventListener("click", () => this._confirm());
    document.getElementById("btn-reset").addEventListener("click", () => this._reset());
  }

  _fillPool(n) {
    const pool = document.getElementById("pool");
    for (let i = 0; i < n; i++) {
      const b = document.createElement("div");
      b.className = "ration-block";
      b.textContent = "粮";
      b.dataset.idx = i;
      b.addEventListener("pointerdown", (e) => this._startDrag(e, b, "pool"));
      pool.appendChild(b);
    }
  }

  _fillQueue(s) {
    const queue = document.getElementById("queue");
    for (const id of CHAR_ORDER) {
      const c = s.characters[id];
      if (!c) continue;
      const m = CHARS[id];
      const h = c.hunger;
      const dialogue = h >= 3 ? m.hungry : (c.relationship >= 5 ? m.fed : "");

      const card = document.createElement("div");
      card.className = "char-card";
      card.innerHTML = `
        <div class="char-header"><span class="char-name">${m.name}</span><span class="char-role">${m.role}</span></div>
        <div class="char-hunger" style="color:${hColor(h)}">饥饿 <span class="hbar">${hBar(h)}</span> ${h}</div>
        <div class="char-dialogue">${dialogue}</div>
        <div class="char-bowl" id="bowl-${id}" data-cid="${id}"><span class="bowl-label">碗</span><span class="bowl-empty">拖入粮块</span></div>
        <div class="char-rel">信任 ${c.relationship} · 风险 ${c.risk}</div>`;
      queue.appendChild(card);
    }
  }

  // ── Drag & Drop (pointer events) ────────────

  _startDrag(e, blockEl, source, fromCharId) {
    e.preventDefault();
    if (source === "pool" && blockEl.classList.contains("allocated")) return;
    const rect = blockEl.getBoundingClientRect();
    const ghost = blockEl.cloneNode(true);
    ghost.className = "ration-block dragging-ghost";
    ghost.style.left = (e.clientX - 18) + "px";
    ghost.style.top = (e.clientY - 18) + "px";
    document.body.appendChild(ghost);
    blockEl.classList.add("dragging-source");
    this._drag = { ghost, blockEl, source, fromCharId, ox: 18, oy: 18 };
    document.addEventListener("pointermove", this._ptrMove);
    document.addEventListener("pointerup", this._ptrUp);
  }

  _onMove(e) {
    const d = this._drag;
    if (!d) return;
    d.ghost.style.left = (e.clientX - d.ox) + "px";
    d.ghost.style.top = (e.clientY - d.oy) + "px";
    this.app.querySelectorAll(".char-bowl").forEach(b => b.classList.remove("drop-highlight"));
    const t = this._bowlAt(e.clientX, e.clientY);
    if (t) t.classList.add("drop-highlight");
  }

  _onUp(e) {
    document.removeEventListener("pointermove", this._ptrMove);
    document.removeEventListener("pointerup", this._ptrUp);
    const d = this._drag;
    if (!d) return;
    const target = this._bowlAt(e.clientX, e.clientY);
    if (target) {
      const cid = target.dataset.cid;
      if (d.source === "pool") {
        this._add(cid);
      } else if (d.source === "bowl" && d.fromCharId !== cid) {
        this._move(d.fromCharId, cid);
      }
    } else if (d.source === "bowl") {
      this._remove(d.fromCharId);
    }
    d.ghost.remove();
    d.blockEl.classList.remove("dragging-source");
    this._drag = null;
    this.app.querySelectorAll(".char-bowl").forEach(b => b.classList.remove("drop-highlight"));
  }

  _bowlAt(x, y) {
    for (const b of this.app.querySelectorAll(".char-bowl")) {
      const r = b.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
    }
    return null;
  }

  // ── Allocation Logic ────────────────────────

  _totalAlloc() { return Object.values(this._alloc).reduce((a, v) => a + v, 0); }

  _add(cid) {
    if (this._totalAlloc() >= this._state.player.rations) return;
    this._alloc[cid] = (this._alloc[cid] || 0) + 1;
    const pool = document.querySelectorAll("#pool .ration-block:not(.allocated)");
    if (pool.length) pool[pool.length - 1].classList.add("allocated");
    this._refresh();
  }

  _remove(cid) {
    if ((this._alloc[cid] || 0) <= 0) return;
    this._alloc[cid]--;
    const used = document.querySelectorAll("#pool .ration-block.allocated");
    if (used.length) used[used.length - 1].classList.remove("allocated");
    this._refresh();
  }

  _move(from, to) {
    if ((this._alloc[from] || 0) <= 0) return;
    this._alloc[from]--;
    this._alloc[to] = (this._alloc[to] || 0) + 1;
    this._refresh();
  }

  _reset() {
    this._alloc = {};
    document.querySelectorAll("#pool .ration-block.allocated").forEach(b => b.classList.remove("allocated"));
    this._refresh();
  }

  _refresh() {
    const max = this._state.player.rations;
    const total = this._totalAlloc();

    // Pool count
    const pc = document.getElementById("pool-count");
    if (pc) pc.textContent = max - total;

    // Bowls
    for (const id of CHAR_ORDER) {
      const bowl = document.getElementById("bowl-" + id);
      if (!bowl) continue;
      const n = this._alloc[id] || 0;
      bowl.classList.toggle("has-rations", n > 0);
      // Remove old bowl-blocks
      bowl.querySelectorAll(".bowl-block, .bowl-empty").forEach(e => e.remove());
      for (let i = 0; i < n; i++) {
        const bb = document.createElement("div");
        bb.className = "bowl-block";
        bb.textContent = "粮";
        const cid = id;
        bb.addEventListener("pointerdown", (ev) => this._startDrag(ev, bb, "bowl", cid));
        bowl.appendChild(bb);
      }
      if (n === 0) {
        const em = document.createElement("span");
        em.className = "bowl-empty";
        em.textContent = "拖入粮块";
        bowl.appendChild(em);
      }
    }

    // Preview
    const pvA = document.getElementById("pv-alloc");
    if (pvA) pvA.textContent = `已分配: ${total} / ${max}`;

    // Effects preview
    const pvFx = document.getElementById("pv-fx");
    if (pvFx) {
      const fx = this._calcEffects();
      const parts = [];
      for (const [cid, ef] of Object.entries(fx)) {
        if (cid === "player" || cid === "meta") continue;
        const ch = [];
        if (ef.hunger) ch.push(`饥饿${ef.hunger}`);
        if (ef.relationship) ch.push(`信任${ef.relationship > 0 ? "+" : ""}${ef.relationship}`);
        if (ef.risk) ch.push(`风险+${ef.risk}`);
        if (ch.length) parts.push(`${CHARS[cid]?.name}: ${ch.join(" ")}`);
      }
      pvFx.textContent = parts.join(" | ");
    }

    // Warning
    const warn = document.getElementById("pv-warn");
    if (warn) {
      const receivers = Object.values(this._alloc).filter(v => v > 0).length;
      warn.innerHTML = (total > 0 && receivers < 2)
        ? `<div class="min-warn">必须分配给至少两个人物才能确认发放</div>` : "";
    }

    // Confirm button
    const btn = document.getElementById("btn-confirm");
    if (btn) {
      const receivers = Object.values(this._alloc).filter(v => v > 0).length;
      btn.disabled = total === 0 || receivers < 2;
    }
  }

  // ── Effect Calculation ──────────────────────

  _calcEffects() {
    const fx = {};
    const total = this._totalAlloc();
    const entries = Object.entries(this._alloc).filter(([, v]) => v > 0);
    const avg = entries.length ? total / entries.length : 0;

    for (const id of CHAR_ORDER) {
      const alloc = this._alloc[id] || 0;
      const ef = { hunger: 0, relationship: 0, risk: 0 };
      ef.hunger = -alloc * 2;                        // each ration reduces hunger by 2
      if (alloc > 0) {
        ef.relationship = alloc > avg + 0.5 ? 1 : alloc < avg - 0.5 ? -1 : 0;
      } else if (total > 0) {
        ef.relationship = -1;
        ef.risk = 1;
      }
      fx[id] = ef;
    }

    // Player effects
    let guilt = 0;
    if (entries.length >= 2) {
      const vals = entries.map(([, v]) => v);
      const diff = Math.max(...vals) - Math.min(...vals);
      if (diff >= 3) guilt = 2;
      else if (diff >= 2) guilt = 1;
    }
    const leftOut = CHAR_ORDER.filter(id => !(this._alloc[id] > 0)).length;
    if (leftOut > 0 && total > 0) guilt = Math.max(guilt, leftOut);

    fx.player = { rations: -total, hunger: 0, guilt };
    return fx;
  }

  // ── Confirm / Feedback ──────────────────────

  _confirm() {
    const total = this._totalAlloc();
    if (total === 0) return;
    const receivers = Object.values(this._alloc).filter(v => v > 0).length;
    if (receivers < 2) return;

    const effects = this._calcEffects();
    const feedback = this._makeFeedback();
    if (this._onChoose) this._onChoose({ effects, feedback });
  }

  _makeFeedback() {
    const parts = [];
    for (const [id, n] of Object.entries(this._alloc)) {
      if (n <= 0) continue;
      const m = CHARS[id];
      if (n >= 2) parts.push(`${m.name}端着满满的碗，${m.fed}`);
      else parts.push(`${m.name}领到了${n}份口粮。`);
    }
    const left = CHAR_ORDER.filter(id => !(this._alloc[id] > 0)).map(id => CHARS[id]?.name).filter(Boolean);
    if (left.length && this._totalAlloc() > 0) parts.push(`${left.join("、")}的碗里空空的。没有人说话。`);
    parts.push(`你一共分出了 ${this._totalAlloc()} 份口粮。`);
    return parts.join("");
  }

  // ── Helpers ─────────────────────────────────

  _statusHTML(s, phaseName) {
    const ph = phaseName || this._state?.currentPhaseId
      ? (this._state?.currentPhaseId ? `第${this._state.currentPhaseId}轮` : "") : "";
    return `<span>Day ${s.currentRound}</span><span>${ph}</span>`
      + `<span>配给 ${s.player.rations}</span><span>饥饿 ${s.player.hunger}</span>`
      + `<span>负罪 ${s.player.guilt}</span>`
      + (s.player.debt ? `<span>人情债 ${s.player.debt}</span>` : "");
  }
}
