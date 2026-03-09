#!/usr/bin/env node
/**
 * OpenAce Update Helper
 * Quickly installs dependencies and prepares for restart
 * 
 * Usage: node scripts/update.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('\n🔄 OpenAce Update & Redeploy Helper');
  console.log('===================================\n');

  try {
    console.log('📦 Installing dependencies (npm install)...');
    const { stdout, stderr } = await execAsync('npm install');
    if (stdout) console.log(stdout.trim());
    
    console.log('\n✅ Dependencies updated.');
    console.log('✅ Code changes are ready.');
    
    console.log('\n🚀 TO RESTART:');
    console.log('1. Press Ctrl+C to stop the current process');
    console.log('2. Run your start command again (e.g., npm run dashboard)');
    
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    process.exit(1);
  }
}

main();