/**
 * ProxyAIProvider — Routes AI calls through OpenAce's proxy server.
 *
 * Used when developers don't have their own AI API keys configured.
 * The license key authorizes proxy access. AI usage is metered against
 * the developer's OpenAce subscription.
 *
 * Same interface as AIProviderManager so EmbedAgent doesn't know the difference.
 */

const PROXY_URL = 'https://api.openaceai.com/v1/proxy';

export class ProxyAIProvider {
  constructor(licenseKey) {
    this.licenseKey = licenseKey;
    this.activeProvider = 'proxy';
  }

  getActiveProvider() {
    return 'proxy';
  }

  /**
   * Chat with tools — same signature as AIProviderManager.chatWithTools()
   */
  async chatWithTools({ messages, tools, systemPrompt, temperature = 0.4 }) {
    const res = await fetch(`${PROXY_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.licenseKey}`,
        'X-OpenAce-SDK': 'embed/1.0.0',
      },
      body: JSON.stringify({
        messages,
        tools,
        systemPrompt,
        temperature,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 402) {
        throw new Error('OpenAce proxy: subscription required or usage limit reached. Add your own API key or upgrade at openaceai.com.');
      }
      if (res.status === 401) {
        throw new Error('OpenAce proxy: invalid license key. Check your OPENACE_LICENSE_KEY.');
      }
      throw new Error(`OpenAce proxy error (${res.status}): ${err.error || 'Unknown error'}`);
    }

    return await res.json();
  }

  /**
   * Simple chat — same signature as AIProviderManager.chat()
   */
  async chat({ messages, systemPrompt, temperature = 0.4 }) {
    return this.chatWithTools({ messages, tools: [], systemPrompt, temperature });
  }

  /**
   * Vision — analyze an image with AI
   */
  async analyzeImage({ imageUrl, prompt }) {
    const res = await fetch(`${PROXY_URL}/vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.licenseKey}`,
        'X-OpenAce-SDK': 'embed/1.0.0',
      },
      body: JSON.stringify({ imageUrl, prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAce proxy vision error: ${err.error || 'Unknown error'}`);
    }

    return await res.json();
  }
}
