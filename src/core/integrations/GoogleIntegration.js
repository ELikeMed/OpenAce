/**
 * Google Integration Module for OpenAce
 * 
 * Provides OAuth 2.0 authentication and access to:
 * - Google Calendar (create events, schedule meetings with Meet links)
 * - Google Drive (access SOPs, documents, resources)
 * - Gmail (send/read emails via API - instant and reliable)
 * - Google Contacts (manage contacts)
 * 
 * ONE-TIME SETUP: After initial authorization, Ace has permanent access
 * Tokens auto-refresh - no repeated logins needed
 * 
 * @module GoogleIntegration
 */

import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import url from 'url';

class GoogleIntegration {
    constructor(config = {}) {
        this.credentialsPath = config.credentialsPath || 'config/google-credentials.json';
        this.tokenPath = config.tokenPath || 'data/memory/credentials/google-tokens.json';
        this.oauth2Client = null;
        this.isAuthenticated = false;
        this.connectedAccounts = [];
        
        // API Scopes for full integration
        this.SCOPES = [
            'https://www.googleapis.com/auth/calendar',           // Full calendar access
            'https://www.googleapis.com/auth/calendar.events',    // Create/modify events
            'https://www.googleapis.com/auth/drive',              // Full Drive access
            'https://www.googleapis.com/auth/drive.file',         // Access files created by app
            'https://www.googleapis.com/auth/contacts',           // Contacts access
            'https://www.googleapis.com/auth/gmail.send',         // Send emails
            'https://www.googleapis.com/auth/gmail.readonly',     // Read emails
            'https://www.googleapis.com/auth/gmail.modify',       // Modify emails (mark read, etc.)
            'https://www.googleapis.com/auth/userinfo.email',     // Get user email
            'https://www.googleapis.com/auth/userinfo.profile',   // Get user profile
        ];

        this.REDIRECT_PORT = 3847; // Random port less likely to conflict
    }

    /**
     * Initialize the Google OAuth client - call this on startup
     * Returns true if already authenticated, false if setup needed
     */
    async initialize() {
        try {
            // Check if credentials file exists
            const credentials = await this.loadCredentials();
            if (!credentials) {
                console.log('⚠️  Google credentials not configured.');
                console.log('   Run: npm run setup-google');
                return { status: 'needs_setup', message: 'Google credentials not found' };
            }

            const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
            
            this.oauth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                `http://localhost:${this.REDIRECT_PORT}/oauth2callback`
            );

            // Try to load existing tokens
            const tokens = await this.loadTokens();
            if (tokens) {
                this.oauth2Client.setCredentials(tokens);
                this.isAuthenticated = true;
                
                // Set up automatic token refresh
                this.oauth2Client.on('tokens', async (newTokens) => {
                    console.log('🔄 Google tokens auto-refreshed');
                    const updated = { ...tokens, ...newTokens };
                    await this.saveTokens(updated);
                });
                
                // Verify tokens still work
                try {
                    const userInfo = await this.getUserInfo();
                    console.log(`✅ Google connected: ${userInfo.email}`);
                    return { 
                        status: 'connected', 
                        email: userInfo.email,
                        name: userInfo.name 
                    };
                } catch (e) {
                    console.log('⚠️  Stored tokens expired, re-authorization needed');
                    return { status: 'needs_auth', message: 'Tokens expired' };
                }
            }

            return { status: 'needs_auth', message: 'No tokens found - authorization required' };
        } catch (error) {
            console.error('Google init error:', error.message);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Load OAuth credentials from file
     */
    async loadCredentials() {
        try {
            const content = await fs.readFile(this.credentialsPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Load saved tokens
     */
    async loadTokens() {
        try {
            const content = await fs.readFile(this.tokenPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Save tokens to file (encrypted location)
     */
    async saveTokens(tokens) {
        await fs.mkdir(path.dirname(this.tokenPath), { recursive: true });
        await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
        console.log('💾 Google tokens saved');
    }

    /**
     * Start OAuth authorization flow
     * Opens browser ONCE for user to approve, then saves tokens permanently
     */
    async authorize() {
        if (!this.oauth2Client) {
            const init = await this.initialize();
            if (init.status === 'needs_setup') {
                throw new Error('Please set up Google credentials first. Run: npm run setup-google');
            }
        }

        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
            prompt: 'consent'  // Force consent to ensure we get refresh token
        });

        console.log('\n🔐 Google Authorization - ONE TIME SETUP');
        console.log('=========================================');
        console.log('\nOpening browser for authorization...');
        console.log('After you approve, Ace will have permanent access.\n');

        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const parsedUrl = url.parse(req.url, true);
                    
                    if (parsedUrl.pathname === '/oauth2callback') {
                        const code = parsedUrl.query.code;
                        const error = parsedUrl.query.error;
                        
                        if (error) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: #fff;">
                                    <h1>❌ Authorization Denied</h1>
                                    <p>Error: ${error}</p>
                                    <p>You can close this window.</p>
                                </body>
                                </html>
                            `);
                            server.close();
                            reject(new Error(`Authorization denied: ${error}`));
                            return;
                        }
                        
                        if (code) {
                            // Exchange code for tokens
                            const { tokens } = await this.oauth2Client.getToken(code);
                            this.oauth2Client.setCredentials(tokens);
                            await this.saveTokens(tokens);
                            this.isAuthenticated = true;

                            // Get user info
                            const userInfo = await this.getUserInfo();

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: #fff;">
                                    <h1 style="color: #4ade80;">✅ Successfully Connected!</h1>
                                    <p style="font-size: 1.2em;">Account: <strong>${userInfo.email}</strong></p>
                                    <p>Ace now has access to your Google Calendar, Drive, and Gmail.</p>
                                    <p style="color: #888; margin-top: 30px;">You can close this window and return to Ace.</p>
                                </body>
                                </html>
                            `);

                            server.close();
                            console.log(`\n✅ Successfully connected: ${userInfo.email}`);
                            console.log('   Ace now has permanent API access to your Google account.');
                            resolve({ 
                                status: 'connected',
                                email: userInfo.email,
                                name: userInfo.name
                            });
                        }
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`<h1>Error: ${error.message}</h1>`);
                    server.close();
                    reject(error);
                }
            });

            server.listen(this.REDIRECT_PORT, async () => {
                // Open browser
                const { default: open } = await import('open');
                await open(authUrl);
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                server.close();
                reject(new Error('Authorization timeout - please try again'));
            }, 300000);
        });
    }

    /**
     * Get authorization URL for manual flow (for dashboard)
     */
    getAuthUrl() {
        if (!this.oauth2Client) {
            throw new Error('Call initialize() first');
        }
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
            prompt: 'consent'
        });
    }

    /**
     * Handle OAuth callback code (for dashboard integration)
     */
    async handleAuthCallback(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        await this.saveTokens(tokens);
        this.isAuthenticated = true;
        return this.getUserInfo();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.isAuthenticated && this.oauth2Client !== null;
    }

    /**
     * Get authenticated user info
     */
    async getUserInfo() {
        if (!this.oauth2Client) throw new Error('Not initialized');
        
        const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data;
    }

    /**
     * Disconnect Google account
     */
    async disconnect() {
        try {
            await fs.unlink(this.tokenPath);
            this.isAuthenticated = false;
            this.oauth2Client = null;
            console.log('🔌 Google account disconnected');
            return true;
        } catch (e) {
            return false;
        }
    }

    // ==========================================
    // CALENDAR METHODS
    // ==========================================

    getCalendar() {
        if (!this.isConnected()) throw new Error('Google not connected');
        return google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    /**
     * List upcoming events
     */
    async listEvents(options = {}) {
        const calendar = this.getCalendar();
        const {
            maxResults = 10,
            timeMin = new Date().toISOString(),
            calendarId = 'primary'
        } = options;

        const response = await calendar.events.list({
            calendarId,
            timeMin,
            maxResults,
            singleEvents: true,
            orderBy: 'startTime'
        });

        return response.data.items || [];
    }

    /**
     * Create a calendar event
     * @param {Object} eventData - Event details
     * @param {string} eventData.title - Event title
     * @param {string} eventData.startTime - ISO datetime or "2024-02-15 10:00 AM"
     * @param {string} eventData.endTime - ISO datetime or "2024-02-15 11:00 AM"  
     * @param {string} eventData.description - Event description
     * @param {string[]} eventData.attendees - Email addresses to invite
     * @param {boolean} eventData.addMeetLink - Add Google Meet link
     * @param {boolean} eventData.sendInvites - Send email invites to attendees
     */
    async createEvent(eventData) {
        const calendar = this.getCalendar();
        
        // Parse times if needed
        const startTime = this.parseDateTime(eventData.startTime);
        const endTime = this.parseDateTime(eventData.endTime);

        const event = {
            summary: eventData.title,
            description: eventData.description || '',
            start: {
                dateTime: startTime,
                timeZone: eventData.timeZone || 'America/New_York'
            },
            end: {
                dateTime: endTime,
                timeZone: eventData.timeZone || 'America/New_York'
            },
            attendees: (eventData.attendees || []).map(email => ({ email })),
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 }
                ]
            }
        };

        // Add Google Meet link
        if (eventData.addMeetLink !== false) {  // Default to adding Meet link
            event.conferenceData = {
                createRequest: {
                    requestId: `ace-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            };
        }

        const response = await calendar.events.insert({
            calendarId: eventData.calendarId || 'primary',
            resource: event,
            conferenceDataVersion: eventData.addMeetLink !== false ? 1 : 0,
            sendUpdates: eventData.sendInvites ? 'all' : 'none'
        });

        const result = {
            success: true,
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            meetLink: response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri,
            start: response.data.start,
            end: response.data.end
        };

        console.log(`📅 Event created: ${eventData.title}`);
        if (result.meetLink) {
            console.log(`   Meet link: ${result.meetLink}`);
        }

        return result;
    }

    /**
     * Quick helper to schedule a meeting
     */
    async scheduleMeeting(title, startTime, durationMinutes = 60, attendees = []) {
        const start = this.parseDateTime(startTime);
        const end = new Date(new Date(start).getTime() + durationMinutes * 60000).toISOString();

        return this.createEvent({
            title,
            startTime: start,
            endTime: end,
            attendees,
            addMeetLink: true,
            sendInvites: true
        });
    }

    /**
     * Parse flexible datetime strings
     */
    parseDateTime(input) {
        if (!input) return new Date().toISOString();

        // Already ISO format
        if (input.includes('T') || input.includes('Z')) {
            const d = new Date(input);
            if (!isNaN(d)) return d.toISOString();
        }

        // Try to parse standard date formats (e.g., "2026-03-15 10:00 AM", "March 15, 2026 3:20pm")
        const parsed = new Date(input);
        if (!isNaN(parsed) && parsed.getFullYear() > 2020) {
            return parsed.toISOString();
        }

        // Handle relative natural language as a safety net
        const lower = input.toLowerCase().trim();
        const now = new Date();

        // "tomorrow at 2pm", "tomorrow at 14:00"
        const tomorrowMatch = lower.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (tomorrowMatch) {
            const d = new Date(now);
            d.setDate(d.getDate() + 1);
            let hour = parseInt(tomorrowMatch[1]);
            const min = parseInt(tomorrowMatch[2] || '0');
            const ampm = (tomorrowMatch[3] || '').toLowerCase();
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            d.setHours(hour, min, 0, 0);
            return d.toISOString();
        }

        // "today at 3pm"
        const todayMatch = lower.match(/today\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (todayMatch) {
            const d = new Date(now);
            let hour = parseInt(todayMatch[1]);
            const min = parseInt(todayMatch[2] || '0');
            const ampm = (todayMatch[3] || '').toLowerCase();
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            d.setHours(hour, min, 0, 0);
            return d.toISOString();
        }

        // "this friday at 3:20pm", "next monday at 10am"
        const dayNames = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
        const dayMatch = lower.match(/(?:this|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (dayMatch) {
            const targetDay = dayNames[dayMatch[1].toLowerCase()];
            const d = new Date(now);
            let daysUntil = targetDay - d.getDay();
            if (daysUntil <= 0) daysUntil += 7; // Next occurrence
            if (lower.startsWith('next') && daysUntil <= 7) daysUntil += 7; // "next" means the week after
            d.setDate(d.getDate() + daysUntil);
            let hour = parseInt(dayMatch[2]);
            const min = parseInt(dayMatch[3] || '0');
            const ampm = (dayMatch[4] || '').toLowerCase();
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            d.setHours(hour, min, 0, 0);
            return d.toISOString();
        }

        // Last resort: log warning and return current time (caller should notice)
        console.warn(`[GoogleIntegration] Could not parse datetime: "${input}" — falling back to now`);
        return new Date().toISOString();
    }

    /**
     * Update an event
     */
    async updateEvent(eventId, updates, calendarId = 'primary') {
        const calendar = this.getCalendar();
        const existing = await calendar.events.get({ calendarId, eventId });
        
        const updated = { ...existing.data };
        if (updates.title) updated.summary = updates.title;
        if (updates.description) updated.description = updates.description;
        if (updates.startTime) {
            updated.start = { dateTime: this.parseDateTime(updates.startTime), timeZone: 'America/New_York' };
        }
        if (updates.endTime) {
            updated.end = { dateTime: this.parseDateTime(updates.endTime), timeZone: 'America/New_York' };
        }

        const response = await calendar.events.update({
            calendarId,
            eventId,
            resource: updated,
            sendUpdates: 'all'
        });

        return response.data;
    }

    /**
     * Delete an event
     */
    async deleteEvent(eventId, calendarId = 'primary') {
        const calendar = this.getCalendar();
        await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' });
        return { success: true, deleted: eventId };
    }

    /**
     * Find free time slots
     */
    async findFreeTime(options = {}) {
        const calendar = this.getCalendar();
        const {
            startTime = new Date().toISOString(),
            endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        } = options;

        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: startTime,
                timeMax: endTime,
                items: [{ id: 'primary' }]
            }
        });

        return response.data.calendars;
    }

    /**
     * List all calendars
     */
    async listCalendars() {
        const calendar = this.getCalendar();
        const response = await calendar.calendarList.list();
        return response.data.items || [];
    }

    // ==========================================
    // GOOGLE DRIVE METHODS
    // ==========================================

    getDrive() {
        if (!this.isConnected()) throw new Error('Google not connected');
        return google.drive({ version: 'v3', auth: this.oauth2Client });
    }

    /**
     * List files in Drive
     */
    async listFiles(options = {}) {
        const drive = this.getDrive();
        const { folderId, pageSize = 20, query, fileType } = options;

        let q = "trashed = false";
        if (folderId) q += ` and '${folderId}' in parents`;
        if (query) q += ` and name contains '${query}'`;
        if (fileType === 'folder') q += ` and mimeType = 'application/vnd.google-apps.folder'`;
        if (fileType === 'doc') q += ` and mimeType = 'application/vnd.google-apps.document'`;
        if (fileType === 'sheet') q += ` and mimeType = 'application/vnd.google-apps.spreadsheet'`;

        const response = await drive.files.list({
            pageSize,
            q,
            fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size, parents)'
        });

        return response.data.files || [];
    }

    /**
     * Search files
     */
    async searchFiles(searchQuery) {
        return this.listFiles({ query: searchQuery });
    }

    /**
     * Get file content (for Google Docs)
     */
    async getDocContent(fileId) {
        const drive = this.getDrive();
        const response = await drive.files.export({
            fileId,
            mimeType: 'text/plain'
        });
        return response.data;
    }

    /**
     * Read a Google Sheet
     */
    async readSheet(spreadsheetId, range = 'Sheet1') {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        return response.data.values || [];
    }

    /**
     * Write to a Google Sheet
     */
    async writeSheet(spreadsheetId, range, values) {
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });
        return response.data;
    }

    /**
     * Create a folder
     */
    async createFolder(name, parentId = null) {
        const drive = this.getDrive();
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) fileMetadata.parents = [parentId];

        const response = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, webViewLink'
        });
        return response.data;
    }

    /**
     * Upload a file to Drive
     */
    async uploadFile(localPath, options = {}) {
        const drive = this.getDrive();
        const { folderId, name } = options;
        const content = await fs.readFile(localPath);

        const fileMetadata = { name: name || path.basename(localPath) };
        if (folderId) fileMetadata.parents = [folderId];

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: { body: content },
            fields: 'id, name, webViewLink'
        });

        console.log(`📤 Uploaded to Drive: ${response.data.name}`);
        return response.data;
    }

    /**
     * Download a file from Drive
     */
    async downloadFile(fileId, destPath) {
        const drive = this.getDrive();
        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        await fs.writeFile(destPath, Buffer.from(response.data));
        console.log(`📥 Downloaded: ${destPath}`);
        return destPath;
    }

    /**
     * Get or create "Ace" folder for SOPs
     */
    async getAceFolder() {
        const existing = await this.listFiles({ query: 'Ace SOPs', fileType: 'folder' });
        if (existing.length > 0) return existing[0];
        return this.createFolder('Ace SOPs');
    }

    // ==========================================
    // GMAIL METHODS
    // ==========================================

    getGmail() {
        if (!this.isConnected()) throw new Error('Google not connected');
        return google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Send an email
     */
    async sendEmail({ to, subject, body, isHtml = true }) {
        const gmail = this.getGmail();
        
        // Format body for HTML - convert newlines to proper HTML
        let formattedBody = body;
        if (isHtml) {
            // Convert newlines to <br> tags and wrap in basic HTML
            const htmlBody = body
                .replace(/\n\n/g, '</p><p>')  // Double newlines become paragraphs
                .replace(/\n/g, '<br>')        // Single newlines become line breaks
                .trim();
            
            formattedBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; }
        p { margin: 0 0 16px 0; }
    </style>
</head>
<body>
    <p>${htmlBody}</p>
</body>
</html>`;
        }
        
        const message = [
            `To: ${Array.isArray(to) ? to.join(', ') : to}`,
            `Subject: ${subject}`,
            `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
            '',
            formattedBody
        ].join('\n');

        const encoded = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encoded }
        });

        console.log(`📧 Email sent to: ${to}`);
        return { success: true, messageId: response.data.id };
    }

    /**
     * List recent emails
     */
    async listEmails(options = {}) {
        const gmail = this.getGmail();
        const { maxResults = 10, query = '', labelIds = ['INBOX'] } = options;

        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults,
            q: query,
            labelIds
        });

        const messages = response.data.messages || [];
        
        // Get full message details
        const detailed = await Promise.all(
            messages.slice(0, 5).map(async (msg) => {
                const full = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });
                const headers = full.data.payload.headers;
                return {
                    id: msg.id,
                    from: headers.find(h => h.name === 'From')?.value,
                    subject: headers.find(h => h.name === 'Subject')?.value,
                    date: headers.find(h => h.name === 'Date')?.value,
                    snippet: full.data.snippet
                };
            })
        );

        return detailed;
    }

    /**
     * Get full email content
     */
    async getEmail(messageId) {
        const gmail = this.getGmail();
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });
        return response.data;
    }

    /**
     * Mark email as read
     */
    async markAsRead(messageId) {
        const gmail = this.getGmail();
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: { removeLabelIds: ['UNREAD'] }
        });
        return { success: true };
    }

    // ==========================================
    // CONTACTS METHODS
    // ==========================================

    getPeople() {
        if (!this.isConnected()) throw new Error('Google not connected');
        return google.people({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * List contacts
     */
    async listContacts(pageSize = 50) {
        const people = this.getPeople();
        const response = await people.people.connections.list({
            resourceName: 'people/me',
            pageSize,
            personFields: 'names,emailAddresses,phoneNumbers,organizations'
        });
        return response.data.connections || [];
    }

    /**
     * Search contacts
     */
    async searchContacts(query) {
        const people = this.getPeople();
        const response = await people.people.searchContacts({
            query,
            readMask: 'names,emailAddresses,phoneNumbers,organizations'
        });
        return response.data.results || [];
    }

    /**
     * Create a contact
     */
    async createContact({ firstName, lastName, email, phone, company, title }) {
        const people = this.getPeople();
        const response = await people.people.createContact({
            requestBody: {
                names: [{ givenName: firstName, familyName: lastName }],
                emailAddresses: email ? [{ value: email }] : [],
                phoneNumbers: phone ? [{ value: phone }] : [],
                organizations: company ? [{ name: company, title }] : []
            }
        });
        console.log(`👤 Contact created: ${firstName} ${lastName}`);
        return response.data;
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Get connection status summary
     */
    async getStatus() {
        if (!this.isConnected()) {
            return { connected: false, message: 'Not connected to Google' };
        }

        try {
            const user = await this.getUserInfo();
            return {
                connected: true,
                email: user.email,
                name: user.name,
                picture: user.picture
            };
        } catch (e) {
            return { connected: false, message: 'Token expired' };
        }
    }
}

export default GoogleIntegration;
export { GoogleIntegration };
