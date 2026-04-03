/**
 * GmailSMTPService — Send emails via Gmail App Password + SMTP
 *
 * No OAuth, no browser automation. Just nodemailer + a 16-character
 * App Password from Google Account Settings.
 *
 * One-time setup: npm run setup-gmail
 * Saves credentials to: data/memory/credentials/gmail-smtp.json
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';

const require = createRequire(import.meta.url);
const CREDS_FILE = path.join(process.cwd(), 'data/memory/credentials/gmail-smtp.json');

export class GmailSMTPService {
  constructor() {
    this.transporter = null;
    this.fromEmail = null;
    this.fromName = null;
  }

  /**
   * Load saved credentials and create the nodemailer transporter.
   * Returns true if successfully configured, false if not set up yet.
   */
  async initialize() {
    try {
      const raw = await fs.readFile(CREDS_FILE, 'utf8');
      const { email, appPassword, displayName } = JSON.parse(raw);
      if (!email || !appPassword) return false;

      const nodemailer = require('nodemailer');
      this.fromEmail = email;
      this.fromName = displayName || email;
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: email, pass: appPassword },
      });

      return true;
    } catch (e) {
      return false; // Not configured yet
    }
  }

  isConfigured() {
    return !!this.transporter;
  }

  /**
   * Send an email.
   * @param {string} to       - Recipient email address
   * @param {string} subject  - Subject line
   * @param {string} body     - Plain-text body (newlines preserved)
   */
  async sendEmail({ to, subject, body, html }) {
    if (!this.transporter) {
      throw new Error('Gmail SMTP not configured. Run: npm run setup-gmail');
    }

    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      text: body,
    };
    if (html) mailOptions.html = html;
    const info = await this.transporter.sendMail(mailOptions);

    return { success: true, messageId: info.messageId };
  }
}
