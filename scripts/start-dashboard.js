#!/usr/bin/env node
/**
 * OpenAce Web Dashboard Server
 * 
 * Clean entry point that uses the ApiGateway for all route handling.
 * The Gateway extracts all route definitions into an organized, maintainable module.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { logCapture } from '../src/core/diagnostics/LogCapture.js';
import { ActivityLogger } from '../src/core/activity/ActivityLogger.js';
import { OpenAce } from '../src/core/index.js';
import { ApiGateway } from '../src/core/gateway/ApiGateway.js';
import { eventBus, EVENTS } from '../src/core/events/EventBus.js';
import open from 'open';

// Start log capture immediately — before anything else initializes
logCapture.start();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
// Stripe webhook needs raw body for signature verification — must come BEFORE json parsing
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use('/api/projects/import/zip', express.raw({ limit: '100mb', type: ['application/zip', 'application/octet-stream'] }));

// Cloud mode — auth middleware (passes through in local mode)
import { authMiddleware, authRoutes } from '../src/core/cloud/authMiddleware.js';
import { identityMiddleware, promoteAnonymousOwner, clearAnonymousCookie } from '../src/core/cloud/identity.js';
import { isCloudMode } from '../src/core/cloud/SupabaseClient.js';
import { MagicLink } from '../src/core/cloud/MagicLink.js';

// Identity FIRST — resolves req.ownerId (JWT userId, else signed anon cookie)
// and attaches req.data, the per-owner storage adapter. Everything downstream
// depends on this having run.
app.use(identityMiddleware);
app.use('/api/', authMiddleware);
if (isCloudMode()) {
  authRoutes(app);
  console.log('☁️  Cloud mode enabled — SQLite + JWT auth active');
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', cloud: isCloudMode(), version: '1.8.0' }));

// Magic link auth — passwordless login
const magicLink = new MagicLink();

// Send magic link email
app.post('/api/auth/magic-link', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.json({ success: false, error: 'Enter a valid email address.' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
  const limited = magicLink.checkRateLimit(email, ip);
  if (limited) return res.status(429).json({ success: false, error: limited });

  if (!MagicLink.isConfigured()) {
    // Say so plainly rather than claiming an email is on its way.
    console.warn('[auth] magic link requested but email is not configured');
    return res.json({
      success: false,
      error: "Email isn't set up on this server yet, so I can't send a login link.",
    });
  }

  const url = magicLink.generateLink(email, ip);
  const { sent, error } = await magicLink.sendEmail(email, url);

  if (!sent) {
    return res.status(502).json({ success: false, error: error || 'Could not send the login link.' });
  }
  // Same response whether or not an account exists — don't leak who's registered.
  res.json({ success: true, sent: true, message: 'Check your email for a login link.' });
});

// Verify magic link — issues a JWT and drops the user into the app
app.get('/auth/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/?error=missing_token');

  const result = magicLink.verify(token);
  if (!result.success) return res.redirect('/?error=' + encodeURIComponent(result.error));

  // Carry across anything they did anonymously in this browser before signing in.
  if (req.ownerId && req.ownerId.startsWith('anon_') && req.ownerId !== result.user.id) {
    try {
      promoteAnonymousOwner(req.ownerId, result.user.id);
      console.log(`[auth] merged anonymous session ${req.ownerId} into ${result.user.email}`);
    } catch (e) {
      console.error('[auth] anon merge failed:', e.message);
    }
  }
  // The anon cookie has served its purpose — the JWT is the identity now.
  clearAnonymousCookie(res);

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in...</title></head><body style="background:#0A0A0A;color:#F0EDE8;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div style="text-align:center"><p style="font-size:1.2rem">Signing you in...</p></div>
    <script>
      localStorage.setItem('ace_token',${JSON.stringify(result.token)});
      localStorage.setItem('ace_user',${JSON.stringify(JSON.stringify(result.user))});
      window.location.replace('/');
    </script></body></html>`);
});

// Admin training page
app.get('/admin/training', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Train Ace</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0C0B10;color:#E8E6F0;font-family:Inter,-apple-system,sans-serif;padding:24px;max-width:700px;margin:0 auto}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px}
h1{font-size:1.5rem}a{color:#8B7EC8;text-decoration:none;font-size:.85rem}a:hover{text-decoration:underline}
.step{background:#16151E;border:1px solid #2A2840;border-radius:14px;padding:24px;margin-bottom:20px}
.step-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.step-num{width:32px;height:32px;border-radius:50%;background:#8B7EC8;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0}
.step-title{font-size:1.05rem;font-weight:600}
.step-desc{color:#726E90;font-size:.85rem;line-height:1.5;margin-bottom:16px}
textarea,input[type=text]{width:100%;padding:12px;border-radius:8px;border:1px solid #2A2840;background:#0C0B10;color:#E8E6F0;font-size:.9rem;margin-bottom:8px;outline:none;resize:vertical;font-family:inherit}
textarea:focus,input[type=text]:focus{border-color:#8B7EC8}
input[type=file]{margin-bottom:8px;font-size:.85rem;color:#B0ACCA}
button{padding:12px 24px;border:none;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .15s}
.btn-big{width:100%;padding:16px;font-size:1rem;border-radius:12px;margin-top:8px}
.btn-primary{background:#8B7EC8;color:#fff}.btn-primary:hover{background:#6B5FA8}
.btn-green{background:#5CB882;color:#fff}.btn-green:hover{background:#4A9A6A}
.btn-outline{background:transparent;border:1px solid #2A2840;color:#B0ACCA;margin-top:8px}.btn-outline:hover{border-color:#8B7EC8}
.status{padding:12px;border-radius:8px;margin-top:12px;font-size:.85rem;display:none}
.status.ok{background:#1a2e1a;border:1px solid #2e4a2e;color:#5CB882;display:block}
.status.err{background:#2e1a1a;border:1px solid #4a2e2e;color:#C87070;display:block}
.status.info{background:#1a1a2e;border:1px solid #2e2e4a;color:#8B7EC8;display:block}
.stat-row{display:flex;gap:12px;margin-bottom:20px}.stat-box{flex:1;background:#1E1D2A;border-radius:10px;padding:14px;text-align:center}
.stat-box .num{font-size:1.5rem;font-weight:700;color:#8B7EC8}.stat-box .label{font-size:.7rem;color:#726E90;margin-top:2px}
.example{padding:10px;border-bottom:1px solid #1E1D2A;font-size:.83rem}.example:last-child{border:none}
.example .u{color:#8B7EC8;font-weight:600}.example .a{color:#B0ACCA;margin-top:3px}
#kbList div{padding:6px 0;border-bottom:1px solid #1E1D2A;font-size:.82rem;color:#B0ACCA}
.divider{height:1px;background:#2A2840;margin:32px 0}
</style></head><body>
<div class="topbar"><h1>Train Ace</h1><a href="/">← Dashboard</a></div>

<div class="stat-row">
<div class="stat-box"><div class="num" id="count">—</div><div class="label">Training Examples</div></div>
<div class="stat-box"><div class="num" id="kbCount">—</div><div class="label">Knowledge Docs</div></div>
<div class="stat-box"><div class="num">♣</div><div class="label">Ace Clubs</div></div>
</div>

<div class="step">
<div class="step-header"><div class="step-num">1</div><div class="step-title">Auto-Train (Recommended)</div></div>
<div class="step-desc">One click — Ace learns business knowledge across 56 topics: sales, marketing, 15+ industries, operations, finance. Uses Gemini to generate training data and knowledge docs automatically.</div>
<input type="text" id="geminiKey" placeholder="Paste your Gemini API key (free from aistudio.google.com/apikey)">
<button class="btn-green btn-big" onclick="autoTrain()">Auto-Train Ace on Business Knowledge</button>
<div class="status" id="autoStatus"></div>
</div>

<div class="step">
<div class="step-header"><div class="step-num">2</div><div class="step-title">Upload Knowledge Docs</div></div>
<div class="step-desc">Upload PDFs, text files, or docs with business info. Ace searches these when answering — no retraining needed. Instant.</div>
<input type="file" id="knowledgeFile" accept=".pdf,.txt,.csv,.docx,.md" multiple>
<button class="btn-primary" onclick="uploadKnowledge()">Upload Documents</button>
<div class="status" id="kbStatus"></div>
<div id="kbList" style="margin-top:12px"></div>
</div>

<div class="step">
<div class="step-header"><div class="step-num">3</div><div class="step-title">Add Custom Examples</div></div>
<div class="step-desc">Teach Ace exactly how to respond. Type what a user would say and how Ace should answer. Short, direct, one follow-up question.</div>
<input type="text" id="userMsg" placeholder="User says: How do I get more referrals?">
<textarea id="aceMsg" rows="2" placeholder="Ace responds: Ask right after a win. 'Know anyone who could use this?' Most happy clients refer — they just need to be asked."></textarea>
<button class="btn-primary" onclick="addExample()">Add Example</button>
<div class="status" id="addStatus"></div>
</div>

<div class="step">
<div class="step-header"><div class="step-num">4</div><div class="step-title">Retrain the Model</div></div>
<div class="step-desc">After adding examples (Step 1 or 3), retrain so Ace learns them. Takes 5-10 minutes. You can close this page — it runs in the background.</div>
<button class="btn-primary btn-big" onclick="retrain()">Retrain Ace Clubs Model</button>
<div class="status" id="trainStatus"></div>
</div>

<div class="divider"></div>
<div style="color:#726E90;font-size:.8rem;margin-bottom:12px;font-weight:600">Recent Training Examples</div>
<div id="examples" style="background:#16151E;border:1px solid #2A2840;border-radius:10px;padding:4px 12px;max-height:300px;overflow:auto">Loading...</div>

<script>
const token=localStorage.getItem('ace_token')||'';
const headers={'Content-Type':'application/json','Authorization':'Bearer '+token};

async function load(){
  try{const r=await fetch('/api/admin/training',{headers});const d=await r.json();
  if(!d.success)return;document.getElementById('count').textContent=d.data.totalExamples;
  const el=document.getElementById('examples');
  if(!d.data.examples.length){el.innerHTML='<p style="color:#726E90;padding:12px">No examples yet — start with Step 1</p>';return;}
  el.innerHTML=d.data.examples.map(e=>'<div class="example"><div class="u">'+e.user+'</div><div class="a">'+e.assistant+'</div></div>').join('');}catch{}
}

async function addExample(){
  const user=document.getElementById('userMsg').value.trim(),assistant=document.getElementById('aceMsg').value.trim(),st=document.getElementById('addStatus');
  if(!user||!assistant){st.className='status err';st.textContent='Both fields required';return;}
  const r=await fetch('/api/admin/training/add',{method:'POST',headers,body:JSON.stringify({user,assistant})});const d=await r.json();
  if(d.success){st.className='status ok';st.textContent='Added!';document.getElementById('userMsg').value='';document.getElementById('aceMsg').value='';load();}
  else{st.className='status err';st.textContent=d.error;}
}

async function retrain(){
  const st=document.getElementById('trainStatus');st.className='status info';st.textContent='Training started... 5-10 minutes. You can close this page.';
  const r=await fetch('/api/admin/training/retrain',{method:'POST',headers});const d=await r.json();
  if(d.success)st.className='status ok',st.textContent='Training running. Model will auto-rebuild when done.';
  else st.className='status err',st.textContent=d.error;
}

async function autoTrain(){
  const key=document.getElementById('geminiKey').value.trim(),st=document.getElementById('autoStatus');
  if(!key){st.className='status err';st.textContent='Paste your Gemini API key first (free from aistudio.google.com/apikey)';return;}
  st.className='status info';st.textContent='Starting auto-training across 56 business topics... This takes about 8 minutes.';
  try{const r=await fetch('/api/admin/training/auto',{method:'POST',headers,body:JSON.stringify({geminiKey:key})});const d=await r.json();
  if(d.success)st.className='status ok',st.textContent='Auto-training started! 56 topics being processed. Check back in 8 minutes then hit Retrain.';
  else st.className='status err',st.textContent=d.error;}catch(e){st.className='status err';st.textContent='Failed: '+e.message;}
}

async function uploadKnowledge(){
  const files=document.getElementById('knowledgeFile').files,st=document.getElementById('kbStatus');
  if(!files.length){st.className='status err';st.textContent='Select files first';return;}
  st.className='status info';st.textContent='Uploading...';
  for(const f of files){const fd=new FormData();fd.append('file',f);
  await fetch('/api/workload/upload',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});}
  st.className='status ok';st.textContent=files.length+' file(s) uploaded!';loadKnowledge();
}

async function loadKnowledge(){
  try{const r=await fetch('/api/workload/sources',{headers});const d=await r.json();const el=document.getElementById('kbList');
  document.getElementById('kbCount').textContent=d.data?.length||0;
  if(!d.data?.length){el.innerHTML='';return;}
  el.innerHTML=d.data.map(s=>'<div>📄 '+s.name+'</div>').join('');}catch{}
}

load();loadKnowledge();
</script></body></html>`);
});

// Admin login page — accessible at /admin
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ace Admin</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0C0B10;color:#E8E6F0;font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{width:100%;max-width:360px;padding:40px;border-radius:16px;background:#16151E;border:1px solid #2A2840}
h1{font-size:1.4rem;margin-bottom:8px}p{color:#726E90;font-size:.85rem;margin-bottom:24px}
input{width:100%;padding:12px 16px;border-radius:10px;border:1px solid #2A2840;background:#0C0B10;color:#E8E6F0;font-size:.95rem;margin-bottom:12px;outline:none}
input:focus{border-color:#8B7EC8}
button{width:100%;padding:12px;border:none;border-radius:10px;background:#8B7EC8;color:#fff;font-size:.95rem;font-weight:600;cursor:pointer}
button:hover{background:#6B5FA8}.err{color:#C87070;font-size:.85rem;margin-bottom:12px;display:none}
</style></head><body><div class="box"><h1>Ace Admin</h1><p>Sign in to manage OpenAce</p>
<div class="err" id="err"></div>
<input type="email" id="email" placeholder="Email" value="openaceai@gmail.com">
<input type="password" id="pass" placeholder="Password">
<button onclick="login()">Sign In</button></div>
<script>async function login(){const e=document.getElementById('email').value,p=document.getElementById('pass').value,err=document.getElementById('err');
err.style.display='none';
try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});
const d=await r.json();if(d.success){localStorage.setItem('ace_token',d.data.token);localStorage.setItem('ace_user',JSON.stringify(d.data.user));
window.location.href='/';}else{err.textContent=d.error||'Login failed';err.style.display='block';}}
catch(x){err.textContent='Connection failed';err.style.display='block';}}</script></body></html>`);
});

app.use(express.static(path.join(baseDir, 'src/desktop/dashboard-ui/dist')));

// Serve generated projects (landing pages, etc.) at /projects/
app.use('/projects', express.static(path.join(baseDir, 'projects'), {
  extensions: ['html', 'htm'],
  index: 'index.html'
}));

// Serve documentation
app.use('/docs', express.static(path.join(baseDir, 'docs'), { extensions: ['html'], index: 'index.html' }));

// Serve Ace Studio React app
app.use('/studio', express.static(path.join(baseDir, 'src', 'studio', 'dist')));


// Initialize systems
const appStartTime = Date.now();
let activityLogger;
let aceInstance;
let gateway;

async function initialize() {
  try {
    // 1. Activity Logger
    activityLogger = new ActivityLogger({ baseDir });
    await activityLogger.initialize();
    console.log('✅ Activity Logger initialized');
    
    // 2. OpenAce Core
    aceInstance = new OpenAce({ baseDir });
    await aceInstance.initialize();
    console.log('✅ OpenAce initialized');

    // 3. API Gateway — registers ALL routes
    gateway = new ApiGateway(app, {
      ace: aceInstance,
      activityLogger,
      baseDir,
      startTime: appStartTime
    });
    await gateway.initialize();
    console.log('✅ API Gateway initialized');

  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received — shutting down gracefully...');
  eventBus.emit(EVENTS.SYSTEM_SHUTDOWN, { reason: 'SIGTERM' });
  if (aceInstance) await aceInstance.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received — shutting down gracefully...');
  eventBus.emit(EVENTS.SYSTEM_SHUTDOWN, { reason: 'SIGINT' });
  if (aceInstance) await aceInstance.shutdown();
  process.exit(0);
});

// Unhandled rejections — log but don't crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  eventBus.emit(EVENTS.SYSTEM_ERROR, { type: 'unhandledRejection', error: String(reason) });
  // Save crash report if available
  if (aceInstance?.crashReporter) {
    aceInstance.crashReporter.reportCrash(reason instanceof Error ? reason : new Error(String(reason)), { fatal: false }).catch(() => {});
  }
});

// Uncaught exceptions — save crash report then exit
process.on('uncaughtException', async (error) => {
  console.error('💀 Uncaught Exception:', error);
  eventBus.emit(EVENTS.SYSTEM_ERROR, { type: 'uncaughtException', error: String(error) });
  if (aceInstance?.crashReporter) {
    try { await aceInstance.crashReporter.reportCrash(error, { fatal: true }); } catch { /* best effort */ }
  }
  process.exit(1);
});

// Start server
initialize().then(() => {
  // SPA fallback for Studio routes
  app.get(/^\/studio(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(baseDir, 'src', 'studio', 'dist', 'index.html'));
  });

  // SPA fallback for the main dashboard. This must be the last route.
  // It handles all routes that were not caught by static files or API routes.
  app.get(/./, (req, res) => {
    res.sendFile(path.join(baseDir, 'src/desktop/dashboard-ui/dist/index.html'));
  });

  app.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎯 OpenAce Dashboard                            ║
║                                                   ║
║   Dashboard:  http://localhost:${PORT}              ║
║   Health:     http://localhost:${PORT}/health        ║
║   Events:     http://localhost:${PORT}/api/events/status ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);

    // Auto-open browser
    try {
      await open(`http://localhost:${PORT}`);
    } catch (err) {
      console.log(`💡 Open http://localhost:${PORT} in your browser`);
    }
  });
});
