# OpenAce

**Your AI executive team — one mind, many hats.**

OpenAce is an open-source AI Chief of Staff that runs locally on your machine. It handles strategy, marketing, research, email, web browsing, scheduling, code generation, and more — powered by Google Gemini (free tier) or your preferred AI provider.

## What It Does

- **Research** — Web search, site scraping, competitive analysis with memory
- **Email** — Draft and send emails, follow up on leads automatically
- **Pipeline** — CRM-style lead tracking with stages (new, contacted, qualified, closed)
- **Browser Automation** — Controls your real Chrome browser (macOS) — no bot detection
- **Social Media** — Post to Twitter, LinkedIn, Facebook, Instagram, TikTok with media
- **Calendar** — Google Calendar integration (list, create, delete events)
- **Forms** — Create forms/quizzes with live public URLs
- **Code Generation** — Build and deploy web projects (Netlify, Firebase, SFTP)
- **SOPs** — Train Ace by demonstrating workflows, then replay them
- **Knowledge Ingestion** — Ingest PDFs, docs, codebases for context-aware responses
- **Desktop Control** — Full mouse/keyboard automation for any app (macOS)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ELikeMed/OpenAce.git
cd OpenAce

# Install dependencies
npm install

# Build the dashboard
cd src/desktop/dashboard-ui && npm install && npm run build && cd ../../..

# Start OpenAce
npm start
```

Open **http://localhost:3333** in your browser. The onboarding wizard will walk you through setup.

### What You Need

- **Node.js 18+**
- **A Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/apikey)) — or bring your own OpenAI/Claude/Ollama key
- **macOS** for desktop automation features (chat, AI, pipeline, email, research, and web features work on all platforms)

## How It Works

OpenAce runs a local Express server with a React dashboard. All your data stays on your machine.

**Architecture:**
- One AI agent (UnifiedAgent) powered by Gemini function calling
- 37 tools exposed as Gemini functions — the AI decides which to use
- No routing layers, no department system — one smart agent handles everything
- Tool subsetting: only 8-18 relevant tools sent per request (not all 37)

**AI Providers:**
- **Google Gemini** (default) — free tier, 2.5 Flash
- **OpenAI** — GPT-4.1
- **Anthropic** — Claude Sonnet 4.6
- **Ollama** — local models, free, private

## Project Structure

```
OpenAce/
├── config/                          # Configuration (created on first run)
│   ├── openace.config.example.json  # Template — copied to openace.config.json
│   └── google-credentials.example.json
├── data/                            # All user data (auto-created, gitignored)
│   ├── personas/soul.json           # Ace's personality
│   ├── pipeline/                    # CRM leads
│   ├── memory/                      # Contacts, research, notes
│   ├── sops/                        # Trained workflows
│   └── ...
├── src/
│   ├── core/                        # Backend engine
│   │   ├── index.js                 # Main OpenAce class
│   │   ├── brain/
│   │   │   ├── AceBrain.js          # Brain: SOP matching + UnifiedAgent
│   │   │   ├── UnifiedAgent.js      # Single Gemini agent with 37 tools
│   │   │   └── ResponseParser.js    # Response parsing
│   │   ├── ai-providers/            # Gemini, OpenAI, Claude, Ollama
│   │   ├── automation/              # Desktop/browser control (macOS)
│   │   ├── gateway/ApiGateway.js    # Express API routes
│   │   ├── pipeline/                # Lead management
│   │   ├── forms/                   # Form/quiz engine
│   │   ├── social/                  # Social media posting
│   │   ├── knowledge/               # File/codebase ingestion
│   │   └── agents/CodeAgent.js      # Code generation
│   ├── desktop/dashboard-ui/        # React dashboard (MUI)
│   └── studio/                      # Code studio (Monaco editor)
├── scripts/
│   └── start-dashboard.js           # Express server entry point
├── package.json
└── LICENSE
```

## Configuration

Config is at `config/openace.config.json` (auto-created from template on first run).

**Gemini setup (free):**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create an API key
3. Enter it during onboarding or paste it in the config file

**Google Calendar / Gmail** (optional):
1. Create OAuth credentials in Google Cloud Console
2. Copy to `config/google-credentials.json`
3. Authorize through Settings in the dashboard

## Platform Support

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Chat & AI | Yes | Yes | Yes |
| Pipeline & CRM | Yes | Yes | Yes |
| Email | Yes | Yes | Yes |
| Research & Web Search | Yes | Yes | Yes |
| Forms & Quizzes | Yes | Yes | Yes |
| Social Media Posting | Yes | Yes | Yes |
| Calendar | Yes | Yes | Yes |
| Code Generation | Yes | Yes | Yes |
| Browser Automation | Yes | Coming | Coming |
| Desktop Control | Yes | Coming | Coming |
| SOP Recording | Yes | Coming | Coming |

## Development

```bash
# Start the server (watches for changes)
npm start

# Rebuild dashboard after frontend changes
cd src/desktop/dashboard-ui && npm run build

# Build studio
cd src/studio && npm install && npm run build
```

The server runs on port 3333. Dashboard is served at `/`, Studio at `/studio`.

## Troubleshooting

**`xcrun: error: unable to load libxcrun` during `npm install`**

This means your macOS Command Line Tools are missing or misconfigured. Run:

```bash
xcode-select --install
```

If that doesn't work (e.g. you migrated from an Intel Mac), reset first:

```bash
sudo xcode-select --reset
xcode-select --install
```

This is required for desktop automation features (mouse/keyboard control, screen recording, trained SOPs). Once installed, re-run `npm install`.

**Windows: Desktop automation not yet available**

OpenAce runs on Windows for all core features — chat, pipeline, contacts, email, research, calendar, social media, forms, and code studio. Desktop automation (mouse/keyboard control, screen recording, trained desktop SOPs) currently requires macOS. Windows desktop automation is on the roadmap.

**Windows: `robotjs` build errors during `npm install`**

You may see build errors related to `robotjs` — this is safe to ignore. The server will start and all non-desktop features work normally. If you want desktop automation in the future, you'll need [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the C++ workload installed.

## License

MIT

---

**Built by [LikemindedPro](https://likemindedpro.com)**
