# Bloomin Frontend

The web frontend for **Bloomin** — a chat interface built on top of the OpenClaw Gateway. It provides real-time conversational AI interactions, session management, and server health monitoring.

## Tech Stack

- **React 19** with JSX
- **Vite 8** (dev server & build)
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Radix UI + shadcn/ui** for accessible, styled components
- **React Router v7** for client-side routing
- **Lucide React** for icons
- **Sonner** for toast notifications
- **next-themes** for dark/light mode

## Project Structure

```
src/
├── api.js                      # Gateway env config (WS URL & token)
├── App.jsx                     # Root component & routing
├── main.jsx                    # Entry point
├── index.css                   # Global styles
├── lib/
│   └── utils.js                # Shared utilities (cn, etc.)
├── hooks/
│   └── use-mobile.js           # Mobile breakpoint hook
├── services/
│   ├── gateway-ws.js           # WebSocket client for OpenClaw Gateway
│   ├── api.service.js          # Chat & session API layer
│   └── hostinger.service.js    # Hostinger VM/Docker REST client
└── components/
    ├── chat-area.jsx           # Main chat view
    ├── header.jsx              # App header
    ├── sidebar.jsx             # Navigation sidebar
    ├── search-dialog.jsx       # Search overlay
    ├── server-health.jsx       # Server monitoring dashboard
    ├── rotating-headlines.jsx  # Animated headline ticker
    ├── theme-toggle.jsx        # Dark/light mode switch
    └── ui/                     # shadcn/ui primitives
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** (or any compatible package manager)
- A running [OpenClaw Gateway](https://github.com/nicepkg/openclaw) instance (for chat features)

### Install

```bash
npm install
```

### Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_GATEWAY_URL` | Gateway HTTP base URL | `http://127.0.0.1:18789` |
| `VITE_GATEWAY_WS_URL` | Gateway WebSocket URL | `ws://127.0.0.1:18789` |
| `VITE_GATEWAY_TOKEN` | Auth token for the gateway | — |
| `VITE_API_BASE_URL` | Backend REST API base URL | `http://127.0.0.1:8080` |

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

Production output goes to `dist/`.

### Preview

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Routes

| Path | Description |
|---|---|
| `/` | Redirects to a new chat session |
| `/chat/:chatId` | Chat conversation view |
| `/servers` | Server health & monitoring |
