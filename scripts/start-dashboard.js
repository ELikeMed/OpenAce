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
import { isCloudMode } from '../src/core/cloud/SupabaseClient.js';
app.use('/api/', authMiddleware);
if (isCloudMode()) {
  authRoutes(app);
  console.log('☁️  Cloud mode enabled — SQLite + JWT auth active');
}

// Health check (used by Railway, Docker, etc.)
app.get('/health', (req, res) => res.json({ status: 'ok', cloud: isCloudMode(), version: '1.8.0' }));

// Admin training page — accessible at /admin/training
app.get('/admin/training', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ace Training</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0C0B10;color:#E8E6F0;font-family:Inter,-apple-system,sans-serif;padding:24px;max-width:800px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:4px}h2{font-size:1.1rem;margin:24px 0 12px;color:#8B7EC8}.sub{color:#726E90;font-size:.85rem;margin-bottom:24px}
.card{background:#16151E;border:1px solid #2A2840;border-radius:12px;padding:20px;margin-bottom:16px}
.stats{display:flex;gap:16px;margin-bottom:24px}.stat{background:#16151E;border:1px solid #2A2840;border-radius:10px;padding:16px;flex:1;text-align:center}
.stat-num{font-size:1.8rem;font-weight:700;color:#8B7EC8}.stat-label{font-size:.75rem;color:#726E90;margin-top:4px}
textarea,input{width:100%;padding:12px;border-radius:8px;border:1px solid #2A2840;background:#0C0B10;color:#E8E6F0;font-size:.9rem;margin-bottom:8px;outline:none;resize:vertical;font-family:inherit}
textarea:focus,input:focus{border-color:#8B7EC8}
button{padding:10px 20px;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;margin-right:8px}
.btn-primary{background:#8B7EC8;color:#fff}.btn-primary:hover{background:#6B5FA8}
.btn-danger{background:#C87070;color:#fff}.btn-danger:hover{background:#A85858}
.btn-outline{background:transparent;border:1px solid #2A2840;color:#B0ACCA}.btn-outline:hover{border-color:#8B7EC8}
.example{padding:12px;border-bottom:1px solid #1E1D2A;font-size:.85rem}.example:last-child{border:none}
.example .user{color:#8B7EC8;font-weight:600}.example .ace{color:#B0ACCA;margin-top:4px}
.status{padding:12px;border-radius:8px;margin-top:12px;font-size:.85rem;display:none}
.status.ok{background:#1a2e1a;border:1px solid #2e4a2e;color:#5CB882;display:block}
.status.err{background:#2e1a1a;border:1px solid #4a2e2e;color:#C87070;display:block}
.status.info{background:#1a1a2e;border:1px solid #2e2e4a;color:#8B7EC8;display:block}
a{color:#8B7EC8;text-decoration:none}a:hover{text-decoration:underline}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
</style></head><body>
<div class="topbar"><div><h1>Ace Training</h1><p class="sub">Teach Ace business knowledge</p></div><a href="/">← Back to Dashboard</a></div>

<div class="stats"><div class="stat"><div class="stat-num" id="count">—</div><div class="stat-label">Training Examples</div></div>
<div class="stat"><div class="stat-num">♣</div><div class="stat-label">Ace Clubs Model</div></div></div>

<h2>Add Training Example</h2>
<div class="card">
<input id="userMsg" placeholder="What the user says... (e.g. How do I get more referrals?)">
<textarea id="aceMsg" rows="3" placeholder="How Ace should respond... (2-3 sentences, direct, one follow-up question)"></textarea>
<button class="btn-primary" onclick="addExample()">Add Example</button>
<button class="btn-outline" onclick="document.getElementById('userMsg').value='';document.getElementById('aceMsg').value=''">Clear</button>
<div class="status" id="addStatus"></div>
</div>

<h2>Retrain Model</h2>
<div class="card">
<p style="color:#726E90;font-size:.85rem;margin-bottom:12px">Runs fine-tuning on all training examples. Takes 5-10 minutes. The server stays running — training happens in the background.</p>
<button class="btn-danger" onclick="retrain()">Start Training</button>
<div class="status" id="trainStatus"></div>
</div>

<h2>Knowledge Base</h2>
<div class="card">
<p style="color:#726E90;font-size:.85rem;margin-bottom:12px">Upload documents that Ace can reference when answering questions. PDFs, text files, CSVs — anything with business knowledge. Ace doesn't memorize these — it searches them in real-time when someone asks a relevant question.</p>
<p style="color:#726E90;font-size:.85rem;margin-bottom:12px"><strong>Ideas for what to upload:</strong></p>
<ul style="color:#726E90;font-size:.85rem;margin-bottom:16px;padding-left:20px">
<li>Industry reports and market research</li>
<li>Sales playbooks and outreach templates</li>
<li>Business strategy guides</li>
<li>Pricing benchmarks by industry</li>
<li>Marketing best practices</li>
<li>Legal/compliance basics for businesses</li>
</ul>
<input type="file" id="knowledgeFile" accept=".pdf,.txt,.csv,.docx,.md" multiple style="margin-bottom:8px">
<button class="btn-primary" onclick="uploadKnowledge()">Upload to Knowledge Base</button>
<button class="btn-outline" onclick="loadKnowledge()">Refresh</button>
<div class="status" id="kbStatus"></div>
<div id="kbList" style="margin-top:12px"></div>
</div>

<h2>How Knowledge vs Training Works</h2>
<div class="card" style="color:#726E90;font-size:.85rem">
<p><strong style="color:#8B7EC8">Training examples</strong> = How Ace talks. Add a user question + ideal response. Requires retraining (5-10 min).</p>
<p style="margin-top:8px"><strong style="color:#8B7EC8">Knowledge base</strong> = What Ace knows. Upload documents with business info. Instant — no retraining needed. Ace searches them when someone asks a relevant question.</p>
<p style="margin-top:8px"><strong style="color:#8B7EC8">Best combo:</strong> Train on conversation style (50-200 examples). Upload knowledge docs for facts and data (unlimited). Ace gets the tone from training and the substance from knowledge.</p>
</div>

<h2>Recent Examples</h2>
<div class="card" id="examples">Loading...</div>

<script>
const token=localStorage.getItem('ace_token')||'';
const headers={'Content-Type':'application/json','Authorization':'Bearer '+token};

async function load(){
  const r=await fetch('/api/admin/training',{headers});
  const d=await r.json();
  if(!d.success){document.getElementById('examples').textContent='Not authorized';return;}
  document.getElementById('count').textContent=d.data.totalExamples;
  const el=document.getElementById('examples');
  if(d.data.examples.length===0){el.innerHTML='<p style="color:#726E90">No examples yet</p>';return;}
  el.innerHTML=d.data.examples.map(e=>'<div class="example"><div class="user">User: '+e.user+'</div><div class="ace">Ace: '+e.assistant+'</div></div>').join('');
}

async function addExample(){
  const user=document.getElementById('userMsg').value.trim();
  const assistant=document.getElementById('aceMsg').value.trim();
  const st=document.getElementById('addStatus');
  if(!user||!assistant){st.className='status err';st.textContent='Both fields required';return;}
  const r=await fetch('/api/admin/training/add',{method:'POST',headers,body:JSON.stringify({user,assistant})});
  const d=await r.json();
  if(d.success){st.className='status ok';st.textContent='Example added!';document.getElementById('userMsg').value='';document.getElementById('aceMsg').value='';load();}
  else{st.className='status err';st.textContent=d.error||'Failed';}
}

async function retrain(){
  const st=document.getElementById('trainStatus');
  st.className='status info';st.textContent='Training started... this takes 5-10 minutes. You can close this page.';
  const r=await fetch('/api/admin/training/retrain',{method:'POST',headers});
  const d=await r.json();
  if(d.success){st.className='status ok';st.textContent='Training running in background. Model will auto-rebuild when done.';}
  else{st.className='status err';st.textContent=d.error||'Failed';}
}

load(); loadKnowledge();

async function uploadKnowledge(){
  const files=document.getElementById('knowledgeFile').files;
  const st=document.getElementById('kbStatus');
  if(!files.length){st.className='status err';st.textContent='Select a file first';return;}
  st.className='status info';st.textContent='Uploading '+files.length+' file(s)...';
  for(const file of files){
    const formData=new FormData();formData.append('file',file);
    const r=await fetch('/api/workload/upload',{method:'POST',headers:{'Authorization':'Bearer '+token},body:formData});
    const d=await r.json();
    if(!d.success){st.className='status err';st.textContent='Failed: '+(d.error||'Unknown');return;}
  }
  st.className='status ok';st.textContent=files.length+' file(s) uploaded to knowledge base!';
  document.getElementById('knowledgeFile').value='';
  loadKnowledge();
}

async function loadKnowledge(){
  try{
    const r=await fetch('/api/workload/sources',{headers});
    const d=await r.json();
    const el=document.getElementById('kbList');
    if(!d.success||!d.data?.length){el.innerHTML='<p style="color:#726E90;font-size:.85rem">No documents yet</p>';return;}
    el.innerHTML='<p style="color:#726E90;font-size:.8rem;margin-bottom:8px">'+d.data.length+' documents loaded:</p>'+
      d.data.map(s=>'<div style="padding:6px 0;border-bottom:1px solid #1E1D2A;font-size:.82rem;color:#B0ACCA">📄 '+s.name+' <span style="color:#726E90">('+s.chunks+' chunks)</span></div>').join('');
  }catch{document.getElementById('kbList').innerHTML='';}
}
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
