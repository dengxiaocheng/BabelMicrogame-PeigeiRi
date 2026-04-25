import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RationDayGame } from "../src/main.js";
import { UIRenderer } from "../src/ui/renderer.js";
import {
  applyChoice, checkEndings, createInitialState,
  loadContent, runCycle, tickHunger,
} from "../src/state/engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Helpers for boundary tests ---
const R = { hunger_cap:10, hunger_floor:0, relationship_cap:10, relationship_floor:-10,
  risk_cap:10, risk_floor:0, guilt_cap:10 };
function cfg(o={}) {
  return { rounds:{total:3,phases:[{id:1,events_per_round:2,rations_available:8},
    {id:2,events_per_round:2,rations_available:6},{id:3,events_per_round:2,rations_available:4}]},
    initial_state:{player:{hunger:0,rations:8,guilt:0,debt:0},hunger_per_round:1},
    thresholds:{hunger:{critical:5,fatal:7},risk:{critical:9}},
    endings:{success:{id:"stable",name:"stable"},failures:[
      {id:"child_starved",condition:"xiao_mei.hunger >= fatal"},
      {id:"elder_starved",condition:"old_chen.hunger >= fatal"},
      {id:"guard_revolt",condition:"guard_wang.risk >= critical"},
      {id:"player_collapse",condition:"player.hunger >= fatal OR player.guilt >= 10"}]},
    state_rules:R,...o};
}
const CH = {characters:[
  {id:"xiao_mei",hunger_base:5,relationship_base:7,is_key_character:true},
  {id:"old_chen",hunger_base:3,relationship_base:5,is_key_character:true},
  {id:"guard_wang",hunger_base:4,relationship_base:3,is_key_character:true}]};

// ---------------------------------------------------------------------------
// 1. CLI Controller end-to-end
// ---------------------------------------------------------------------------
describe("CLI Controller – RationDayGame", () => {
  it("initializes with real content", () => {
    const g = new RationDayGame();
    assert.equal(g.state.currentRound, 1);
    assert.equal(g.state.gameOver, false);
    assert.ok(g.content.events.events.length >= 5);
  });

  it("returns phase-1 events at start", () => {
    const g = new RationDayGame();
    const ev = g.getCurrentEvents();
    assert.ok(ev.length > 0);
    for (const e of ev) assert.ok(e.phase.includes(1));
  });

  it("pickEvent returns event; choose advances state", () => {
    const g = new RationDayGame();
    const ev = g.pickEvent();
    assert.ok(ev && ev.choices.length > 0);
    const r = g.choose(ev, ev.choices[0].id);
    assert.equal(r.feedback, ev.choices[0].feedback);
    assert.equal(g.state.eventsProcessed, 1);
    assert.equal(g.state.eventIndex, 1);
  });

  it("throws on unknown choice id", () => {
    const g = new RationDayGame();
    assert.throws(() => g.choose(g.pickEvent(), "nonexistent"), /Unknown choice/);
  });

  it("getStatus returns correct initial structure", () => {
    const s = new RationDayGame().getStatus();
    assert.equal(s.round, 1);
    assert.equal(typeof s.hunger, "number");
    assert.ok(s.phaseName.length > 0);
  });

  it("pickEvent returns null after game over", () => {
    const g = new RationDayGame();
    g.state.gameOver = true;
    assert.equal(g.pickEvent(), null);
  });

  it("reaches failure ending via bad choices (child starvation)", () => {
    const g = new RationDayGame();
    let steps = 0;
    while (!g.isOver()) {
      const ev = g.pickEvent();
      if (!ev) break;
      const bad = ev.choices.find((c) => c.id === "fair_distribution");
      g.choose(ev, bad ? bad.id : ev.choices[0].id);
      if (++steps > 20) break;
    }
    assert.equal(g.isOver(), true);
    assert.equal(g.state.ending.type, "failure");
    assert.ok(steps >= 2);
  });

  it("completes a full game loop reaching an ending", () => {
    const g = new RationDayGame();
    let steps = 0;
    while (!g.isOver()) {
      const ev = g.pickEvent();
      if (!ev) break;
      g.choose(ev, ev.choices[0].id);
      if (++steps > 20) break;
    }
    assert.ok(g.isOver());
    assert.ok(g.state.ending && g.state.ending.id);
    assert.ok(steps >= 4);
  });
});

// ---------------------------------------------------------------------------
// 2. Web entry – static / module-level verification
// ---------------------------------------------------------------------------
describe("Web entry static verification", () => {
  const html = readFileSync(join(root, "index.html"), "utf-8");

  it("imports renderer and engine from correct paths", () => {
    assert.ok(html.includes('from "./src/ui/renderer.js"'));
    assert.ok(html.includes('from "./src/state/engine.js"'));
  });

  it("uses createInitialState and runCycle from engine", () => {
    assert.ok(html.includes("createInitialState"));
    assert.ok(html.includes("runCycle"));
  });

  it("fetches content from src/content/", () => {
    assert.ok(html.includes("src/content/game_config.json"));
    assert.ok(html.includes("src/content/characters.json"));
    assert.ok(html.includes("src/content/events.json"));
  });

  it("UIRenderer is constructable", () => {
    assert.equal(typeof UIRenderer, "function");
    const n = () => {};
    const ui = new UIRenderer({
      round:n,phase:n,hunger:n,rations:n,guilt:n,eventTitle:n,narrative:n,
      choices:{innerHTML:"",appendChild:n,querySelectorAll:()=>[]},
      feedback:n,ending:n,endingTitle:n,endingText:n,phaseTransition:n,
    });
    assert.ok(ui instanceof UIRenderer);
  });

  it("engine exports shared between CLI and Web", () => {
    for (const fn of [createInitialState, runCycle, applyChoice, tickHunger, checkEndings, loadContent])
      assert.equal(typeof fn, "function");
  });
});

// ---------------------------------------------------------------------------
// 3. Boundary / edge-case checks
// ---------------------------------------------------------------------------
describe("Boundary checks", () => {
  it("applyChoice with empty effects is safe", () => {
    const s = createInitialState(cfg(), CH);
    const n = applyChoice(s, {}, R);
    assert.deepEqual(n.characters, s.characters);
    assert.equal(n.eventsProcessed, 1);
  });

  it("tickHunger with zero changes nothing", () => {
    const s = createInitialState(cfg(), CH);
    const n = tickHunger(s, 0, R);
    assert.equal(n.characters.xiao_mei.hunger, s.characters.xiao_mei.hunger);
  });

  it("runCycle after game over is a no-op", () => {
    const s = createInitialState(cfg(), CH);
    s.gameOver = true; s.ending = {id:"x",type:"failure"};
    const r = runCycle(s, {player:{guilt:5}}, cfg());
    assert.equal(r.state.gameOver, true);
    assert.equal(r.ending.id, "x");
  });

  it("player guilt >= 10 triggers collapse", () => {
    const s = createInitialState(cfg(), CH);
    s.player.guilt = 9;
    const r = runCycle(s, {player:{guilt:1}}, cfg());
    assert.equal(r.ending.id, "player_collapse");
  });

  it("success requires all key characters strictly below critical", () => {
    const s = createInitialState(cfg(), CH);
    s.currentRound = 4;
    s.characters.xiao_mei.hunger = 2;
    s.characters.old_chen.hunger = 2;
    s.characters.guard_wang.hunger = 5;
    assert.equal(checkEndings(s, cfg()), null);
    s.characters.guard_wang.hunger = 4;
    assert.equal(checkEndings(s, cfg()).id, "stable");
  });
});
