/**
 * Integrations Index
 * 
 * Central export for all external service integrations
 */

import { GoogleIntegration } from './GoogleIntegration.js';
import { ZoomIntegration } from './ZoomIntegration.js';

/**
 * Integration Manager - handles all external service connections
 */
class IntegrationManager {
    constructor() {
        this.google = new GoogleIntegration();
        this.zoom = new ZoomIntegration();
        this.initialized = false;
    }

    /**
     * Initialize all integrations
     */
    async initialize() {
        console.log('\n🔌 Initializing integrations...');
        
        const status = {
            google: await this.google.initialize(),
            zoom: await this.zoom.initialize()
        };

        this.initialized = true;
        return status;
    }

    /**
     * Get status of all integrations
     */
    async getStatus() {
        return {
            google: await this.google.getStatus(),
            zoom: await this.zoom.getStatus()
        };
    }

    /**
     * Create a meeting (uses configured default provider)
     * @param {string} provider - 'google' or 'zoom' (optional, uses default)
     */
    async createMeeting(meetingData, provider = null) {
        // Determine which provider to use
        const useProvider = provider || this.getDefaultMeetingProvider();

        if (useProvider === 'zoom' && this.zoom.isConnected()) {
            return this.zoom.createMeeting(meetingData);
        } else if (this.google.isConnected()) {
            return this.google.createEvent({
                ...meetingData,
                title: meetingData.topic || meetingData.title,
                addMeetLink: true
            });
        } else {
            throw new Error('No meeting provider connected. Run npm run setup-google or npm run setup-zoom');
        }
    }

    /**
     * Schedule a meeting with smart defaults
     */
    async scheduleMeeting(title, startTime, duration = 60, attendees = [], provider = null) {
        const useProvider = provider || this.getDefaultMeetingProvider();

        if (useProvider === 'zoom' && this.zoom.isConnected()) {
            const meeting = await this.zoom.scheduleMeeting(title, startTime, duration);
            // If Google is also connected, create calendar event with Zoom link
            if (this.google.isConnected() && attendees.length > 0) {
                await this.google.createEvent({
                    title,
                    startTime,
                    endTime: this.addMinutes(startTime, duration),
                    attendees,
                    description: `Zoom Meeting Link: ${meeting.joinUrl}`,
                    addMeetLink: false,
                    sendInvites: true
                });
            }
            return meeting;
        } else if (this.google.isConnected()) {
            return this.google.scheduleMeeting(title, startTime, duration, attendees);
        } else {
            throw new Error('No meeting provider connected');
        }
    }

    addMinutes(dateStr, minutes) {
        const date = new Date(dateStr);
        return new Date(date.getTime() + minutes * 60000).toISOString();
    }

    getDefaultMeetingProvider() {
        // Could be configured in openace.config.json
        // For now, prefer Google Meet if connected, else Zoom
        if (this.google.isConnected()) return 'google';
        if (this.zoom.isConnected()) return 'zoom';
        return null;
    }

    /**
     * Send an email (requires Google)
     */
    async sendEmail(emailData) {
        if (!this.google.isConnected()) {
            throw new Error('Google not connected. Run npm run setup-google');
        }
        return this.google.sendEmail(emailData);
    }

    /**
     * Access Drive (requires Google)
     */
    async searchDrive(query) {
        if (!this.google.isConnected()) {
            throw new Error('Google not connected');
        }
        return this.google.searchFiles(query);
    }

    /**
     * List calendar events (uses Google)
     */
    async listEvents(options = {}) {
        if (!this.google.isConnected()) {
            throw new Error('Google not connected');
        }
        return this.google.listEvents(options);
    }
}

// Singleton instance
const integrations = new IntegrationManager();

export {
    GoogleIntegration,
    ZoomIntegration,
    IntegrationManager,
    integrations
};

export default integrations;
