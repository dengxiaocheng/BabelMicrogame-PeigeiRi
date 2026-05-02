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

// ---------------------------------------------------------------------------
// 4. Primary Input → State Delta (_calcEffects allocation mapping)
// ---------------------------------------------------------------------------
describe("Primary Input → State Delta", () => {
  function makeRenderer() {
    const n = () => {};
    const ui = new UIRenderer({
      round:n,phase:n,hunger:n,rations:n,guilt:n,eventTitle:n,narrative:n,
      choices:{innerHTML:"",appendChild:n,querySelectorAll:()=>[]},
      feedback:n,ending:n,endingTitle:n,endingText:n,phaseTransition:n,
    });
    ui._alloc = { old_chen:0, xiao_mei:0, guard_wang:0 };
    ui._state = { player:{ rations:8, hunger:0, guilt:0 }, currentRound:1 };
    return ui;
  }

  it("1 ration block = -2 hunger per character", () => {
    const ui = makeRenderer();
    ui._alloc.xiao_mei = 1;
    ui._alloc.old_chen = 1;
    const fx = ui._calcEffects();
    assert.equal(fx.xiao_mei.hunger, -2);
    assert.equal(fx.old_chen.hunger, -2);
  });

  it("favored allocation (3 vs 1) gives relationship +1/-1", () => {
    const ui = makeRenderer();
    ui._alloc.xiao_mei = 3;
    ui._alloc.old_chen = 1;
    const fx = ui._calcEffects();
    assert.equal(fx.xiao_mei.relationship, 1);
    assert.equal(fx.old_chen.relationship, -1);
  });

  it("skipped characters get risk +1 and relationship -1", () => {
    const ui = makeRenderer();
    ui._alloc.xiao_mei = 2;
    ui._alloc.old_chen = 2;
    const fx = ui._calcEffects();
    assert.equal(fx.guard_wang.risk, 1);
    assert.equal(fx.guard_wang.relationship, -1);
  });

  it("player rations decrease by total allocated; guilt from disparity", () => {
    const ui = makeRenderer();
    ui._alloc.xiao_mei = 3;
    ui._alloc.old_chen = 0;
    ui._alloc.guard_wang = 1;
    const fx = ui._calcEffects();
    assert.equal(fx.player.rations, -4);
    assert.ok(fx.player.guilt >= 1, "guilt from 3 vs 1 disparity");
  });

  it("allocation effects flow through engine to produce state delta", () => {
    const s = createInitialState(cfg(), CH);
    // Simulate: xiao_mei gets 2, old_chen gets 2, guard_wang skipped
    const effects = {
      xiao_mei:{ hunger:-4, relationship:0, risk:0 },
      old_chen:{ hunger:-4, relationship:0, risk:0 },
      guard_wang:{ hunger:0, relationship:-1, risk:1 },
      player:{ rations:-4, hunger:0, guilt:1 },
    };
    const n = applyChoice(s, effects, R);
    assert.equal(n.characters.xiao_mei.hunger, s.characters.xiao_mei.hunger - 4);
    assert.equal(n.characters.guard_wang.risk, s.characters.guard_wang.risk + 1);
    assert.equal(n.characters.guard_wang.relationship, s.characters.guard_wang.relationship - 1);
    assert.equal(n.player.rations, s.player.rations - 4);
  });
});

// ---------------------------------------------------------------------------
// 5. Acceptance Playthrough – core loop verification
// ---------------------------------------------------------------------------
describe("Acceptance Playthrough – core loop", () => {
  it("full core loop: observe → allocate → settle → advance day", () => {
    // Use events_per_round:1 so a single runCycle advances the day
    const config = cfg({rounds:{total:3,phases:[
      {id:1,events_per_round:1,rations_available:8},
      {id:2,events_per_round:1,rations_available:6},
      {id:3,events_per_round:1,rations_available:4}]}});

    // Step 1: observe 5 required states visible
    const s = createInitialState(config, CH);
    assert.ok("rations" in s.player, "food state visible");
    assert.ok(s.characters.xiao_mei.hunger >= 0, "hunger visible");
    assert.ok(s.characters.old_chen.relationship !== undefined, "trust visible");
    assert.ok(s.characters.guard_wang.risk >= 0, "suspicion visible");
    assert.equal(s.currentRound, 1, "day visible");

    // Step 2: allocate (simulating ration distribution to 2+ characters)
    const effects = {
      xiao_mei:{ hunger:-4, relationship:1, risk:0 },
      old_chen:{ hunger:-2, relationship:-1, risk:0 },
      guard_wang:{ hunger:0, relationship:-1, risk:1 },
      player:{ rations:-4, hunger:0, guilt:1 },
    };

    // Step 3: run through engine (applyChoice → tickHunger → settleRound → advanceRound)
    const result = runCycle(s, effects, config);

    // Step 4: verify resource/body pressure change (hunger reduced)
    assert.ok(
      result.state.characters.xiao_mei.hunger < s.characters.xiao_mei.hunger,
      "resource pressure: hunger changed",
    );

    // Step 5: verify relationship/risk pressure change
    assert.ok(
      result.state.characters.guard_wang.risk > s.characters.guard_wang.risk ||
      result.state.characters.old_chen.relationship < s.characters.old_chen.relationship,
      "relationship pressure: trust/risk changed",
    );

    // Step 6: day advanced
    assert.ok(result.state.currentRound > s.currentRound, "day advanced");
  });
});
