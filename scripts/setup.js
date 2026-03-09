#!/usr/bin/env node

/**
 * OpenAce Setup Wizard
 * Easy configuration for your AI Executive Assistant
 */

import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config/openace.config.json');

console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║                                                            ║'));
console.log(chalk.bold.cyan('║              Welcome to OpenAce Setup                      ║'));
console.log(chalk.bold.cyan('║          Your AI Executive Assistant                       ║'));
console.log(chalk.bold.cyan('║                                                            ║'));
console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

async function setup() {
  // Load existing config
  let config;
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
  } catch (error) {
    console.log(chalk.red('Error loading config file'));
    process.exit(1);
  }

  console.log(chalk.yellow('Let\'s configure your AI brain. Choose which provider(s) you want to use:\n'));

  // AI Provider selection
  const providerAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'primary_provider',
      message: 'Which AI provider do you want to use as primary?',
      choices: [
        { name: 'Claude (Anthropic) - Best for analysis & reasoning', value: 'claude' },
        { name: 'ChatGPT (OpenAI) - Great all-around performance', value: 'openai' },
        { name: 'Gemini (Google) - Good for multimodal tasks', value: 'gemini' },
        { name: 'Ollama (Local/Free) - Run on your Mac, 100% private', value: 'ollama' }
      ]
    }
  ]);

  config.ai_providers.active_provider = providerAnswers.primary_provider;

  // Configure the selected provider
  const provider = providerAnswers.primary_provider;
  
  if (provider === 'ollama') {
    console.log(chalk.cyan('\n📦 Ollama Setup'));
    console.log(chalk.gray('Ollama runs locally on your Mac - no API key needed!'));
    console.log(chalk.gray('Install it from: https://ollama.ai\n'));
    
    const ollamaAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installed',
        message: 'Have you installed Ollama?',
        default: false
      },
      {
        type: 'input',
        name: 'model',
        message: 'Which model do you want to use?',
        default: 'llama3.1',
        when: (answers) => answers.installed
      }
    ]);

    if (ollamaAnswers.installed) {
      config.ai_providers.providers.ollama.enabled = true;
      config.ai_providers.providers.ollama.model = ollamaAnswers.model;
      console.log(chalk.green('✅ Ollama configured!'));
    } else {
      console.log(chalk.yellow('\n⚠️  Install Ollama and run setup again.'));
      process.exit(0);
    }
  } else {
    // Cloud provider setup
    const providerName = {
      claude: 'Anthropic Claude',
      openai: 'OpenAI',
      gemini: 'Google Gemini'
    }[provider];

    console.log(chalk.cyan(`\n🔑 ${providerName} Setup`));
    console.log(chalk.gray('You can use your existing subscription/API key\n'));

    const apiAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'api_key',
        message: `Enter your ${providerName} API key:`,
        validate: (input) => input.length > 0 || 'API key is required'
      },
      {
        type: 'list',
        name: 'subscription',
        message: 'What subscription tier do you have?',
        choices: ['free', 'pro', 'plus', 'team', 'enterprise'],
        default: 'pro'
      }
    ]);

    config.ai_providers.providers[provider].enabled = true;
    config.ai_providers.providers[provider].api_key = apiAnswers.api_key;
    config.ai_providers.providers[provider].subscription_type = apiAnswers.subscription;
    
    console.log(chalk.green(`✅ ${providerName} configured!`));
  }

  // Personality configuration
  console.log(chalk.cyan('\n🎭 Let\'s configure OpenAce\'s personality\n'));

  const personalityAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What do you want to call your assistant?',
      default: config.personality.name
    },
    {
      type: 'list',
      name: 'style',
      message: 'Communication style?',
      choices: [
        'Clear, concise, and actionable',
        'Detailed and thorough',
        'Casual and friendly',
        'Formal and professional'
      ],
      default: config.personality.communication_style
    }
  ]);

  config.personality.name = personalityAnswers.name;
  config.personality.communication_style = personalityAnswers.style;

  // Features
  console.log(chalk.cyan('\n⚙️  Feature Configuration\n'));

  const featureAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'heartbeat',
      message: 'Enable heartbeat monitoring?',
      default: true
    },
    {
      type: 'confirm',
      name: 'cloud_sync',
      message: 'Enable iCloud sync (works across your Macs)?',
      default: false
    }
  ]);

  config.heartbeat.enabled = featureAnswers.heartbeat;
  config.sync.enabled = featureAnswers.cloud_sync;

  // Save configuration
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(chalk.bold.green('\n✅ Setup Complete!\n'));
  console.log(chalk.cyan('You can now use OpenAce:\n'));
  console.log(chalk.white('  Terminal: ') + chalk.gray('ace chat'));
  console.log(chalk.white('  Quick ask: ') + chalk.gray('ace ask "your question"'));
  console.log(chalk.white('  Status: ') + chalk.gray('ace status'));
  console.log(chalk.white('  Skills: ') + chalk.gray('ace skills\n'));
  
  console.log(chalk.yellow('💡 Tip: Run "ace --help" to see all available commands\n'));
}

setup().catch(error => {
  console.error(chalk.red('Setup failed:'), error.message);
  process.exit(1);
});
