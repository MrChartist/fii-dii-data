# Agents

Each agent exports `run()`: read `data/`, compute, write only to `data/agent_state.json` / `agent_runs.json` through `agent-utils.js`. `runner.js` groups them (`post-market`, `sector`, `weekly`, `meta`) and is the CLI (`node agents/runner.js --agent=<name>`).

- Use `fii_net` / `dii_net` for signals. They exist for every session, including net-only ones; gross legs may be `null`.
- Alerts currently have no delivery channel (`deliverAlert` is a stub); adding one is a one-place change.
- Running agents locally rewrites `data/agent_*.json`; `git checkout data/agent_*.json` afterwards unless you want the new state committed.
- `docs/plans/AGENTIC_AI_PLAN.md` is a historical plan (mentions Telegram, since removed).
