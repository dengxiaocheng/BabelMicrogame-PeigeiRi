import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceRound,
  applyChoice,
  checkEndings,
  createInitialState,
  initGame,
  loadContent,
  runCycle,
  tickHunger,
} from "./engine.js";
const RULES = {
  hunger_cap: 10, hunger_floor: 0,
  relationship_cap: 10, relationship_floor: -10,
  risk_cap: 10, risk_floor: 0,
  guilt_cap: 10,
};
function makeConfig(overrides = {}) {
  return {
    rounds: {
      total: 3,
      phases: [
        { id: 1, events_per_round: 2, rations_available: 8 },
        { id: 2, events_per_round: 2, rations_available: 6 },
        { id: 3, events_per_round: 2, rations_available: 4 },
      ],
    },
    initial_state: { player: { hunger: 0, rations: 8, guilt: 0, debt: 0 }, hunger_per_round: 1 },
    thresholds: {
      hunger: { critical: 5, fatal: 7 },
      risk: { critical: 9 },
    },
    endings: {
      success: { id: "stable", name: "stable" },
      failures: [
        { id: "child_starved", condition: "xiao_mei.hunger >= fatal" },
        { id: "elder_starved", condition: "old_chen.hunger >= fatal" },
        { id: "guard_revolt", condition: "guard_wang.risk >= critical" },
        { id: "player_collapse", condition: "player.hunger >= fatal OR player.guilt >= 10" },
      ],
    },
    state_rules: RULES,
    ...overrides,
  };
}
const CHARS = {
  characters: [
    char("xiao_mei", 5, 7),
    char("old_chen", 3, 5),
    char("guard_wang", 4, 3),
  ],
};
function char(id, hunger_base, relationship_base) {
  return { id, hunger_base, relationship_base, is_key_character: true };
}
describe("createInitialState", () => {
  it("initializes player, characters, and key character ids", () => {
    const state = createInitialState(makeConfig(), CHARS);
    assert.equal(state.currentRound, 1);
    assert.equal(state.player.rations, 8);
    assert.equal(state.characters.xiao_mei.hunger, 5);
    assert.deepEqual(state.keyCharacters, ["xiao_mei", "old_chen", "guard_wang"]);
    assert.equal(state.gameOver, false);
  });
});
describe("applyChoice", () => {
  it("applies character and player effects", () => {
    const state = createInitialState(makeConfig(), CHARS);
    const next = applyChoice(state, {
      xiao_mei: { hunger: -3, relationship: 2 },
      old_chen: { relationship: 2 },
      guard_wang: { relationship: -1 },
      player: { rations: -1, guilt: -1 },
    }, RULES);
    assert.equal(next.characters.xiao_mei.hunger, 2);
    assert.equal(next.characters.xiao_mei.relationship, 9);
    assert.equal(next.characters.old_chen.relationship, 7);
    assert.equal(next.characters.guard_wang.relationship, 2);
    assert.equal(next.player.rations, 7);
    assert.equal(next.player.guilt, 0);
    assert.equal(next.eventsProcessed, 1);
  });
  it("clamps bounded values", () => {
    const state = createInitialState(makeConfig(), CHARS);
    const next = applyChoice(state, {
      xiao_mei: { hunger: -20 },
      guard_wang: { risk: 100, relationship: -100 },
      player: { guilt: 100 },
    }, RULES);
    assert.equal(next.characters.xiao_mei.hunger, 0);
    assert.equal(next.characters.guard_wang.risk, 10);
    assert.equal(next.characters.guard_wang.relationship, -10);
    assert.equal(next.player.guilt, 10);
  });
  it("tracks bonus ration meta effects", () => {
    const state = createInitialState(makeConfig(), CHARS);
    const next = applyChoice(state, {
      player: { rations: -1 },
      meta: { bonus_rations: 2 },
    }, RULES);
    assert.equal(next.player.rations, 7);
    assert.equal(next.bonusRations, 2);
  });
  it("does not mutate the original state", () => {
    const state = createInitialState(makeConfig(), CHARS);
    const before = structuredClone(state);
    applyChoice(state, { xiao_mei: { hunger: -5 } }, RULES);
    assert.deepEqual(state, before);
  });
});
describe("tickHunger", () => {
  it("increments player and character hunger", () => {
    const state = createInitialState(makeConfig(), CHARS);
    const next = tickHunger(state, 1, RULES);
    assert.equal(next.characters.xiao_mei.hunger, 6);
    assert.equal(next.characters.old_chen.hunger, 4);
    assert.equal(next.player.hunger, 1);
  });
  it("clamps hunger at cap", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.characters.xiao_mei.hunger = 10;
    assert.equal(tickHunger(state, 1, RULES).characters.xiao_mei.hunger, 10);
  });
});
describe("checkEndings", () => {
  it("returns null when no condition is met", () => {
    assert.equal(checkEndings(createInitialState(makeConfig(), CHARS), makeConfig()), null);
  });
  it("detects starvation, revolt, and player collapse failures", () => {
    const child = createInitialState(makeConfig(), CHARS);
    child.characters.xiao_mei.hunger = 7;
    assert.equal(checkEndings(child, makeConfig()).id, "child_starved");
    const guard = createInitialState(makeConfig(), CHARS);
    guard.characters.guard_wang.risk = 9;
    assert.equal(checkEndings(guard, makeConfig()).id, "guard_revolt");
    const player = createInitialState(makeConfig(), CHARS);
    player.player.guilt = 10;
    assert.equal(checkEndings(player, makeConfig()).id, "player_collapse");
  });
  it("detects success after all rounds when key characters are safe", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.currentRound = 4;
    state.player.hunger = 3;
    state.characters.xiao_mei.hunger = 2;
    state.characters.old_chen.hunger = 2;
    state.characters.guard_wang.hunger = 2;
    assert.equal(checkEndings(state, makeConfig()).id, "stable");
  });
  it("prioritizes final failure over final success", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.currentRound = 4;
    state.characters.xiao_mei.hunger = 2;
    state.characters.old_chen.hunger = 2;
    state.characters.guard_wang.hunger = 2;
    state.characters.guard_wang.risk = 9;
    assert.equal(checkEndings(state, makeConfig()).id, "guard_revolt");
  });
});
describe("advanceRound", () => {
  it("moves to the next phase", () => {
    const state = advanceRound(createInitialState(makeConfig(), CHARS), makeConfig());
    assert.equal(state.currentRound, 2);
    assert.equal(state.currentPhaseId, 2);
    assert.equal(state.roundRations, 6);
    assert.equal(state.eventIndex, 0);
  });
  it("moves past the total round count when complete", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.currentRound = 3;
    assert.equal(advanceRound(state, makeConfig()).currentRound, 4);
  });
});
describe("runCycle", () => {
  it("applies two events, ticks hunger, and advances round", () => {
    const config = makeConfig();
    const first = runCycle(createInitialState(config, CHARS), {
      xiao_mei: { hunger: -3, relationship: 2 },
      player: { rations: -1 },
    }, config);
    assert.equal(first.state.currentRound, 1);
    assert.equal(first.state.eventsProcessed, 1);
    const second = runCycle(first.state, {
      old_chen: { hunger: -2, relationship: 1 },
      player: { rations: -1 },
    }, config);
    assert.equal(second.ending, null);
    assert.equal(second.state.currentRound, 2);
    assert.equal(second.state.characters.xiao_mei.hunger, 3);
  });
  it("detects failure mid-round", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.characters.xiao_mei.hunger = 6;
    const result = runCycle(state, { xiao_mei: { hunger: 2 } }, makeConfig());
    assert.equal(result.ending.id, "child_starved");
    assert.equal(result.state.gameOver, true);
  });
  it("settles after the final round", () => {
    const config = makeConfig();
    let state = createInitialState(config, CHARS);
    for (let index = 0; index < 6 && !state.gameOver; index += 1) {
      state = runCycle(state, {
        xiao_mei: { hunger: -2 },
        old_chen: { hunger: -2 },
        guard_wang: { hunger: -2 },
        player: { rations: -1 },
      }, config).state;
    }
    assert.equal(state.gameOver, true);
    assert.equal(state.ending.id, "stable");
  });
  it("does nothing after game over", () => {
    const state = createInitialState(makeConfig(), CHARS);
    state.gameOver = true;
    state.ending = { id: "child_starved", type: "failure" };
    const result = runCycle(state, { player: { guilt: 5 } }, makeConfig());
    assert.equal(result.state.gameOver, true);
    assert.equal(result.ending.id, "child_starved");
  });
});
describe("content loading", () => {
  it("loads all content files", () => {
    const content = loadContent();
    assert.equal(content.config.game, "peigei-ri");
    assert.ok(content.characters.characters.length > 0);
    assert.ok(content.events.events.length > 0);
  });
  it("initializes a game from content", () => {
    const game = initGame();
    assert.equal(game.config.game, "peigei-ri");
    assert.equal(game.state.currentRound, 1);
    assert.ok(game.state.keyCharacters.includes("xiao_mei"));
  });
});
