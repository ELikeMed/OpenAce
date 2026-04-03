/**
 * Example: OpenAce Embed SDK with Express (simulates Next.js API route)
 *
 * Run: node packages/embed/examples/nextjs/server.js
 *
 * Then open: http://localhost:3456
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Import the SDK ──
// In a real Next.js app, you'd use: import { createAceServer } from '@openace/embed/server';
import { createAceServer } from '../../src/server/createAceServer.js';

const app = express();
const PORT = 3456;

// ── Configure Ace ──
const aceHandler = createAceServer({
  licenseKey: process.env.OPENACE_LICENSE_KEY || '',
  dataDir: path.join(__dirname, '../../data/example'),
  ai: {
    geminiKey: process.env.GEMINI_API_KEY || '',
    claudeKey: process.env.CLAUDE_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    defaultProvider: 'gemini',
  },
  businessContext: 'This is an example business. We sell AI-powered widgets.',
});

// ── Mount Ace API routes ──
app.all('/api/ace/*', (req, res) => aceHandler(req, res));

// ── Serve a demo page ──
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenAce Embed — Express Example</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 60px auto; padding: 0 20px; color: #1e293b; }
    h1 { color: #6366f1; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    pre { background: #1e1e2e; color: #e2e8f0; padding: 20px; border-radius: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>OpenAce Embed SDK — Example</h1>
  <p>The Ace widget is loaded in the bottom-right corner. Click the chat button to start!</p>
  <h2>How it works</h2>
  <pre><code>// 1. Install the SDK
npm install @openace/embed

// 2. Set up the server (Express/Next.js)
import { createAceServer } from '@openace/embed/server';
app.all('/api/ace/*', createAceServer({
  ai: { geminiKey: process.env.GEMINI_API_KEY }
}));

// 3. Add the widget to your page
&lt;script src="/ace-embed.min.js"&gt;&lt;/script&gt;
&lt;script&gt;OpenAce.init({ serverUrl: '/api/ace' });&lt;/script&gt;</code></pre>

  <h2>Features</h2>
  <ul>
    <li>AI Chat with tool calling (search, email, leads, SEO, blog generation)</li>
    <li>CRM pipeline management</li>
    <li>SEO analysis and blog generation</li>
    <li>Email campaigns</li>
    <li>Social media scheduling</li>
    <li>Form builder</li>
  </ul>

  <!-- Load the widget via script tag -->
  <script>
    // Simulate the script tag bundle loading
    // In production, this would be: <script src="https://cdn.openaceai.com/ace-embed.min.js">
    // For this example, we'll inject a simple widget manually

    const widget = document.createElement('div');
    widget.innerHTML = \`
      <div id="ace-demo-widget" style="position:fixed;bottom:20px;right:20px;z-index:99999;">
        <button id="ace-demo-fab" style="
          width:56px;height:56px;border-radius:50%;border:none;
          background:#6366f1;color:white;cursor:pointer;
          box-shadow:0 4px 16px rgba(99,102,241,0.4);
          font-size:24px;display:flex;align-items:center;justify-content:center;
        ">💬</button>
      </div>
    \`;
    document.body.appendChild(widget);

    document.getElementById('ace-demo-fab').addEventListener('click', () => {
      alert('In production, this opens the full Ace chat widget.\\n\\nThe widget connects to /api/ace and streams AI responses in real-time.');
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`\\n  🚀 OpenAce Embed Example running at http://localhost:${PORT}\\n`);
  console.log('  Make sure you have set GEMINI_API_KEY in your environment.\\n');
});
