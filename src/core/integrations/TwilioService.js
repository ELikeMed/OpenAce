/**
 * TwilioService — Send SMS and make voice calls via Twilio API.
 * Also supports dispatching calls to BYO AI phone agents (Vapi, Bland, Retell).
 *
 * Setup: Settings → Integrations → Twilio → paste credentials
 * Saves credentials to: data/memory/credentials/twilio.json
 * BYO agent creds:      data/memory/credentials/byo-phone-agent.json
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const require = createRequire(import.meta.url);
const CREDS_FILE = path.join(process.cwd(), 'data/memory/credentials/twilio.json');
const BYO_CREDS_FILE = path.join(process.cwd(), 'data/memory/credentials/byo-phone-agent.json');

export class TwilioService {
  constructor() {
    this.client = null;
    this.accountSid = null;
    this.phoneNumber = null;
    this.byoCreds = null;
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Load saved credentials and create the Twilio client.
   * Returns true if successfully configured, false if not set up yet.
   */
  async initialize() {
    try {
      const raw = await fs.readFile(CREDS_FILE, 'utf8');
      const { accountSid, authToken, phoneNumber } = JSON.parse(raw);
      if (!accountSid || !authToken || !phoneNumber) return false;

      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken);
      this.accountSid = accountSid;
      this.phoneNumber = phoneNumber;

      // Also try loading BYO agent creds
      await this._loadByoCreds();

      return true;
    } catch (e) {
      // Also try loading BYO agent creds even if Twilio isn't configured
      await this._loadByoCreds();
      return false;
    }
  }

  isConfigured() {
    return !!this.client;
  }

  isByoConfigured() {
    return !!this.byoCreds?.apiKey;
  }

  // ═══════════════════════════════════════════════════════════
  // OUTBOUND SMS
  // ═══════════════════════════════════════════════════════════

  async sendSMS({ to, body }) {
    if (!this.client) {
      throw new Error('Twilio not configured. Set up in Settings → Integrations → Twilio.');
    }

    const message = await this.client.messages.create({
      body,
      from: this.phoneNumber,
      to,
    });

    return { success: true, messageSid: message.sid };
  }

  // ═══════════════════════════════════════════════════════════
  // OUTBOUND VOICE
  // ═══════════════════════════════════════════════════════════

  async makeCall({ to, message }) {
    if (!this.client) {
      throw new Error('Twilio not configured. Set up in Settings → Integrations → Twilio.');
    }

    // Use inline TwiML — no public URL needed
    const twiml = `<Response><Say voice="Polly.Amy">${this._escapeXml(message)}</Say></Response>`;

    const call = await this.client.calls.create({
      twiml,
      from: this.phoneNumber,
      to,
    });

    return { success: true, callSid: call.sid };
  }

  async getCallStatus(callSid) {
    if (!this.client) throw new Error('Twilio not configured.');
    const call = await this.client.calls(callSid).fetch();
    return { success: true, status: call.status, duration: call.duration };
  }

  // ═══════════════════════════════════════════════════════════
  // BYO PHONE AGENT
  // ═══════════════════════════════════════════════════════════

  async dispatchPhoneCall({ to, task }) {
    if (!this.byoCreds?.apiKey) {
      throw new Error('BYO Phone Agent not configured. Set up in Settings → Integrations → Twilio → AI Phone Agent.');
    }

    const { provider, apiKey, endpointUrl, assistantId } = this.byoCreds;
    let result;

    switch (provider) {
      case 'vapi':
        result = await axios.post('https://api.vapi.ai/call/phone', {
          assistantId: assistantId || undefined,
          customer: { number: to },
          name: `Ace call to ${to}`,
        }, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        });
        return { success: true, callId: result.data.id, provider: 'vapi' };

      case 'bland':
        result = await axios.post('https://api.bland.ai/v1/calls', {
          phone_number: to,
          task,
        }, {
          headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        });
        return { success: true, callId: result.data.call_id, provider: 'bland' };

      case 'retell':
        result = await axios.post('https://api.retellai.com/v2/create-phone-call', {
          from_number: this.phoneNumber || undefined,
          to_number: to,
          agent_id: assistantId || undefined,
        }, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        });
        return { success: true, callId: result.data.call_id, provider: 'retell' };

      default: {
        // Custom endpoint
        const url = endpointUrl || `https://api.${provider}.com/v1/calls`;
        result = await axios.post(url, {
          phone_number: to,
          task,
        }, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        });
        return { success: true, callId: result.data.call_id || result.data.id, provider };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CREDENTIAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async saveCredentials({ accountSid, authToken, phoneNumber }) {
    await fs.mkdir(path.dirname(CREDS_FILE), { recursive: true });
    await fs.writeFile(CREDS_FILE, JSON.stringify({
      accountSid,
      authToken,
      phoneNumber,
      configuredAt: new Date().toISOString(),
    }, null, 2));

    // Re-initialize with new credentials
    await this.initialize();
    return { success: true };
  }

  async testConnection() {
    if (!this.client) throw new Error('Twilio not configured.');
    const account = await this.client.api.v2010.accounts(this.accountSid).fetch();
    return { success: true, accountName: account.friendlyName, phoneNumber: this.phoneNumber };
  }

  async getCredentialStatus() {
    try {
      const raw = await fs.readFile(CREDS_FILE, 'utf8');
      const { phoneNumber } = JSON.parse(raw);
      return { configured: this.isConfigured(), phoneNumber: phoneNumber || null };
    } catch {
      return { configured: false, phoneNumber: null };
    }
  }

  async saveByoCredentials({ provider, apiKey, endpointUrl, assistantId }) {
    await fs.mkdir(path.dirname(BYO_CREDS_FILE), { recursive: true });
    const data = {
      provider,
      apiKey,
      endpointUrl: endpointUrl || '',
      assistantId: assistantId || '',
      configuredAt: new Date().toISOString(),
    };
    await fs.writeFile(BYO_CREDS_FILE, JSON.stringify(data, null, 2));
    this.byoCreds = data;
    return { success: true };
  }

  async getByoCredentialStatus() {
    return {
      configured: this.isByoConfigured(),
      provider: this.byoCreds?.provider || null,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════

  async _loadByoCreds() {
    try {
      const raw = await fs.readFile(BYO_CREDS_FILE, 'utf8');
      this.byoCreds = JSON.parse(raw);
    } catch {
      this.byoCreds = null;
    }
  }

  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
