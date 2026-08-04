<p align="center">
  <img src="https://img.shields.io/github/stars/ELikeMed/OpenAce?style=social" alt="GitHub Stars">
  <img src="https://img.shields.io/github/v/release/ELikeMed/OpenAce" alt="Release">
  <img src="https://github.com/ELikeMed/OpenAce/actions/workflows/ci.yml/badge.svg" alt="CI">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node 18+">
  <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Claude%20%7C%20Ollama-purple" alt="AI Providers">
  <img src="https://img.shields.io/badge/tools-50%2B-orange" alt="50+ Tools">
</p>

# OpenAce

**Your AI executive team — one mind, many hats.**

OpenAce is an open-source AI Chief of Staff that runs locally on your machine. It handles research, email, lead generation, web browsing, social media, scheduling, code generation, bookkeeping, and more — powered by Google Gemini (free tier) or your preferred AI provider.

All your data stays on your machine. No cloud. No subscriptions. No vendor lock-in.

> **50+ tools** across 17 groups. One AI agent. Zero routing layers. Tell it what you need — it figures out the rest.

---

## Install (One Command)

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.ps1 | iex
```

This will install Git and Node.js if needed, clone the repo, and build everything. When it's done, follow the instructions on screen to start OpenAce.

> **First time?** When you open OpenAce, just type anything in the chat — Ace will walk you through getting your free API key and connecting it. Takes about 60 seconds.

### Video Walkthroughs

| | |
|---|---|
| [**Install on Mac**](https://youtu.be/vXy_UHe_ROA) | [**Install on Windows**](https://youtu.be/cNuhJ_pxaQw) |
| [**Onboarding Walkthrough**](https://youtu.be/HcAnnAsZPbo) | From first launch to first conversation |

### Manual Install

```bash
git clone https://github.com/ELikeMed/OpenAce.git
cd OpenAce
npm install
cd src/desktop/dashboard-ui && npm install && npm run build && cd ../../..
cd src/studio && npm install && npm run build && cd ../../..
npm start
```

Open **http://localhost:3333** in your browser.

### Requirements

- **Node.js 18+**
- **A Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/apikey)) — or bring your own OpenAI / Claude / Ollama key
- **macOS** for desktop automation (all other features work on every platform)

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Chat & AI** | Natural conversation — ask anything, Ace figures out which tools to use |
| **Research** | Web search, site scraping, competitive analysis with memory |
| **Email** | Draft and send emails, auto follow-up on leads |
| **Pipeline & CRM** | Lead generation, tracking with stages (new → contacted → qualified → closed) |
| **Phone & SMS** | Send texts, make calls (TTS via Twilio), dispatch AI phone agents (Vapi/Bland/Retell) |
| **Browser Automation** | Controls your real Chrome browser (macOS) — no headless, no bot detection |
| **Social Media** | Post to Twitter, LinkedIn, Facebook, Instagram, TikTok with media & content plans |
| **Calendar** | Google Calendar integration — list, create, delete events |
| **Google Drive** | Create docs, list files, upload to Drive |
| **Forms & Quizzes** | Create forms with live public URLs, collect submissions |
| **Books & Tax Prep** | PDF/CSV statement upload, AI categorization, mileage tracking, CPA-ready reports |
| **Code Studio** | Build and edit web projects with a built-in Monaco editor |
| **Deploy** | One-click deploy to Netlify, Firebase, SFTP, or local |
| **SOPs / Playbooks** | Record workflows by demonstration, then replay them — 16 unified action types |
| **Knowledge Base** | Ingest PDFs, docs, CSVs, codebases — Ace references them in answers |
| **Goal Tracking** | Set goals, track progress — Ace auto-continues until work is done |
| **Desktop Control** | Full mouse/keyboard automation for any app (macOS) |

---

## How It Works

OpenAce runs a local Express server with a React dashboard. One AI agent handles everything.

- **UnifiedAgent** — A single AI-powered agent with 50+ tools across 17 groups, exposed as function calls
- **Smart tool selection** — Only 8-18 relevant tools sent per request based on message context
- **No routing layers** — No departments, no intent classification — one agent, one call
- **Auto-continuation** — For multi-step tasks, Ace keeps working across up to 3 phases (75 tool calls max)
- **Your data, your machine** — Everything stored locally in `data/`

### AI Providers

| Provider | Cost | Best For |
|----------|------|----------|
| **Google Gemini** (default) | Free tier available | General use, great tool calling |
| **OpenAI** | Pay-per-use API | GPT-4.1, strong reasoning |
| **Anthropic Claude** | Pay-per-use API | Claude Sonnet 4.6, detailed analysis |
| **Ollama** | Free (local) | Privacy, offline use |

Switch providers anytime in Settings. Use **Task Routing** to assign different AIs to different tasks (e.g., Gemini for chat, OpenAI for code).

---

## Platform Support

| Feature | macOS | Windows | Linux |
|---------|:-----:|:-------:|:-----:|
| Chat & AI | Yes | Yes | Yes |
| Pipeline & CRM | Yes | Yes | Yes |
| Email | Yes | Yes | Yes |
| Research & Web Search | Yes | Yes | Yes |
| Forms & Quizzes | Yes | Yes | Yes |
| Social Media | Yes | Yes | Yes |
| Calendar | Yes | Yes | Yes |
| Code Studio & Deploy | Yes | Yes | Yes |
| Browser Automation | Yes | Planned | Planned |
| Desktop Control | Yes | Planned | Planned |
| SOP Recording | Yes | Planned | Planned |

---

## Configuration

### Gemini API Key (free)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **"Create API key"**
3. Open OpenAce and type anything — Ace will guide you through connecting it

Or: Settings (gear icon) > AI Providers > Gemini > Set Up

### Google Calendar / Gmail (optional)

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. Save as `config/google-credentials.json`
3. Authorize through Settings in the dashboard

---

## Project Structure

```
OpenAce/
├── config/                          # Configuration (created on first run)
│   └── openace.config.example.json  # Template
├── data/                            # All user data (gitignored)
│   ├── personas/soul.json           # Ace's personality
│   ├── pipeline/                    # CRM leads
│   ├── memory/                      # Contacts, research, notes
│   └── sops/                        # Trained workflows
├── src/
│   ├── core/                        # Backend engine
│   │   ├── brain/UnifiedAgent.js    # Single AI agent with 50+ tools
│   │   ├── brain/AceBrain.js        # Brain: SOP matching + agent
│   │   ├── ai-providers/            # Gemini, OpenAI, Claude, Ollama
│   │   ├── automation/              # Desktop/browser control, SOP execution
│   │   ├── billing/                 # Credits, Stripe integration
│   │   ├── gateway/ApiGateway.js    # Express API routes
│   │   ├── integrations/            # Twilio, Google Calendar, social media
│   │   └── ...                      # Pipeline, forms, knowledge, deploy
│   ├── desktop/dashboard-ui/        # React dashboard (MUI)
│   └── studio/                      # Code studio (Monaco editor)
├── scripts/start-dashboard.js       # Server entry point
├── install.sh                       # macOS/Linux installer
├── install.ps1                      # Windows installer
└── start.cmd                        # Windows start script
```

---

## Development

```bash
# Start the server
npm start

# Rebuild dashboard after frontend changes
cd src/desktop/dashboard-ui && npm run build

# Build studio
cd src/studio && npm install && npm run build
```

Server runs on port **3333**. Dashboard at `/`, Studio at `/studio`.

---

## Troubleshooting

<details>
<summary><b>macOS: xcrun error during npm install</b></summary>

Command Line Tools are missing. Run:

```bash
xcode-select --install
```

If that doesn't work (e.g., migrated from Intel Mac):

```bash
sudo xcode-select --reset
xcode-select --install
```
</details>

<details>
<summary><b>Windows: "running scripts is disabled" error</b></summary>

Use `start.cmd` instead of `npm start`:

```cmd
cd %USERPROFILE%\openace
.\start.cmd
```

Or run this once in PowerShell to fix it permanently:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
</details>

<details>
<summary><b>Windows: robotjs build errors during npm install</b></summary>

Safe to ignore. All non-desktop features work normally. Desktop automation on Windows is planned for a future release.
</details>

<details>
<summary><b>API rate limit / quota errors</b></summary>

The Gemini free tier has usage limits. If you hit them:

1. **Wait a few minutes** — limits reset quickly
2. **Upgrade to Tier 1** — [Google AI Studio](https://aistudio.google.com) > Profile > Billing (requires credit card, much higher limits)
3. **Add a backup provider** — Settings > AI Providers > add OpenAI or Claude as a secondary
</details>

---

## Embed SDK

Drop Ace into any website as an AI assistant widget:

```bash
# Install from a release
npm install https://github.com/ELikeMed/OpenAce/releases/latest/download/openace-embed-1.0.5.tgz
```

```html
<script src="node_modules/@openace/embed/dist/openace-embed.js"></script>
<script>
  OpenAceEmbed.init({ serverUrl: 'http://localhost:3333' });
</script>
```

The embed SDK provides action-first AI with site awareness — content editing, image generation, and content calendars built in.

---

## Contributing

OpenAce is a solo project looking for contributors. If you're interested:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

Areas that could use help: tests, Windows browser automation, Linux desktop support, documentation, and new tool integrations.

---

## Like OpenAce?

If OpenAce is useful to you, consider giving it a star — it helps others discover the project and keeps development going.

**[Click here to star this repo](https://github.com/ELikeMed/OpenAce/stargazers)**

---

## License

[MIT](LICENSE)

---

**Built by [Eric Greenstein / LikemindedPro](https://likemindedpro.com)** | **[openaceai.com](https://openaceai.com)**
