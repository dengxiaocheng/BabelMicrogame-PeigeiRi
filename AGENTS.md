# AGENTS.md

This repository contains one Babel microgame only: `配给日`.

Rules:

- Keep the repository game-only. Do not add manager/runtime orchestration code here.
- Keep total source size under the 5000-line microgame target unless the manager explicitly changes scope.
- JavaScript games must remain directly playable through `index.html`.
- GitHub Pages must keep serving from the repository root.
- Do not add Playwright or browser automation dependencies on the server.
- Run `npm test` after code changes when feasible.
- Worker handoff reports belong under `.codex-runtime/`, which is ignored.
