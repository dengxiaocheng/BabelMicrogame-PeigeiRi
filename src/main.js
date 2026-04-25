import readline from "node:readline";
import { pathToFileURL } from "node:url";
import {
  initGame,
  runCycle,
} from "./state/engine.js";

/**
 * RationDayGame is a thin controller wrapping the state engine.
 * Node entry point; also exported for programmatic use / future tests.
 */
export class RationDayGame {
  constructor() {
    const { content, config, state } = initGame();
    this.content = content;
    this.config = config;
    this.state = state;
  }

  /** Return events eligible for the current phase. */
  getCurrentEvents() {
    return this.content.events.events.filter(
      (e) => e.phase.includes(this.state.currentPhaseId),
    );
  }

  /** Pick the next event (round-robin by eventIndex). */
  pickEvent() {
    const pool = this.getCurrentEvents();
    if (pool.length === 0 || this.state.gameOver) return null;
    return pool[this.state.eventIndex % pool.length];
  }

  /** Process a player choice and advance the cycle. */
  choose(event, choiceId) {
    const choice = event.choices.find((c) => c.id === choiceId);
    if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
    const previousPhaseId = this.state.currentPhaseId;
    const result = runCycle(this.state, choice.effects, this.config);
    this.state = result.state;
    if (!this.state.gameOver && this.state.currentPhaseId === previousPhaseId) {
      this.state = { ...this.state, eventIndex: this.state.eventIndex + 1 };
    }
    return {
      feedback: choice.feedback,
      ending: result.ending,
      phaseChanged: !this.state.gameOver && this.state.currentPhaseId !== previousPhaseId,
    };
  }

  isOver() {
    return this.state.gameOver;
  }

  getStatus() {
    const p = this.state.player;
    const phase = this.config.rounds.phases.find(
      (ph) => ph.id === this.state.currentPhaseId,
    );
    return {
      round: this.state.currentRound,
      phaseName: phase?.name ?? "结算",
      hunger: p.hunger,
      rations: p.rations,
      guilt: p.guilt,
    };
  }
}

async function main() {
  const game = new RationDayGame();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("\n========================");
  console.log("        配给日          ");
  console.log("========================\n");

  while (!game.isOver()) {
    const event = game.pickEvent();
    if (!event) break;

    const s = game.getStatus();
    console.log(
      `-- ${s.phaseName} | 轮次 ${s.round} | ` +
      `饥饿 ${s.hunger}  配给 ${s.rations}  负罪 ${s.guilt} --\n`,
    );
    console.log(event.narrative + "\n");

    event.choices.forEach((c, i) => console.log(`  [${i + 1}] ${c.text}`));

    const answer = await ask("\n选择: ");
    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= event.choices.length) {
      console.log("无效选择，请重试。\n");
      continue;
    }

    const result = game.choose(event, event.choices[idx].id);
    console.log(`\n${result.feedback}\n`);

    if (result.phaseChanged) {
      console.log(`--- 进入 ${game.getStatus().phaseName} ---\n`);
    }

    if (result.ending) {
      console.log(`\n=== ${result.ending.name} ===`);
      console.log(result.ending.text + "\n");
      break;
    }
  }

  rl.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
