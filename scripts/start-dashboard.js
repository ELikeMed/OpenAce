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

// Start log capture immediately — before anything else initializes
logCapture.start();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use('/api/projects/import/zip', express.raw({ limit: '100mb', type: ['application/zip', 'application/octet-stream'] }));

app.use(express.static(path.join(baseDir, 'src/desktop/dashboard-ui/dist')));

// Serve generated projects (landing pages, etc.) at /projects/
app.use('/projects', express.static(path.join(baseDir, 'projects'), {
  extensions: ['html', 'htm'],
  index: 'index.html'
}));

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

  app.listen(PORT, () => {
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
  });
});
