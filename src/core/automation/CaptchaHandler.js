/**
 * CaptchaHandler — Detects and solves CAPTCHAs like a human would
 * 
 * Capabilities:
 * 1. Detects CAPTCHA/robot check pages (Google, Cloudflare, reCAPTCHA, etc.)
 * 2. Clicks "I'm not a robot" checkboxes
 * 3. Uses AI vision to solve visual puzzles (image selection challenges)
 * 4. Handles cookie consent banners that block the page
 */

import fs from 'fs/promises';

export class CaptchaHandler {
  constructor({ browserAgent, aiManager, onProgress }) {
    this.browserAgent = browserAgent;
    this.aiManager = aiManager;
    this.onProgress = onProgress || ((msg) => console.log(`[CaptchaHandler] ${msg}`));
    this.maxAttempts = 3;
  }

  /**
   * Check if the current page is a CAPTCHA/block page and try to solve it.
   * Returns true if a CAPTCHA was detected and handled (success or not).
   */
  async detectAndHandle() {
    const page = this.browserAgent?.page;
    if (!page) return false;

    try {
      const pageState = await page.evaluate(() => {
        const body = document.body?.innerText?.toLowerCase() || '';
        const title = document.title?.toLowerCase() || '';
        const url = window.location.href.toLowerCase();
        
        return {
          body: body.substring(0, 2000),
          title,
          url,
          hasRecaptcha: !!document.querySelector('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"], .g-recaptcha, #recaptcha'),
          hasCheckbox: !!document.querySelector('iframe[src*="recaptcha/api2/anchor"], .recaptcha-checkbox, [role="checkbox"]'),
          hasChallengeFrame: !!document.querySelector('iframe[src*="recaptcha/api2/bframe"]'),
          hasCookieBanner: !!document.querySelector('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"]'),
          hasCloudflare: body.includes('checking your browser') || body.includes('cloudflare') || body.includes('ray id'),
        };
      });

      // Check for various CAPTCHA types
      const isCaptchaPage = this._isCaptchaPage(pageState);
      
      if (!isCaptchaPage && !pageState.hasCookieBanner) {
        return false; // No CAPTCHA detected
      }

      this.onProgress('🤖 Detected a CAPTCHA or block page — attempting to solve...');

      // Handle cookie banners first (they often block interaction)
      if (pageState.hasCookieBanner) {
        await this._handleCookieBanner(page);
      }

      // Handle reCAPTCHA checkbox
      if (pageState.hasRecaptcha || pageState.hasCheckbox) {
        return await this._handleRecaptcha(page, pageState);
      }

      // Handle Google's "sorry" page
      if (pageState.url.includes('google.com/sorry') || pageState.body.includes('unusual traffic')) {
        return await this._handleGoogleSorry(page, pageState);
      }

      // Handle Cloudflare challenge
      if (pageState.hasCloudflare) {
        return await this._handleCloudflare(page);
      }

      // Generic: try to find and click any "I'm not a robot" or "verify" button
      return await this._handleGenericChallenge(page, pageState);

    } catch (e) {
      this.onProgress(`⚠️ CAPTCHA handler error: ${e.message}`);
      return false;
    }
  }

  /**
   * Check if page looks like a CAPTCHA/block page
   */
  _isCaptchaPage(state) {
    const captchaIndicators = [
      'not a robot', 'robot', 'captcha', 'verify you', 'verify that you',
      'automated queries', 'unusual traffic', 'sorry', 'blocked',
      'access denied', 'checking your browser', 'cloudflare', 'challenge',
      'human verification', 'security check', 'are you human'
    ];
    
    const text = state.body + ' ' + state.title + ' ' + state.url;
    return captchaIndicators.some(indicator => text.includes(indicator)) || 
           state.hasRecaptcha || state.hasCheckbox;
  }

  /**
   * Handle cookie consent banners
   */
  async _handleCookieBanner(page) {
    this.onProgress('🍪 Handling cookie banner...');
    
    const acceptSelectors = [
      'button[id*="accept"]', 'button[class*="accept"]',
      'a[id*="accept"]', 'a[class*="accept"]',
      'button[id*="agree"]', 'button[class*="agree"]',
      'button[id*="consent"]', 'button[class*="consent"]',
      '[data-testid*="accept"]', '[data-testid*="agree"]',
      'button:has-text("Accept")', 'button:has-text("I agree")',
      'button:has-text("OK")', 'button:has-text("Got it")',
    ];

    for (const selector of acceptSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          this.onProgress('✅ Cookie banner dismissed');
          await new Promise(r => setTimeout(r, 1000));
          return true;
        }
      } catch (e) { /* try next */ }
    }

    // Fallback: try clicking any button with accept-like text
    try {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button, a, [role="button"]')];
        const acceptBtn = buttons.find(b => {
          const text = b.textContent?.toLowerCase() || '';
          return text.includes('accept') || text.includes('agree') || 
                 text.includes('ok') || text.includes('got it') ||
                 text.includes('allow') || text.includes('understand');
        });
        if (acceptBtn) acceptBtn.click();
      });
    } catch (e) { /* ignore */ }
    
    return false;
  }

  /**
   * Handle reCAPTCHA (checkbox + image challenge)
   * Ace doesn't give up — he clicks the checkbox and solves the image puzzle.
   */
  async _handleRecaptcha(page, state) {
    this.onProgress('🔲 Attempting to click reCAPTCHA checkbox...');
    
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        // Step 1: Find and click the checkbox
        let clickedCheckbox = false;
        const frames = page.frames();
        
        const recaptchaFrame = frames.find(f =>
          f.url().includes('recaptcha/api2/anchor') ||
          f.url().includes('recaptcha/enterprise/anchor')
        );

        if (recaptchaFrame) {
          const checkbox = await recaptchaFrame.$('.recaptcha-checkbox-border, #recaptcha-anchor, [role="checkbox"]');
          if (checkbox) {
            await checkbox.click();
            clickedCheckbox = true;
            this.onProgress('✅ Clicked reCAPTCHA checkbox');
          }
        }

        if (!clickedCheckbox) {
          // Try direct click on the reCAPTCHA container
          const directCheckbox = await page.$('.g-recaptcha, [data-sitekey]');
          if (directCheckbox) {
            await directCheckbox.click();
            clickedCheckbox = true;
            this.onProgress('✅ Clicked reCAPTCHA element directly');
          }
        }

        if (!clickedCheckbox) {
          this.onProgress('⚠️ Could not find reCAPTCHA checkbox');
          continue;
        }

        // Step 2: Wait for challenge to appear (iframe is dynamically added)
        await new Promise(r => setTimeout(r, 3000));

        // Step 3: RE-FETCH frames (critical — challenge iframe is new!)
        const updatedFrames = page.frames();
        const challengeFrame = updatedFrames.find(f =>
          f.url().includes('recaptcha/api2/bframe') ||
          f.url().includes('recaptcha/enterprise/bframe')
        );
        
        if (challengeFrame) {
          // Image challenge appeared — Ace needs to solve it
          this.onProgress('🧩 Image challenge detected — using AI vision to solve...');
          const solved = await this._solveImageChallenge(page, challengeFrame);
          if (solved) {
            this.onProgress('✅ CAPTCHA image challenge solved!');
            await new Promise(r => setTimeout(r, 2000));
            return true;
          }
          this.onProgress(`⚠️ Image challenge attempt ${attempt + 1} — not solved yet, retrying...`);
        } else {
          // No challenge appeared — checkbox might have been enough
          // Check if the page has moved past the CAPTCHA
          const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500)?.toLowerCase() || '');
          if (!bodyText.includes('captcha') && !bodyText.includes('not a robot') && !bodyText.includes('sorry')) {
            this.onProgress('✅ reCAPTCHA passed (no image challenge required)');
            return true;
          }
          this.onProgress('⚠️ Checkbox clicked but CAPTCHA still present. Retrying...');
        }

      } catch (e) {
        this.onProgress(`⚠️ reCAPTCHA attempt ${attempt + 1} failed: ${e.message}`);
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
    
    return false;
  }

  /**
   * Handle Google's "sorry/unusual traffic" page
   */
  async _handleGoogleSorry(page, state) {
    this.onProgress('🔍 Handling Google "unusual traffic" check...');
    
    try {
      // Google's sorry page often has a form with a CAPTCHA
      // Look for the reCAPTCHA on the page
      const hasRecaptcha = await page.$('iframe[src*="recaptcha"]');
      if (hasRecaptcha) {
        return await this._handleRecaptcha(page, state);
      }

      // Sometimes it's just a checkbox form
      const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
      if (submitBtn) {
        // Check if there's a checkbox to tick first
        const checkbox = await page.$('input[type="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          await new Promise(r => setTimeout(r, 500));
        }
        await submitBtn.click();
        this.onProgress('✅ Submitted Google verification form');
        await new Promise(r => setTimeout(r, 3000));
        return true;
      }
    } catch (e) {
      this.onProgress(`⚠️ Google sorry page handling failed: ${e.message}`);
    }
    
    return false;
  }

  /**
   * Handle Cloudflare challenge
   */
  async _handleCloudflare(page) {
    this.onProgress('☁️ Cloudflare challenge detected — waiting for it to resolve...');
    
    // Cloudflare often resolves automatically after a few seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      
      const stillChallenge = await page.evaluate(() => {
        const body = document.body?.innerText?.toLowerCase() || '';
        return body.includes('checking your browser') || body.includes('cloudflare');
      });
      
      if (!stillChallenge) {
        this.onProgress('✅ Cloudflare challenge resolved');
        return true;
      }
      
      // Try clicking any turnstile/challenge checkbox
      try {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame.url().includes('challenges.cloudflare.com') || frame.url().includes('turnstile')) {
            const checkbox = await frame.$('input[type="checkbox"], [role="checkbox"], .cb-lb');
            if (checkbox) {
              await checkbox.click();
              this.onProgress('✅ Clicked Cloudflare verification checkbox');
              await new Promise(r => setTimeout(r, 3000));
              return true;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    
    this.onProgress('⚠️ Cloudflare challenge did not resolve after 20s');
    return false;
  }

  /**
   * Solve an image challenge using AI vision
   */
  async _solveImageChallenge(page, challengeFrame) {
    if (!this.aiManager) {
      this.onProgress('⚠️ AI not available — cannot solve image challenge');
      return false;
    }

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        // Take a screenshot of the FULL page (captures the CAPTCHA overlay)
        const screenshotPath = await this.browserAgent.takeScreenshot('captcha-challenge');
        const screenshotBuffer = await fs.readFile(screenshotPath);
        // Format with data URI prefix — Ollama/OpenAI vision APIs expect this
        const base64Image = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

        // Ask AI to analyze the CAPTCHA using vision
        const visionPrompt = `You are looking at a screenshot of a CAPTCHA image challenge on a webpage.

Look at the blue header area — it says "Select all images with a [OBJECT]".

The grid below shows 9 images (3 rows × 3 columns). Number them 1-9:
Row 1: tiles 1, 2, 3 (left to right)
Row 2: tiles 4, 5, 6
Row 3: tiles 7, 8, 9

Which tile numbers contain the object mentioned in the instruction?

Reply with ONLY the tile numbers separated by commas. Example: 4, 7, 9
Do NOT explain. Just list the numbers.`;

        let analysis = '';
        
        // Try chatWithVision first, fall back to direct Ollama API
        try {
          const visionResult = await this.aiManager.chatWithVision(visionPrompt, base64Image);
          analysis = visionResult?.content || visionResult?.text || '';
        } catch (visionError) {
          // chatWithVision may force JSON mode — try direct Ollama API for plain text
          this.onProgress(`⚠️ Vision API error: ${visionError.message}. Trying direct Ollama API...`);
          try {
            analysis = await this._directOllamaVision(visionPrompt, screenshotBuffer.toString('base64'));
          } catch (directError) {
            this.onProgress(`⚠️ Direct vision also failed: ${directError.message}`);
            continue;
          }
        }
        
        this.onProgress(`🧩 AI vision says: ${analysis.substring(0, 200)}`);

        // Parse which tiles to click — accept multiple formats:
        // "4, 7, 9" or "SELECT: 4, 7, 9" or "Tiles 4, 7, and 9" or just numbers
        let tilesToClick = [];
        
        // Try SELECT: format first
        const selectMatch = analysis.match(/SELECT:\s*([\d,\s]+)/i);
        if (selectMatch) {
          tilesToClick = selectMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
        
        // If that didn't work, extract all numbers 1-9 from the response
        if (tilesToClick.length === 0) {
          const allNumbers = analysis.match(/\b[1-9]\b/g);
          if (allNumbers) {
            tilesToClick = [...new Set(allNumbers.map(n => parseInt(n)))];
          }
        }
        
        if (tilesToClick.length > 0) {
          
          if (tilesToClick.length > 0) {
            this.onProgress(`🖱️ Clicking tiles: ${tilesToClick.join(', ')}`);
            
            // Find tile elements in the challenge frame
            const tiles = await challengeFrame.$$('.rc-imageselect-tile, .rc-image-tile-wrapper, td[role="button"]');
            
            for (const tileNum of tilesToClick) {
              const idx = tileNum - 1; // Convert 1-based to 0-based
              if (tiles[idx]) {
                await tiles[idx].click();
                await new Promise(r => setTimeout(r, 500));
              }
            }

            // Click verify/submit button
            await new Promise(r => setTimeout(r, 1000));
            const verifyBtn = await challengeFrame.$('#recaptcha-verify-button, .rc-button-default, button');
            if (verifyBtn) {
              await verifyBtn.click();
              this.onProgress('✅ Clicked verify button');
              await new Promise(r => setTimeout(r, 3000));
              
              // Check if challenge is still showing
              const stillChallenging = await page.evaluate(() => {
                const frames = [...document.querySelectorAll('iframe')];
                return frames.some(f => f.src?.includes('recaptcha/api2/bframe'));
              });
              
              if (!stillChallenging) {
                return true; // Challenge solved!
              }
              this.onProgress('⚠️ Challenge still showing — retrying...');
            }
          }
        }
      } catch (e) {
        this.onProgress(`⚠️ Vision challenge attempt ${attempt + 1} failed: ${e.message}`);
      }
    }
    
    return false;
  }

  /**
   * Generic challenge handler — try common patterns
   */
  async _handleGenericChallenge(page, state) {
    this.onProgress('🔍 Trying generic challenge resolution...');
    
    try {
      // Look for any "I'm not a robot", "Verify", "Continue" buttons
      const buttonTexts = ['not a robot', 'verify', 'continue', 'i am human', 'submit', 'proceed'];
      
      const clicked = await page.evaluate((texts) => {
        const allElements = [...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]')];
        for (const el of allElements) {
          const elText = (el.textContent || el.value || '').toLowerCase();
          if (texts.some(t => elText.includes(t))) {
            el.click();
            return elText;
          }
        }
        return null;
      }, buttonTexts);

      if (clicked) {
        this.onProgress(`✅ Clicked "${clicked}" button`);
        await new Promise(r => setTimeout(r, 3000));
        return true;
      }

      // Try clicking any checkbox on the page
      const checkbox = await page.$('input[type="checkbox"]:not(:checked)');
      if (checkbox) {
        await checkbox.click();
        this.onProgress('✅ Clicked checkbox');
        await new Promise(r => setTimeout(r, 1000));
        
        // Look for submit button
        const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await new Promise(r => setTimeout(r, 3000));
        }
        return true;
      }
    } catch (e) {
      this.onProgress(`⚠️ Generic challenge handling failed: ${e.message}`);
    }
    
    return false;
  }

  /**
   * Direct call to Ollama vision API without JSON mode.
   * The chatWithVision wrapper forces response_format: json_object which
   * breaks for CAPTCHA analysis. This calls Ollama directly for plain text.
   */
  async _directOllamaVision(prompt, base64ImageRaw) {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64ImageRaw] // Ollama native API takes raw base64 in images array
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama vision returned ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }
}
