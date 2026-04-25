// Node-specific imports are loaded lazily so pure functions remain
// importable in the browser. loadContent / initGame require Node.
let _readFileSync, _join, CONTENT_DIR;
try {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  CONTENT_DIR = join(__dirname, "..", "content");
  _readFileSync = readFileSync;
  _join = join;
} catch {}

const DEFAULT_RULES = {
  hunger_cap: 10, hunger_floor: 0,
  relationship_cap: 10, relationship_floor: -10,
  risk_cap: 10, risk_floor: 0,
  guilt_cap: 10,
};

export function loadContent() {
  return {
    config: readJSON("game_config.json"),
    characters: readJSON("characters.json"),
    events: readJSON("events.json"),
  };
}

function readJSON(name) {
  if (!_readFileSync || !_join || !CONTENT_DIR) {
    throw new Error("loadContent requires Node.js file APIs");
  }
  return JSON.parse(_readFileSync(_join(CONTENT_DIR, name), "utf-8"));
}

export function createInitialState(config, characters) {
  const phase = config.rounds.phases[0];
  const player = config.initial_state.player;
  const characterList = characters.characters ?? characters;
  const characterState = {};
  const keyCharacters = [];

  for (const character of characterList) {
    characterState[character.id] = {
      hunger: character.hunger_base,
      relationship: character.relationship_base,
      risk: 0,
    };
    if (character.is_key_character) {
      keyCharacters.push(character.id);
    }
  }

  return {
    currentRound: 1,
    currentPhaseId: phase.id,
    eventIndex: 0,
    eventsProcessed: 0,
    player: { hunger: player.hunger, rations: player.rations, guilt: player.guilt, debt: player.debt },
    characters: characterState,
    keyCharacters,
    bonusRations: 0,
    roundRations: phase.rations_available,
    gameOver: false,
    ending: null,
  };
}

export function applyChoice(state, effects = {}, rules = DEFAULT_RULES) {
  const resolvedRules = { ...DEFAULT_RULES, ...rules };
  const characters = { ...state.characters };

  for (const [id, delta] of Object.entries(effects)) {
    if (id === "player" || id === "meta" || !characters[id]) {
      continue;
    }
    const current = characters[id];
    characters[id] = clampCharacter({
      hunger: current.hunger + (delta.hunger ?? 0),
      relationship: current.relationship + (delta.relationship ?? 0),
      risk: current.risk + (delta.risk ?? 0),
    }, resolvedRules);
  }

  const playerEffects = effects.player ?? {};
  const player = clampPlayer({
    ...state.player,
    hunger: state.player.hunger + (playerEffects.hunger ?? 0),
    rations: state.player.rations + (playerEffects.rations ?? 0),
    guilt: state.player.guilt + (playerEffects.guilt ?? 0),
    debt: state.player.debt + (playerEffects.debt ?? 0),
  }, resolvedRules);

  return {
    ...state,
    player,
    characters,
    bonusRations: state.bonusRations + (effects.meta?.bonus_rations ?? 0),
    eventsProcessed: state.eventsProcessed + 1,
  };
}

export function tickHunger(state, hungerPerRound = 1, rules = DEFAULT_RULES) {
  const resolvedRules = { ...DEFAULT_RULES, ...rules };
  const characters = {};

  for (const [id, character] of Object.entries(state.characters)) {
    characters[id] = clampCharacter({
      ...character,
      hunger: character.hunger + hungerPerRound,
    }, resolvedRules);
  }

  return {
    ...state,
    characters,
    player: clampPlayer({
      ...state.player,
      hunger: state.player.hunger + hungerPerRound,
    }, resolvedRules),
  };
}

export function checkEndings(state, config) {
  const failure = checkFailure(state, config);
  if (failure) {
    return failure;
  }
  if (state.currentRound <= config.rounds.total) {
    return null;
  }

  const criticalHunger = config.thresholds.hunger.critical;
  const fatalHunger = config.thresholds.hunger.fatal;
  const keyCharacters = getKeyCharacters(state, config);
  const allKeyCharactersSafe = keyCharacters.every((id) => {
    return state.characters[id] && state.characters[id].hunger < criticalHunger;
  });

  if (allKeyCharactersSafe && state.player.hunger < fatalHunger) {
    return { ...config.endings.success, type: "success" };
  }
  return null;
}

export function advanceRound(state, config) {
  const currentRound = state.currentRound + 1;
  if (currentRound > config.rounds.total) {
    return { ...state, currentRound };
  }

  const phase = config.rounds.phases.find((candidate) => candidate.id === currentRound);
  return {
    ...state,
    currentRound,
    currentPhaseId: phase.id,
    eventIndex: 0,
    roundRations: phase.rations_available,
  };
}

export function runCycle(state, choiceEffects, config) {
  if (state.gameOver) {
    return { state, ending: state.ending };
  }

  const phase = config.rounds.phases.find((candidate) => candidate.id === state.currentPhaseId);
  const eventsInRound = phase?.events_per_round ?? 2;
  let nextState = applyChoice(state, choiceEffects, config.state_rules);

  if (nextState.eventsProcessed % eventsInRound !== 0) {
    return settleIfNeeded(nextState, config);
  }

  nextState = tickHunger(nextState, config.initial_state.hunger_per_round, config.state_rules);
  const roundEnding = checkEndings(nextState, config);
  if (roundEnding) {
    return finish(nextState, roundEnding);
  }

  nextState = advanceRound(nextState, config);
  const finalEnding = checkEndings(nextState, config);
  if (finalEnding) {
    return finish(nextState, finalEnding);
  }
  return { state: nextState, ending: null };
}

export function initGame() {
  const content = loadContent();
  return {
    content,
    config: content.config,
    state: createInitialState(content.config, content.characters),
  };
}

function checkFailure(state, config) {
  const failures = config.endings.failures;
  const fatalHunger = config.thresholds.hunger.fatal;
  const criticalRisk = config.thresholds.risk.critical;
  const characters = state.characters;

  for (const failure of failures) {
    const condition = failure.condition;
    if (condition.includes("xiao_mei.hunger >= fatal") && characters.xiao_mei?.hunger >= fatalHunger) {
      return { ...failure, type: "failure" };
    }
    if (condition.includes("old_chen.hunger >= fatal") && characters.old_chen?.hunger >= fatalHunger) {
      return { ...failure, type: "failure" };
    }
    if (condition.includes("guard_wang.risk >= critical") && characters.guard_wang?.risk >= criticalRisk) {
      return { ...failure, type: "failure" };
    }
    if (condition.includes("player.hunger >= fatal") && state.player.hunger >= fatalHunger) {
      return { ...failure, type: "failure" };
    }
    if (condition.includes("player.guilt >= 10") && state.player.guilt >= 10) {
      return { ...failure, type: "failure" };
    }
  }
  return null;
}

function getKeyCharacters(state, config) {
  if (Array.isArray(state.keyCharacters)) {
    return state.keyCharacters;
  }
  if (!config._charMap) {
    return [];
  }
  return Object.entries(config._charMap).filter(([, character]) => {
    return character.is_key_character;
  }).map(([id]) => id);
}

function settleIfNeeded(state, config) {
  const ending = checkEndings(state, config);
  if (ending) return finish(state, ending);
  return { state, ending: null };
}

function finish(state, ending) {
  return { state: { ...state, gameOver: true, ending }, ending };
}

function clampPlayer(player, rules) {
  return {
    ...player,
    hunger: clamp(player.hunger, rules.hunger_floor, rules.hunger_cap),
    guilt: clamp(player.guilt, 0, rules.guilt_cap),
  };
}

function clampCharacter(character, rules) {
  return {
    ...character,
    hunger: clamp(character.hunger, rules.hunger_floor, rules.hunger_cap),
    relationship: clamp(character.relationship, rules.relationship_floor, rules.relationship_cap),
    risk: clamp(character.risk, rules.risk_floor, rules.risk_cap),
  };
}

function clamp(value, floor, cap) {
  return Math.max(floor, Math.min(cap, value));
}
