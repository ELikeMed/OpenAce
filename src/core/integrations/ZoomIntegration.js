/**
 * Zoom Integration Module for OpenAce
 * 
 * Provides OAuth 2.0 authentication and access to:
 * - Create Zoom meetings with links
 * - Schedule meetings
 * - List upcoming meetings
 * - Get meeting recordings
 * 
 * ONE-TIME SETUP: After initial authorization, Ace has permanent access
 * 
 * @module ZoomIntegration
 */

import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import url from 'url';
import axios from 'axios';

class ZoomIntegration {
    constructor(config = {}) {
        this.credentialsPath = config.credentialsPath || 'config/zoom-credentials.json';
        this.tokenPath = config.tokenPath || 'data/memory/credentials/zoom-tokens.json';
        this.isAuthenticated = false;
        this.credentials = null;
        this.tokens = null;
        
        this.REDIRECT_PORT = 3848;
        this.BASE_URL = 'https://api.zoom.us/v2';
        this.AUTH_URL = 'https://zoom.us/oauth/authorize';
        this.TOKEN_URL = 'https://zoom.us/oauth/token';
        
        // Scopes needed
        this.SCOPES = [
            'meeting:write:admin',
            'meeting:read:admin',
            'user:read:admin',
            'recording:read:admin'
        ];
    }

    /**
     * Initialize Zoom client
     */
    async initialize() {
        try {
            this.credentials = await this.loadCredentials();
            if (!this.credentials) {
                console.log('⚠️  Zoom credentials not configured.');
                console.log('   Run: npm run setup-zoom');
                return { status: 'needs_setup', message: 'Zoom credentials not found' };
            }

            this.tokens = await this.loadTokens();
            if (this.tokens) {
                // Check if token is still valid
                if (this.isTokenExpired()) {
                    await this.refreshToken();
                }
                
                this.isAuthenticated = true;
                
                try {
                    const user = await this.getCurrentUser();
                    console.log(`✅ Zoom connected: ${user.email}`);
                    return { 
                        status: 'connected', 
                        email: user.email,
                        name: `${user.first_name} ${user.last_name}`
                    };
                } catch (e) {
                    return { status: 'needs_auth', message: 'Tokens expired' };
                }
            }

            return { status: 'needs_auth', message: 'No tokens found' };
        } catch (error) {
            console.error('Zoom init error:', error.message);
            return { status: 'error', message: error.message };
        }
    }

    async loadCredentials() {
        try {
            const content = await fs.readFile(this.credentialsPath, 'utf8');
            return JSON.parse(content);
        } catch { return null; }
    }

    async loadTokens() {
        try {
            const content = await fs.readFile(this.tokenPath, 'utf8');
            return JSON.parse(content);
        } catch { return null; }
    }

    async saveTokens(tokens) {
        await fs.mkdir(path.dirname(this.tokenPath), { recursive: true });
        await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
    }

    isTokenExpired() {
        if (!this.tokens || !this.tokens.expires_at) return true;
        return Date.now() >= this.tokens.expires_at - 60000; // 1 min buffer
    }

    async refreshToken() {
        if (!this.tokens?.refresh_token) {
            throw new Error('No refresh token available');
        }

        const auth = Buffer.from(
            `${this.credentials.client_id}:${this.credentials.client_secret}`
        ).toString('base64');

        const response = await axios.post(this.TOKEN_URL, null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: this.tokens.refresh_token
            },
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        this.tokens = {
            ...response.data,
            expires_at: Date.now() + (response.data.expires_in * 1000)
        };
        await this.saveTokens(this.tokens);
        console.log('🔄 Zoom tokens refreshed');
    }

    /**
     * Start OAuth authorization flow
     */
    async authorize() {
        if (!this.credentials) {
            const init = await this.initialize();
            if (init.status === 'needs_setup') {
                throw new Error('Please set up Zoom credentials first. Run: npm run setup-zoom');
            }
        }

        const redirectUri = `http://localhost:${this.REDIRECT_PORT}/oauth2callback`;
        const authUrl = `${this.AUTH_URL}?response_type=code&client_id=${this.credentials.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        console.log('\n🔐 Zoom Authorization - ONE TIME SETUP');
        console.log('======================================');
        console.log('\nOpening browser for authorization...\n');

        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const parsedUrl = url.parse(req.url, true);
                    
                    if (parsedUrl.pathname === '/oauth2callback') {
                        const code = parsedUrl.query.code;
                        const error = parsedUrl.query.error;
                        
                        if (error) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(`<h1>Error: ${error}</h1>`);
                            server.close();
                            reject(new Error(error));
                            return;
                        }
                        
                        if (code) {
                            // Exchange code for tokens
                            const auth = Buffer.from(
                                `${this.credentials.client_id}:${this.credentials.client_secret}`
                            ).toString('base64');

                            const tokenResponse = await axios.post(this.TOKEN_URL, null, {
                                params: {
                                    grant_type: 'authorization_code',
                                    code,
                                    redirect_uri: redirectUri
                                },
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            });

                            this.tokens = {
                                ...tokenResponse.data,
                                expires_at: Date.now() + (tokenResponse.data.expires_in * 1000)
                            };
                            await this.saveTokens(this.tokens);
                            this.isAuthenticated = true;

                            const user = await this.getCurrentUser();

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: #fff;">
                                    <h1 style="color: #4ade80;">✅ Zoom Connected!</h1>
                                    <p>Account: <strong>${user.email}</strong></p>
                                    <p>You can close this window.</p>
                                </body>
                                </html>
                            `);

                            server.close();
                            console.log(`\n✅ Zoom connected: ${user.email}`);
                            resolve({ status: 'connected', email: user.email });
                        }
                    }
                } catch (error) {
                    res.writeHead(500);
                    res.end(`Error: ${error.message}`);
                    server.close();
                    reject(error);
                }
            });

            server.listen(this.REDIRECT_PORT, async () => {
                const { default: open } = await import('open');
                await open(authUrl);
            });

            setTimeout(() => {
                server.close();
                reject(new Error('Authorization timeout'));
            }, 300000);
        });
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(method, endpoint, data = null) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Zoom');
        }

        if (this.isTokenExpired()) {
            await this.refreshToken();
        }

        const response = await axios({
            method,
            url: `${this.BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.tokens.access_token}`,
                'Content-Type': 'application/json'
            },
            data
        });

        return response.data;
    }

    isConnected() {
        return this.isAuthenticated;
    }

    // ==========================================
    // USER METHODS
    // ==========================================

    async getCurrentUser() {
        return this.apiRequest('GET', '/users/me');
    }

    // ==========================================
    // MEETING METHODS
    // ==========================================

    /**
     * Create a Zoom meeting
     */
    async createMeeting(meetingData) {
        const {
            topic,
            startTime,
            duration = 60,
            agenda = '',
            password,
            attendees = []
        } = meetingData;

        const meeting = {
            topic,
            type: startTime ? 2 : 1, // 2 = scheduled, 1 = instant
            start_time: startTime ? new Date(startTime).toISOString() : undefined,
            duration,
            timezone: meetingData.timezone || 'America/New_York',
            agenda,
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: false,
                waiting_room: false,
                meeting_authentication: false
            }
        };

        if (password) {
            meeting.password = password;
        }

        const response = await this.apiRequest('POST', '/users/me/meetings', meeting);

        console.log(`🎥 Zoom meeting created: ${topic}`);
        console.log(`   Join URL: ${response.join_url}`);

        return {
            success: true,
            meetingId: response.id,
            topic: response.topic,
            joinUrl: response.join_url,
            startUrl: response.start_url,
            password: response.password,
            startTime: response.start_time,
            duration: response.duration
        };
    }

    /**
     * Quick helper to schedule a meeting
     */
    async scheduleMeeting(topic, startTime, durationMinutes = 60) {
        return this.createMeeting({
            topic,
            startTime,
            duration: durationMinutes
        });
    }

    /**
     * Create an instant meeting
     */
    async createInstantMeeting(topic = 'Instant Meeting') {
        return this.createMeeting({ topic });
    }

    /**
     * List upcoming meetings
     */
    async listMeetings(type = 'upcoming') {
        const response = await this.apiRequest('GET', `/users/me/meetings?type=${type}`);
        return response.meetings || [];
    }

    /**
     * Get meeting details
     */
    async getMeeting(meetingId) {
        return this.apiRequest('GET', `/meetings/${meetingId}`);
    }

    /**
     * Update a meeting
     */
    async updateMeeting(meetingId, updates) {
        return this.apiRequest('PATCH', `/meetings/${meetingId}`, updates);
    }

    /**
     * Delete a meeting
     */
    async deleteMeeting(meetingId) {
        await this.apiRequest('DELETE', `/meetings/${meetingId}`);
        return { success: true, deleted: meetingId };
    }

    // ==========================================
    // RECORDINGS METHODS
    // ==========================================

    /**
     * List cloud recordings
     */
    async listRecordings(from, to) {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        
        const response = await this.apiRequest('GET', `/users/me/recordings?${params}`);
        return response.meetings || [];
    }

    /**
     * Get recording details
     */
    async getRecording(meetingId) {
        return this.apiRequest('GET', `/meetings/${meetingId}/recordings`);
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    async getStatus() {
        if (!this.isConnected()) {
            return { connected: false, message: 'Not connected to Zoom' };
        }

        try {
            const user = await this.getCurrentUser();
            return {
                connected: true,
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                accountId: user.account_id
            };
        } catch (e) {
            return { connected: false, message: 'Token expired' };
        }
    }

    async disconnect() {
        try {
            await fs.unlink(this.tokenPath);
            this.isAuthenticated = false;
            this.tokens = null;
            console.log('🔌 Zoom disconnected');
            return true;
        } catch { return false; }
    }
}

export default ZoomIntegration;
export { ZoomIntegration };
