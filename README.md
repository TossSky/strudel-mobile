# Strudel Mobile REPL

Standalone mobile-friendly live coding music environment powered by [Strudel](https://strudel.cc/).

## Quick Start

### Option 1: Python (recommended)
```bash
python -m http.server 8080
```
Then open http://localhost:8080

### Option 2: Windows
Double-click `serve.bat`

### Option 3: Node.js
```bash
npx serve .
```

## Why a server?

`localStorage` and audio APIs require HTTP(S) — `file://` URLs won't work in most browsers.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Evaluate pattern |
| `Ctrl+.` | Hush (stop) |
| `Ctrl+S` | Save project |

## License

AGPL-3.0 (same as Strudel)
