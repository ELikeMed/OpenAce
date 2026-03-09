#!/usr/bin/env node
/**
 * Zoom Setup Script for OpenAce
 * 
 * This script guides you through connecting your Zoom account to Ace.
 * ONE-TIME SETUP - After this, Ace can create Zoom meetings automatically.
 * 
 * Run with: npm run setup-zoom
 */

import { ZoomIntegration } from '../src/core/integrations/ZoomIntegration.js';
import fs from 'fs/promises';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          🎥 ZOOM INTEGRATION SETUP FOR ACE                 ║');
    console.log('║                                                            ║');
    console.log('║  This is a ONE-TIME setup. After completing this,          ║');
    console.log('║  Ace will be able to:                                      ║');
    console.log('║  • Create Zoom meetings with links                         ║');
    console.log('║  • Schedule future meetings                                ║');
    console.log('║  • Access meeting recordings                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Check for existing credentials
    const credentialsPath = 'config/zoom-credentials.json';
    let hasCredentials = false;
    
    try {
        await fs.access(credentialsPath);
        hasCredentials = true;
        console.log('✅ Zoom credentials file found!\n');
    } catch {
        console.log('⚠️  No credentials file found.\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 STEP 1: Create Zoom OAuth App');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('1. Go to: https://marketplace.zoom.us/develop/create');
        console.log('2. Click "Build App" and select "General App"');
        console.log('3. Fill in app name: "Ace Assistant"');
        console.log('4. Set Redirect URL to: http://localhost:3848/oauth2callback');
        console.log('5. Add scopes: meeting:write:admin, meeting:read:admin');
        console.log('6. Copy your Client ID and Client Secret\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const clientId = await ask('Enter your Zoom Client ID: ');
        const clientSecret = await ask('Enter your Zoom Client Secret: ');

        if (!clientId || !clientSecret) {
            console.log('\n❌ Client ID and Secret are required.');
            rl.close();
            process.exit(1);
        }

        // Save credentials
        const credentials = {
            client_id: clientId.trim(),
            client_secret: clientSecret.trim()
        };

        await fs.mkdir('config', { recursive: true });
        await fs.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
        console.log('\n✅ Credentials saved!\n');
        hasCredentials = true;
    }

    // Initialize and authorize
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Authorize Ace to Access Your Zoom Account');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const zoom = new ZoomIntegration();
    const status = await zoom.initialize();

    if (status.status === 'connected') {
        console.log(`\n✅ Already connected to: ${status.email}`);
        const reauth = await ask('\nWould you like to reconnect? (y/N): ');
        
        if (reauth.toLowerCase() !== 'y') {
            console.log('\n✅ Setup complete! Ace is connected to Zoom.\n');
            await showQuickTest(zoom);
            rl.close();
            process.exit(0);
        }
    }

    console.log('A browser window will open for you to sign in to Zoom.\n');
    await ask('Press Enter to open browser and authorize... ');

    try {
        const result = await zoom.authorize();
        console.log('\n✅ Successfully authorized!');
        console.log(`   Connected account: ${result.email}\n`);

        await showQuickTest(zoom);

    } catch (error) {
        console.error('\n❌ Authorization failed:', error.message);
        console.log('\nPlease try again.\n');
    }

    rl.close();
}

async function showQuickTest(zoom) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SETUP COMPLETE - Quick Connection Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const user = await zoom.getCurrentUser();
        console.log(`👤 Connected as: ${user.first_name} ${user.last_name} (${user.email})`);

        const meetings = await zoom.listMeetings();
        console.log(`📅 Upcoming meetings: ${meetings.length}`);

        console.log('\n🎉 Ace can now create Zoom meetings automatically!');
        console.log('\nExample usage:');
        console.log('  "Create a Zoom meeting for tomorrow at 3pm"');
        console.log('  "Schedule a Zoom call with the team for Friday"');

    } catch (error) {
        console.log(`\n⚠️  Test failed: ${error.message}`);
    }
}

main().catch(console.error);
