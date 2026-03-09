#!/usr/bin/env node

/**
 * OpenAce CLI - Terminal Interface
 * Quick commands for your AI Executive Assistant
 */

import OpenAce from '../core/index.js';
import readline from 'readline';
import { program } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, '../..');

// Initialize OpenAce
let ace = null;

async function initAce() {
  if (!ace) {
    ace = new OpenAce({ baseDir });
    await ace.initialize();
  }
  return ace;
}

// CLI Program
program
  .name('ace')
  .description('OpenAce - Your AI Executive Assistant')
  .version('1.0.0');

// Chat command - Interactive mode
program
  .command('chat')
  .description('Start an interactive chat session with OpenAce')
  .action(async () => {
    const ace = await initAce();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });

    console.log(chalk.green('\n💬 Chat mode activated. Type "exit" to quit.\n'));
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        await ace.shutdown();
        process.exit(0);
      }

      if (input.toLowerCase() === 'clear') {
        ace.clearHistory();
        console.log(chalk.gray('History cleared.\n'));
        rl.prompt();
        return;
      }

      if (!input) {
        rl.prompt();
        return;
      }

      try {
        console.log(chalk.gray('\nThinking...\n'));
        const response = await ace.chat(input);
        console.log(chalk.blue('OpenAce: ') + response.message + '\n');
      } catch (error) {
        console.log(chalk.red('Error: ' + error.message + '\n'));
      }

      rl.prompt();
    });
  });

// Ask command - Single question
program
  .command('ask <question>')
  .description('Ask OpenAce a single question')
  .option('-p, --provider <provider>', 'Use specific AI provider')
  .action(async (question, options) => {
    const ace = await initAce();
    
    try {
      console.log(chalk.gray('\nThinking...\n'));
      const response = await ace.chat(question, { provider: options.provider });
      console.log(chalk.blue('OpenAce: ') + response.message + '\n');
      
      if (response.metadata) {
        console.log(chalk.gray(`Provider: ${response.metadata.provider} | Model: ${response.metadata.model}`));
      }
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    }
    
    await ace.shutdown();
    process.exit(0);
  });

// Status command
program
  .command('status')
  .description('Show OpenAce status and health')
  .action(async () => {
    const ace = await initAce();
    const status = ace.getStatus();
    
    console.log(chalk.bold('\n📊 OpenAce Status\n'));
    console.log(chalk.cyan('AI Provider:'), status.provider.active);
    console.log(chalk.cyan('Model:'), status.provider.config.model);
    console.log();
    console.log(chalk.cyan('Skills:'));
    console.log(`  Total: ${status.skills.total}`);
    console.log(`  CMO: ${status.skills.cmo}`);
    console.log(`  CTO: ${status.skills.cto}`);
    console.log(`  COO: ${status.skills.coo}`);
    console.log();
    console.log(chalk.cyan('Knowledge Base:'), `${status.knowledge.entries} entries`);
    
    if (status.heartbeat) {
      console.log();
      console.log(chalk.cyan('Heartbeat:'));
      console.log(`  Running: ${status.heartbeat.running ? '✅' : '❌'}`);
      console.log(`  Uptime: ${status.heartbeat.uptime}`);
      console.log(`  Beats: ${status.heartbeat.count}`);
    }
    
    console.log();
    await ace.shutdown();
    process.exit(0);
  });

// Skills command
program
  .command('skills')
  .description('List available skills')
  .option('-c, --category <category>', 'Filter by category (cmo, cto, coo)')
  .action(async (options) => {
    const ace = await initAce();
    
    let skills = options.category
      ? ace.skillsManager.getSkillsByCategory(options.category)
      : ace.skillsManager.getAllSkills();
    
    console.log(chalk.bold(`\n⚡ Available Skills (${skills.length})\n`));
    
    skills.forEach(skill => {
      const categoryColor = {
        cmo: chalk.magenta,
        cto: chalk.blue,
        coo: chalk.green,
        general: chalk.gray
      }[skill.category];
      
      console.log(categoryColor(`[${skill.category.toUpperCase()}]`), chalk.bold(skill.name));
      console.log(chalk.gray(`  ${skill.description}`));
      if (skill.examples && skill.examples.length > 0) {
        console.log(chalk.gray(`  Example: "${skill.examples[0]}"`));
      }
      console.log();
    });
    
    await ace.shutdown();
    process.exit(0);
  });

// Switch provider command
program
  .command('switch <provider>')
  .description('Switch AI provider (claude, openai, gemini, ollama)')
  .action(async (provider) => {
    const ace = await initAce();
    
    try {
      await ace.switchProvider(provider);
      console.log(chalk.green(`\n✅ Switched to ${provider}\n`));
    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
    
    await ace.shutdown();
    process.exit(0);
  });

// Quick commands for common tasks
program
  .command('marketing')
  .description('Quick marketing analysis')
  .action(async () => {
    const ace = await initAce();
    console.log(chalk.gray('\nAnalyzing marketing performance...\n'));
    
    try {
      const response = await ace.chat('Generate my weekly marketing report with insights and recommendations.');
      console.log(response.message + '\n');
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    }
    
    await ace.shutdown();
    process.exit(0);
  });

program
  .command('operations')
  .description('Quick operations overview')
  .action(async () => {
    const ace = await initAce();
    console.log(chalk.gray('\nAnalyzing operations...\n'));
    
    try {
      const response = await ace.chat('Show me operations metrics and efficiency recommendations.');
      console.log(response.message + '\n');
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    }
    
    await ace.shutdown();
    process.exit(0);
  });

program
  .command('tech')
  .description('Quick tech stack review')
  .action(async () => {
    const ace = await initAce();
    console.log(chalk.gray('\nReviewing tech stack...\n'));
    
    try {
      const response = await ace.chat('Review our technology stack and suggest improvements.');
      console.log(response.message + '\n');
    } catch (error) {
      console.log(chalk.red('Error: ' + error.message));
    }
    
    await ace.shutdown();
    process.exit(0);
  });

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
