#!/usr/bin/env node
/**
 * Google Setup Script for OpenAce
 * 
 * This script guides you through connecting your Google account(s) to Ace.
 * ONE-TIME SETUP - After this, Ace has permanent API access.
 * 
 * Run with: npm run setup-google
 */

import { GoogleIntegration } from '../src/core/integrations/GoogleIntegration.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

let rl = null;

function getReadline() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    return rl;
}

const ask = (question) => new Promise(resolve => {
    getReadline().question(question, resolve);
});

function closeReadline() {
    if (rl) {
        rl.close();
        rl = null;
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          🔐 GOOGLE INTEGRATION SETUP FOR ACE               ║');
    console.log('║                                                            ║');
    console.log('║  This is a ONE-TIME setup. After completing this,          ║');
    console.log('║  Ace will have permanent access to your Google services:   ║');
    console.log('║  • Calendar (create events, schedule meetings)             ║');
    console.log('║  • Google Meet (auto-generate meeting links)               ║');
    console.log('║  • Google Drive (access SOPs, documents)                   ║');
    console.log('║  • Gmail (send/read emails via API)                        ║');
    console.log('║  • Contacts (manage your contacts)                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Check for existing credentials
    const credentialsPath = 'config/google-credentials.json';
    let hasCredentials = false;
    
    try {
        await fs.access(credentialsPath);
        hasCredentials = true;
        console.log('✅ Google credentials file found!\n');
    } catch {
        console.log('⚠️  No credentials file found at: config/google-credentials.json\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 STEP 1: Create Google Cloud OAuth Credentials');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('1. Go to: https://console.cloud.google.com/');
        console.log('2. Create a new project (or select existing one)');
        console.log('3. Go to "APIs & Services" → "Credentials"');
        console.log('4. Click "Create Credentials" → "OAuth client ID"');
        console.log('5. Select "Desktop app" as application type');
        console.log('6. Download the JSON file');
        console.log('7. Save it as: config/google-credentials.json\n');
        console.log('📌 IMPORTANT: Enable these APIs in your project:');
        console.log('   • Google Calendar API');
        console.log('   • Google Drive API');
        console.log('   • Gmail API');
        console.log('   • People API (for contacts)\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Check if running interactively
        if (process.stdin.isTTY) {
            const answer = await ask('Press Enter after you\'ve saved the credentials file (or "q" to quit): ');
            if (answer.toLowerCase() === 'q') {
                console.log('\nSetup cancelled. Run again when ready.\n');
                closeReadline();
                process.exit(0);
            }
        } else {
            console.log('\n❌ Non-interactive mode: Please save credentials file first and re-run.');
            process.exit(1);
        }

        // Check again
        try {
            await fs.access(credentialsPath);
            hasCredentials = true;
            console.log('\n✅ Credentials file found!\n');
        } catch {
            console.log('\n❌ Still no credentials file found.');
            console.log('Please save your OAuth credentials to: config/google-credentials.json');
            console.log('Then run this setup again.\n');
            closeReadline();
            process.exit(1);
        }
    }

    // Initialize and authorize
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Authorize Ace to Access Your Google Account');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const google = new GoogleIntegration();
    const status = await google.initialize();

    if (status.status === 'connected') {
        console.log(`\n✅ Already connected to: ${status.email}`);
        if (process.stdin.isTTY) {
            const reauth = await ask('\nWould you like to connect a different account? (y/N): ');
            
            if (reauth.toLowerCase() !== 'y') {
                console.log('\n✅ Setup complete! Ace is connected to Google.\n');
                await showQuickTest(google);
                closeReadline();
                process.exit(0);
            }
        } else {
            console.log('\n✅ Setup complete! Ace is connected to Google.\n');
            await showQuickTest(google);
            process.exit(0);
        }
    }

    console.log('A browser window will open for you to sign in to Google.\n');
    console.log('Select your Google account and approve the requested permissions.');
    console.log('This only needs to be done ONCE.\n');

    if (process.stdin.isTTY) {
        await ask('Press Enter to open browser and authorize... ');
    }

    try {
        const result = await google.authorize();
        console.log('\n✅ Successfully authorized!');
        console.log(`   Connected account: ${result.email}\n`);

        await showQuickTest(google);

    } catch (error) {
        console.error('\n❌ Authorization failed:', error.message);
        console.log('\nPlease try again. Make sure you approve all requested permissions.\n');
    }

    closeReadline();
}

async function showQuickTest(google) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SETUP COMPLETE - Quick Connection Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Test Calendar
        console.log('📅 Testing Calendar access...');
        const events = await google.listEvents({ maxResults: 3 });
        console.log(`   ✅ Found ${events.length} upcoming events`);
        if (events.length > 0) {
            console.log(`   Next: "${events[0].summary}" on ${events[0].start?.dateTime || events[0].start?.date}`);
        }

        // Test Drive
        console.log('\n📁 Testing Drive access...');
        const files = await google.listFiles({ pageSize: 3 });
        console.log(`   ✅ Can access Drive (${files.length} recent files)`);

        // Test Gmail
        console.log('\n📧 Testing Gmail access...');
        const emails = await google.listEmails({ maxResults: 3 });
        console.log(`   ✅ Can access Gmail (${emails.length} recent emails)`);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 ALL TESTS PASSED! Ace can now:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('   • Create calendar events with Google Meet links');
        console.log('   • Read and search your Google Drive');
        console.log('   • Send and read emails');
        console.log('   • Access your contacts\n');
        console.log('No more browser automation needed for Google tasks!');
        console.log('(Though Ace can still use browser as a backup method)\n');

    } catch (error) {
        console.log(`\n⚠️  Some tests failed: ${error.message}`);
        console.log('Make sure all required APIs are enabled in Google Cloud Console.\n');
    }
}

main().catch(console.error);
