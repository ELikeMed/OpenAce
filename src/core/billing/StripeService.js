/**
 * StripeService — Stripe API wrapper for checkout, subscriptions, and webhooks.
 *
 * Credentials stored in: data/memory/credentials/stripe.json
 * Setup: Settings → Billing → Stripe Setup section (admin only)
 *
 * For local webhook testing: stripe listen --forward-to localhost:3333/api/billing/webhook
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';

const require = createRequire(import.meta.url);
const CREDS_FILE = path.join(process.cwd(), 'data/memory/credentials/stripe.json');

export class StripeService {
  constructor() {
    this.stripe = null;
    this.secretKey = null;
    this.webhookSecret = null;
    this.publishableKey = null;
    this.priceIdMonthly = null;
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  async initialize() {
    try {
      const raw = await fs.readFile(CREDS_FILE, 'utf8');
      const creds = JSON.parse(raw);
      if (!creds.secretKey) return false;

      const Stripe = require('stripe');
      this.stripe = new Stripe(creds.secretKey);
      this.secretKey = creds.secretKey;
      this.webhookSecret = creds.webhookSecret || null;
      this.publishableKey = creds.publishableKey || null;
      this.priceIdMonthly = creds.priceIdMonthly || null;

      return true;
    } catch {
      return false;
    }
  }

  isConfigured() {
    return !!this.stripe;
  }

  // ═══════════════════════════════════════════════════════════
  // CHECKOUT
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a Stripe Checkout session.
   * @param {string} mode - 'subscription' or 'top_up'
   * @param {string} customerId - Existing Stripe customer ID (optional)
   * @param {number} amount - Dollar amount for top-ups (e.g. 5, 10, 25)
   * @param {string} successUrl - Redirect URL on success
   * @param {string} cancelUrl - Redirect URL on cancel
   */
  async createCheckoutSession({ mode, customerId, amount, successUrl, cancelUrl }) {
    if (!this.stripe) throw new Error('Stripe not configured. Set up in Settings → Billing.');

    const baseUrl = successUrl || 'http://localhost:3333';
    const params = {
      success_url: `${baseUrl}?billing=success`,
      cancel_url: cancelUrl || `${baseUrl}?billing=cancel`,
    };

    if (customerId) {
      params.customer = customerId;
    }

    if (mode === 'subscription') {
      if (!this.priceIdMonthly) throw new Error('Monthly price ID not configured in Stripe settings.');
      params.mode = 'subscription';
      params.line_items = [{ price: this.priceIdMonthly, quantity: 1 }];
    } else {
      // Top-up: one-time payment
      const credits = (amount || 5) * 100; // $1 = 100 credits
      const cents = (amount || 5) * 100;   // dollars to cents

      params.mode = 'payment';
      params.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits} Ace Credits`,
            description: `Top-up: ${credits} credits for OpenAce tools`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      }];
      params.metadata = { type: 'top_up', credits: String(credits) };
    }

    const session = await this.stripe.checkout.sessions.create(params);
    return { url: session.url, sessionId: session.id };
  }

  // ═══════════════════════════════════════════════════════════
  // CUSTOMER PORTAL
  // ═══════════════════════════════════════════════════════════

  async createCustomerPortalSession(customerId, returnUrl) {
    if (!this.stripe) throw new Error('Stripe not configured.');
    if (!customerId) throw new Error('No Stripe customer ID found. Subscribe first.');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || 'http://localhost:3333',
    });
    return { url: session.url };
  }

  // ═══════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════

  /**
   * Verify and parse a Stripe webhook event.
   * @param {Buffer} rawBody - Raw request body
   * @param {string} signature - Stripe-Signature header
   * @returns {object} Parsed Stripe event
   */
  handleWebhook(rawBody, signature) {
    if (!this.stripe) throw new Error('Stripe not configured.');
    if (!this.webhookSecret) throw new Error('Webhook secret not configured.');

    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  async getSubscription(subscriptionId) {
    if (!this.stripe) throw new Error('Stripe not configured.');
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  // ═══════════════════════════════════════════════════════════
  // CREDENTIAL MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async saveCredentials({ secretKey, webhookSecret, publishableKey, priceIdMonthly }) {
    await fs.mkdir(path.dirname(CREDS_FILE), { recursive: true });
    await fs.writeFile(CREDS_FILE, JSON.stringify({
      secretKey,
      webhookSecret: webhookSecret || '',
      publishableKey: publishableKey || '',
      priceIdMonthly: priceIdMonthly || '',
      configuredAt: new Date().toISOString(),
    }, null, 2));

    // Re-initialize
    await this.initialize();
    return { success: true };
  }

  async getCredentialStatus() {
    try {
      const raw = await fs.readFile(CREDS_FILE, 'utf8');
      const creds = JSON.parse(raw);
      return {
        configured: this.isConfigured(),
        hasWebhookSecret: !!creds.webhookSecret,
        hasPublishableKey: !!creds.publishableKey,
        hasPriceId: !!creds.priceIdMonthly,
      };
    } catch {
      return { configured: false, hasWebhookSecret: false, hasPublishableKey: false, hasPriceId: false };
    }
  }
}
