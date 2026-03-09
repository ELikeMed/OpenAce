#!/usr/bin/env node

/**
 * OpenAce Telegram Bot Startup Script
 *
 * This script starts Ace's Telegram bot with full AI capabilities.
 * Now powered by AceBrain — unified intelligence shared with the dashboard!
 *
 * Usage: npm run telegram
 */

import { TelegramBot } from '../src/core/communication/TelegramBot.js';
import { AceMessageProcessor } from '../src/core/communication/AceMessageProcessor.js';
import { AceBrain } from '../src/core/brain/AceBrain.js';
import { AIProviderManager } from '../src/core/ai-providers/AIProviderManager.js';
import { KnowledgeBase } from '../src/core/knowledge/KnowledgeBase.js';
import { SOPManager } from '../src/core/memory/SOPManager.js';
import { SkillsManager } from '../src/core/skills/SkillsManager.js';
import { PipelineManager } from '../src/core/pipeline/PipelineManager.js';
import { ActionEngine } from '../src/core/engine/ActionEngine.js';
import { PermissionsManager } from '../src/core/permissions/PermissionsManager.js';
import { ResearchAgent } from '../src/core/agents/ResearchAgent.js';
import { AgentOrchestrator } from '../src/core/agents/AgentOrchestrator.js';
import ProjectManager from '../src/core/projects/ProjectManager.js';
import DeployPipeline from '../src/core/projects/DeployPipeline.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Load configuration
async function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, 'config', 'openace.config.json');
  const configData = await fs.readFile(configPath, 'utf8');
  return JSON.parse(configData);
}

// Main startup function
async function startTelegramBot() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        🤖 OpenAce AI Executive Assistant                   ║');
  console.log('║            Telegram Edition (AceBrain v2)                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Load config
  const config = await loadConfig();
  
  // Check for bot token
  const botToken = config.telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.log('❌ No Telegram bot token found!');
    console.log('');
    console.log('To set up your Telegram bot:');
    console.log('');
    console.log('1. Open Telegram and message @BotFather');
    console.log('2. Send /newbot and follow the prompts');
    console.log('3. Copy your bot token');
    console.log('4. Add it to config/openace.config.json:');
    console.log('');
    console.log('   "telegram": {');
    console.log('     "enabled": true,');
    console.log('     "bot_token": "YOUR_TOKEN_HERE",');
    console.log('     "authorized_users": [YOUR_TELEGRAM_ID]');
    console.log('   }');
    console.log('');
    process.exit(1);
  }

  // Initialize subsystems for AceBrain
  console.log('🧠 Initializing AceBrain (unified intelligence)...');
  
  const configPath = path.join(PROJECT_ROOT, 'config', 'openace.config.json');
  const dataDir = path.join(PROJECT_ROOT, 'data');

  // AI Provider
  const aiManager = new AIProviderManager(configPath);
  await aiManager.initialize();
  console.log(`   ✅ AI Provider: ${aiManager.activeProvider}`);

  // Knowledge Base
  const knowledgeBase = new KnowledgeBase(path.join(dataDir, 'knowledge'));
  await knowledgeBase.initialize();
  console.log(`   ✅ Knowledge Base: ${knowledgeBase.getStats().total} entries`);

  // SOP Manager
  const sopManager = new SOPManager({ dataDir: path.join(dataDir, 'sops') });
  await sopManager.initialize();
  console.log(`   ✅ SOPs: ${sopManager.getAllSOPs().length} procedures`);

  // Skills Manager
  const skillsManager = new SkillsManager(path.join(dataDir, 'skills'));
  await skillsManager.initialize();
  console.log(`   ✅ Skills: ${skillsManager.getAllSkills().length} skills`);

  // Pipeline Manager
  const permissionsManager = new PermissionsManager(path.join(dataDir, 'permissions/permissions.json'));
  await permissionsManager.initialize();
  
  const pipelineManager = new PipelineManager({
    pipelinePath: path.join(dataDir, 'pipeline/pipeline.json'),
    permissionsManager
  });
  await pipelineManager.initialize();
  console.log(`   ✅ Pipeline: active`);

  // Research Agent
  const researchAgent = new ResearchAgent({
    permissionsManager,
    dataDir: path.join(dataDir, 'research'),
    maxConcurrentTabs: 3
  });
  await researchAgent.initialize();
  console.log(`   ✅ ResearchAgent: active`);

  // Project Manager
  const projectManager = new ProjectManager(path.join(PROJECT_ROOT, 'projects'));
  console.log(`   ✅ ProjectManager: active`);

  // Deploy Pipeline
  const deployPipeline = new DeployPipeline({
    projectManager,
    baseDir: PROJECT_ROOT,
    projectsDir: path.join(PROJECT_ROOT, 'projects')
  });
  console.log(`   ✅ DeployPipeline: active`);

  // Action Engine
  const actionEngine = new ActionEngine({
    baseDir: PROJECT_ROOT,
    config,
    onProgress: (msg) => console.log(`   [ActionEngine] ${msg}`)
  });
  await actionEngine.initialize({
    pipelineManager,
    researchAgent,
    knowledgeBase,
    sopManager,
    skillsManager,
    aiManager,
    permissionsManager,
    projectManager,
    deployPipeline,
    config
  });
  console.log(`   ✅ ActionEngine: active`);

  // Initialize Agent Orchestrator (for code/dev tasks)
  const orchestrator = new AgentOrchestrator({
    aiManager,
    permissionsManager,
    pipelineManager,
    baseDir: PROJECT_ROOT,
    onProgress: (msg) => console.log(`   [Orchestrator] ${msg}`)
  });
  await orchestrator.initialize({
    research: researchAgent,
    pipeline: pipelineManager
  });
  console.log(`   ✅ AgentOrchestrator: active (CodeAgent ready)`);

  // Wire AgentOrchestrator and CodeAgent into ActionEngine
  const codeAgent = orchestrator.agents.code;
  try {
    actionEngine.setAgentOrchestrator(orchestrator);
    actionEngine.setCodeAgent(codeAgent);
    // Wire CodeAgent into ProjectManager for rich template scaffolding
    if (codeAgent && projectManager) {
      projectManager.codeAgent = codeAgent;
      codeAgent.projectManager = projectManager;
    }
  } catch (err) {
    console.warn('   ⚠️ Failed to wire agents to ActionEngine:', err.message);
  }

  // Initialize AceBrain
  const brain = new AceBrain({
    config,
    onProgress: (msg) => console.log(`   [AceBrain] ${msg}`)
  });
  await brain.initialize({
    aiManager,
    actionEngine,
    knowledgeBase,
    sopManager,
    skillsManager,
    pipelineManager,
    researchAgent,
    config
  });
  console.log('🧠 AceBrain online!');

  // Wire AgentOrchestrator and CodeAgent into AceBrain
  try {
    brain.setAgentOrchestrator(orchestrator);
    brain.setCodeAgent(codeAgent);
    console.log('🔧 CodeAgent wired into AceBrain and ActionEngine');
  } catch (err) {
    console.warn('   ⚠️ Failed to wire agents to AceBrain:', err.message);
  }

  // Initialize the legacy Message Processor (for backward compatibility)
  const messageProcessor = new AceMessageProcessor(config);
  await messageProcessor.initialize();
  
  // Wire AceBrain into the message processor
  messageProcessor.setBrain(brain);
  console.log('🔗 AceBrain wired into Telegram message processor');

  // Initialize Telegram Bot
  const bot = new TelegramBot({
    token: botToken,
    botUsername: config.telegram?.bot_username || 'OpenAceBot',
    authorizedUsers: config.telegram?.authorized_users || [],
    enabled: config.telegram?.enabled !== false
  });

  // Connect the intelligent message handler
  bot.setMessageHandler(async (chatId, text, msg) => {
    const userName = msg.from.first_name || 'Boss';
    
    // Process message through Ace's brain
    const response = await messageProcessor.processMessage(chatId, text, {
      userName,
      userId: msg.from.id,
      username: msg.from.username,
      chatType: msg.chat.type
    });
    
    return {
      text: response.text,
      options: { parse_mode: 'Markdown' }
    };
  });

  // Register enhanced commands that use AI
  bot.registerCommand('start', async (chatId, args, msg) => {
    const name = msg.from.first_name || 'there';
    return {
      text: `👋 Hey ${name}! I'm **Ace**, your AI Executive Assistant.\n\n` +
            `I can help you with virtually anything:\n\n` +
            `📋 **Strategy & Planning**\n` +
            `"Create a strategy for finding meetup hosts in Fort Lauderdale"\n\n` +
            `🔍 **Research**\n` +
            `"Research potential partners in the real estate industry"\n\n` +
            `👥 **Lead Generation**\n` +
            `"Find me 10 marketing agencies in Miami"\n\n` +
            `📊 **Pipeline & Tasks**\n` +
            `"Show me the pipeline" or "Add John Smith as a lead"\n\n` +
            `Just message me naturally - I understand context and can have real conversations!\n\n` +
            `What can I help you with today?`,
      options: { parse_mode: 'Markdown' }
    };
  });

  bot.registerCommand('help', async (chatId, args, msg) => {
    return {
      text: `🤖 **Ace - AI Executive Assistant**\n\n` +
            `You can ask me anything naturally! Here are some examples:\n\n` +
            `**Strategy:**\n` +
            `• "Create a marketing strategy for Q1"\n` +
            `• "How should we approach the Fort Lauderdale market?"\n` +
            `• "Plan a meetup host recruitment campaign"\n\n` +
            `**Research:**\n` +
            `• "Who would be great meetup hosts in Miami?"\n` +
            `• "Research competitor pricing"\n` +
            `• "Find tech companies in South Florida"\n\n` +
            `**Leads & Pipeline:**\n` +
            `• "Find 10 real estate leads"\n` +
            `• "Add Sarah Connor as a lead"\n` +
            `• "What's in the pipeline?"\n\n` +
            `**Commands:**\n` +
            `/status - Check system status\n` +
            `/pipeline - View pipeline summary\n` +
            `/tasks - View pending tasks\n` +
            `/addlead [Name - Company] - Add a lead\n` +
            `/save - Save current conversation\n\n` +
            `Just talk to me like you would a real assistant!`,
      options: { parse_mode: 'Markdown' }
    };
  });

  bot.registerCommand('status', async (chatId, args, msg) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const brainStatus = brain.getStatus();
    const aiStatus = brainStatus.aiProvider || 'basic';
    const skillCount = skillsManager.getAllSkills().length;
    const sopCount = sopManager.getAllSOPs().length;
    const learnings = brainStatus.learningsCount;
    
    return {
      text: `🟢 **Ace Status Report**\n\n` +
            `**System:**\n` +
            `• Status: Online (AceBrain v2)\n` +
            `• Uptime: ${hours}h ${minutes}m\n` +
            `• Time: ${new Date().toLocaleString()}\n\n` +
            `**🧠 Intelligence:**\n` +
            `• Brain: AceBrain (unified)\n` +
            `• AI Provider: ${aiStatus}\n` +
            `• Skills: ${skillCount}\n` +
            `• SOPs: ${sopCount}\n` +
            `• Learnings: ${learnings}\n` +
            `• Conversations: ${brainStatus.conversationCount}\n\n` +
            `**Capabilities:**\n` +
            `• ✅ Chain-of-thought reasoning\n` +
            `• ✅ Shared memory (Dashboard ↔ Telegram)\n` +
            `• ✅ Strategy creation\n` +
            `• ✅ Lead generation & pipeline\n` +
            `• ✅ Self-learning from interactions\n` +
            `• ✅ SOP execution\n\n` +
            `What would you like me to work on?`,
      options: { parse_mode: 'Markdown' }
    };
  });

  bot.registerCommand('strategy', async (chatId, args, msg) => {
    if (args.length === 0) {
      return {
        text: `📋 **Strategy Mode**\n\n` +
              `Tell me what strategy you need help with:\n\n` +
              `Example:\n` +
              `/strategy Find meetup hosts in Fort Lauderdale\n\n` +
              `Or just describe what you're trying to achieve and I'll help create a plan!`,
        options: { parse_mode: 'Markdown' }
      };
    }
    
    const request = args.join(' ');
    const response = await messageProcessor.processMessage(chatId, `Create a strategy for: ${request}`, {
      userName: msg.from.first_name || 'Boss',
      userId: msg.from.id
    });
    
    return {
      text: response.text,
      options: { parse_mode: 'Markdown' }
    };
  });

  bot.registerCommand('research', async (chatId, args, msg) => {
    if (args.length === 0) {
      return {
        text: `🔍 **Research Mode**\n\n` +
              `What would you like me to research?\n\n` +
              `Example:\n` +
              `/research Real estate investors in Miami\n\n` +
              `I'll gather information and compile findings for you!`,
        options: { parse_mode: 'Markdown' }
      };
    }
    
    const topic = args.join(' ');
    const response = await messageProcessor.processMessage(chatId, `Research: ${topic}`, {
      userName: msg.from.first_name || 'Boss',
      userId: msg.from.id
    });
    
    return {
      text: response.text,
      options: { parse_mode: 'Markdown' }
    };
  });

  bot.registerCommand('addlead', async (_chatId, args, msg) => {
    if (args.length === 0) {
      return {
        text: '👥 Usage: /addlead [Name - Company]\n\nExample: /addlead John Smith - ABC Realty',
        options: { parse_mode: 'Markdown' }
      };
    }

    const leadText = args.join(' ');
    const dashIdx = leadText.indexOf(' - ');
    const company = dashIdx > -1 ? leadText.slice(dashIdx + 3).trim() : '';
    const contactName = dashIdx > -1 ? leadText.slice(0, dashIdx).trim() : leadText.trim();

    try {
      const lead = await pipelineManager.addLead({
        company: company || contactName,
        contact_name: contactName,
        source: 'telegram',
        created_by: msg.from.username || msg.from.first_name,
        notes: `Added via Telegram by ${msg.from.first_name}`
      });

      return {
        text: `✅ **Lead Added!**\n\n` +
              `• Name: ${lead.contact_name || lead.company}\n` +
              `• Company: ${lead.company}\n` +
              `• Source: Telegram\n` +
              `• ID: ${lead.id}\n\n` +
              `I'll keep track of this lead. Want me to research them?`,
        options: { parse_mode: 'Markdown' }
      };
    } catch (error) {
      return {
        text: `❌ Couldn't add lead: ${error.message}\n\nTry again or tell me more about the lead.`,
        options: { parse_mode: 'Markdown' }
      };
    }
  });

  bot.registerCommand('pipeline', async () => {
    try {
      const data = pipelineManager.getPipeline();
      const leads = data.leads || [];
      const tasks = data.tasks || data.items || [];
      const pendingTasks = tasks.filter(t => t.stage !== 'done' && t.stage !== 'completed');

      // Count leads by stage
      const leadsByStage = {};
      for (const lead of leads) {
        const stage = lead.stage || 'new';
        leadsByStage[stage] = (leadsByStage[stage] || 0) + 1;
      }
      let stageText = '';
      for (const [stage, count] of Object.entries(leadsByStage)) {
        const emoji = stage === 'won' ? '🏆' : stage === 'lost' ? '❌' : '•';
        stageText += `${emoji} ${stage}: ${count}\n`;
      }

      return {
        text: `📊 **Pipeline Overview**\n\n` +
              `**Leads:** ${leads.length}\n` +
              `${stageText || '• No leads yet\n'}\n` +
              `**Tasks:** ${pendingTasks.length} pending (${tasks.length} total)\n\n` +
              `Use /tasks to see pending tasks, /addlead to add a lead.`,
        options: { parse_mode: 'Markdown' }
      };
    } catch (error) {
      return {
        text: `📊 Pipeline is empty or not configured yet.\n\nUse /addlead [name] to add your first lead!`,
        options: { parse_mode: 'Markdown' }
      };
    }
  });

  bot.registerCommand('tasks', async () => {
    try {
      const data = pipelineManager.getPipeline();
      const tasks = (data.tasks || data.items || []).filter(
        t => t.stage !== 'done' && t.stage !== 'completed'
      );

      if (tasks.length === 0) {
        return {
          text: `📋 **Tasks**\n\nNo pending tasks right now! 🎉`,
          options: { parse_mode: 'Markdown' }
        };
      }

      const lines = tasks.slice(0, 10).map((t, i) => {
        const priority = t.priority || 'medium';
        const emoji = priority === 'high' ? '🔴' : priority === 'low' ? '🟢' : '🟡';
        return `${i + 1}. ${emoji} *${t.title}*${t.assigned_to ? ` — ${t.assigned_to}` : ''}`;
      });

      return {
        text: `📋 **Pending Tasks** (${tasks.length})\n\n${lines.join('\n')}` +
              (tasks.length > 10 ? `\n\n_...and ${tasks.length - 10} more_` : ''),
        options: { parse_mode: 'Markdown' }
      };
    } catch (error) {
      return {
        text: `📋 Could not load tasks: ${error.message}`,
        options: { parse_mode: 'Markdown' }
      };
    }
  });

  // Handle callback queries (button presses)
  bot.on('callback', async ({ chatId, data, query }) => {
    // Handle various callbacks
    if (data.startsWith('save_strategy_')) {
      await bot.sendMessage(chatId, '✅ Strategy saved! You can reference it later.');
    }
  });

  // Start the bot
  const initialized = await bot.initialize();
  
  if (!initialized) {
    console.log('');
    console.log('❌ Failed to start Telegram bot');
    console.log('   Check your token and try again.');
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ Ace is now LIVE on Telegram — powered by AceBrain v2!');
  console.log('');
  console.log(`   📱 Open Telegram and message @${bot.config.botUsername}`);
  console.log('');
  console.log('   🧠 AceBrain Intelligence:');
  console.log('   • Chain-of-thought reasoning (thinks before responding)');
  console.log('   • Shared memory with Dashboard');
  console.log('   • Self-learning from every interaction');
  console.log('   • Deep SOP/Skills awareness');
  console.log('   • Pipeline state context');
  console.log('   • Natural human-like conversation');
  console.log('');
  console.log('   Just talk to Ace like a real human assistant!');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Ace...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await bot.stop();
    process.exit(0);
  });
}

// Run
startTelegramBot().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
