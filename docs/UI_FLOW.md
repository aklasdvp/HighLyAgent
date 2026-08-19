# HighLyAgent — Admin UI Wireframes & Flow (Firebase Console style)

## Boot flow

```
first boot ──► SETUP screen (create admin: username + email + password + confirm)
               no auto-config: nothing exists until you create it
           ──► LOGIN (username OR email + password)
               inline error on wrong credentials · JWT issued · 30-min countdown in topbar
           ──► SHELL
```

## Shell

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ ◆ HighLy │ Breadcrumb: HighLyAgent / Projects / nova-pos / Training  ⌂  │
│ Agent    │                              [WS ●] [28:41 ↻] [◐ theme] [▤] │
│──────────┼──────────────────────────────────────────────────────────────┤
│ MONITOR  │                                                              │
│ Dashboard│   Page title + description                    [primary action]│
│ Logs     │   ┌ search ┐ ┌ filters ┐                                     │
│ BUILD    │   ├──────────────────────────────────────────────────────┤   │
│ Projects │   │ scrollable content area                              │   │
│ AI Provid│   │ …rows / cards / panels…                              │   │
│ API Keys │   ├──────────────────────────────────────────────────────┤   │
│ SYSTEM   │   │ sticky bottom action bar (Save / Cancel) — always    │   │
│ Settings │   │ visible while typing; body scrolls instead           │   │
│──────────│   └──────────────────────────────────────────────────────┘   │
│ [admin▾] │                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

## Project detail (click a project card)

```
[‹ Projects]  ◆ nova-pos   WEB ● live   key •••• 3f9a   1,284 req today
─────────────────────────────────────────────────────────────────────────
Overview | AI Config | Tools | Users | Training | Test Console | Logs
Usage & Limits | Settings
─────────────────────────────────────────────────────────────────────────
(tab content — every tab has: search or filters where data is tabular,
 empty state when nothing matches, loading skeleton on switch)
```

## Per-page state contract

| State | Where shown |
|---|---|
| Loading | skeleton shimmer rows/cards on every route/tab switch (~300 ms) |
| Empty | icon + hint + primary action (e.g. "No training rules yet — add one") |
| Error | red panel with retry (e.g. ApiKeys security simulator: 403 ACCESS_DENIED card) |
| Success | toast (bottom-right) on every mutation; confirm dialog before every destructive action |

## Form rules
- Modal body scrolls; footer (Cancel / Save) is sticky at the **bottom** of the dialog.
- Long forms (Settings, AI Config): page body scrolls, action bar pinned to viewport bottom.
- Inputs never require scrolling while typing on desktop or mobile keyboards.

## Theme
Dark (default) and Light, toggled from the topbar, persisted per machine.
All tokens are CSS variables — `[data-theme="light"]` re-maps the whole scale.

## Local runtime (frontend never touches a public server)
- `npm run build` → `dist/`
- PM2: `pm2 start ecosystem.config.cjs` (serves dist on 127.0.0.1:8090, auto-start at boot)
- systemd: `deploy/highlyagent-admin.service`
- Electron: `desktop/main.cjs` (windowed app, same dist)
