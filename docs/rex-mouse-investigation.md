# Rex Mouse Passthrough Investigation

Issue: #76 — Mouse clicks don't work in Rex

## Problem

Alfred uses SGR mouse tracking (mode 1006) to handle mouse clicks in its TUI.
When running inside Rex, the Rex GUI client intercepts all mouse clicks for its
own UI (pane selection, scrollbar, resize handles) and never forwards them as
SGR escape sequences to the child terminal process.

## Environment

- Rex terminal multiplexer (server + GUI client architecture)
- Alfred runs as a child process inside a Rex block (terminal pane)
- Mouse tracking modes 1000, 1002, 1003, 1006 are all correctly enabled in the
  terminal — the child process requests tracking, and the terminal acknowledges it
- The terminal *knows* the child wants mouse events; the GUI client simply
  doesn't forward them

## What Works

### `block.event` with `type: "mouse"`

Rex's server API accepts mouse events and forwards them to blocks:

```bash
rex api call -s "$REX_SESSION" block.event '{
  "block_id": "'"$REX_BLOCK"'",
  "event": {
    "type": "mouse",
    "payload": {"x": 10, "y": 5, "button": "left", "action": "press"}
  }
}'
```

Returns `{}` (accepted). The event reaches the block's terminal.

### `com.superlogical.terminal.write` with raw SGR sequences

The `terminal.write` API can inject raw SGR mouse escape sequences directly
into the terminal's PTY input:

```bash
rex api call -s "$REX_SESSION" com.superlogical.terminal.write '{
  "block_id": "'"$REX_BLOCK"'",
  "args": {"data": "\u001b[<0;10;5M"}
}'
```

Returns `{"bytes_written": 10}`. A child process reading stdin with mouse
tracking enabled receives this as a left-click at column 10, row 5.

SGR format: `ESC [ < button ; col ; row M` (press) or `m` (release).

## What Doesn't Work

### No mouse passthrough setting

Rex has no built-in setting or preference to forward GUI mouse clicks to the
terminal. Checked:

- `rex settings` / Mac Settings reference — has "Focus Follows Mouse" but no
  mouse passthrough or forwarding option
- Mac Actions reference — no mouse forwarding actions
- Client actions (`rex actions --json`) — no mouse-related actions

### No mouse events in Lua API

Rex's Lua configuration (`~/.config/rex/init.lua`) cannot intercept mouse
clicks:

- `rex.bind` only works for keyboard shortcuts (key events), not mouse events
- `rex.on` event system has only structural events (window_created,
  child_exited, session_created, etc.) — no mouse click events
- No `rex.on("mouse_click", ...)` or similar hook exists

### `client.key` is keyboard-only

The `client.key` API method (which gives Lua bindings first chance at input)
only handles keyboard events. Its schema has no mouse event type.

## Gap Analysis

The missing piece is a **trigger**: there is no way to know when or where the
user clicks in the Rex GUI. The forwarding mechanisms exist (`block.event`,
`terminal.write`), but there is no input source to drive them.

| Capability | Exists? | Notes |
|---|---|---|
| Child requests mouse tracking | Yes | Modes 1000/1002/1003/1006 all set |
| API to send mouse events to blocks | Yes | `block.event type:mouse` |
| API to inject raw SGR sequences | Yes | `terminal.write` with `\e[<...M` |
| GUI forwards clicks to terminal | **No** | GUI consumes all clicks |
| Lua hook for mouse clicks | **No** | Only keyboard bindings |
| Event system mouse events | **No** | Only structural events |
| Setting to enable passthrough | **No** | Not in settings or actions |

## What Rex Would Need to Change

Any one of these would unblock alfred (and every other TUI that uses mouse
tracking):

1. **Mouse passthrough mode** (simplest for users): A per-block or per-session
   setting that forwards mouse clicks to the terminal as SGR sequences when the
   child has requested mouse tracking. Could be toggled with a keybinding
   (similar to tmux's `set -g mouse on`).

2. **Mouse events in Lua API** (most flexible): Add `rex.on("mouse_click",
   fn)` or `rex.bind_mouse(fn)` so Lua scripts can receive mouse events and
   decide whether to forward them via `block.event` or `terminal.write`.

3. **Automatic forwarding when mouse modes are set**: If the terminal reports
   that mouse tracking modes are enabled (which Rex already tracks — see the
   modes output), the GUI could automatically forward clicks to the child
   instead of consuming them.

## Workaround for Users

There is no practical workaround today. The two working APIs (`block.event` and
`terminal.write`) require an external trigger that doesn't exist inside Rex.

A theoretical (impractical) workaround would be an external process that uses
macOS accessibility APIs to capture mouse clicks on the Rex window and converts
them to `rex api call ... terminal.write` commands. This is fragile and not
recommended.

## Recommendation

File a feature request with the Rex team for option 1 (mouse passthrough mode)
or option 3 (automatic forwarding when mouse modes are set). Reference:

- Terminal modes already report mouse tracking as enabled
- `block.event` and `terminal.write` already implement the forwarding path
- The only missing piece is the GUI-to-terminal bridge
