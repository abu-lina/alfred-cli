# AGENTS.md

Shared rules for every AI coding agent in this repo. Inherits the workflow from `po-multi-agent-workflow`; only alfred-specific additions here.

## How work happens here

Same foreman + crew model. One GitHub issue = one worktree = one agent = one PR.

- You are a **lane** if your cwd is `.worktrees/<issue>-<slug>/`. Follow the lane workflow.
- You are the **foreman** if you were started as one in the main checkout. The foreman never writes code.

## Git rules

1. Work only inside your own worktree. Never touch `main` or another lane's branch.
2. Stage by explicit path: `git add <file>`. Never `git add -A`, `git add .` or `git commit -a`.
3. Never commit `.env*` files, keys, tokens or anything that looks like a secret.
4. Push only your own feature branch (`<type>/<issue>-<slug>`). Never push to `main`.
5. Never merge, never rebase, never force-push, unless the owner asks in this session.
6. Open the PR as a draft at first push with `Closes #<issue>` in the body.
7. Conventional commits: `fix:`, `feat:`, `refactor:`, `test:`, `chore:`, `docs:`, `ci:`.
8. Don't delete files you didn't create unless the issue asks for it. Don't bypass hooks (`--no-verify`).
9. No `Co-Authored-By` or similar trailer lines in commits. No AI-attribution footers in PR descriptions. Commits and PRs read as if written by the repo owner.

## Stack

- **Runtime:** Node.js
- **TUI framework:** Ink 5 (React for terminals)
- **Language:** TypeScript (strict mode)
- **Tests:** Vitest + ink-testing-library
- **GitHub data:** shell out to `gh` CLI
- **Rex integration:** shell out to `rex` CLI
- **Config:** `~/.config/alfred-cli/config.json`

## Design constraints

- Alfred is a **monitor**, not a controller. It displays state; it does not dispatch lanes, trigger reviews, or send commands.
- No persistent state. All state derived from external sources on every refresh.
- No Slack integration. Inbox is local files + GitHub only.
- Mouse-driven interaction. Flat views with 2-letter project prefixes.

## Spec

Full design spec: `../po-multi-agent-workflow/docs/superpowers/specs/2026-11-18-alfred-cross-project-dashboard.md`
