/**
 * OpenAce Desktop Agent
 * Provides the "eyes" and "hands" for controlling the entire desktop.
 * Uses RobotJS for mouse/keyboard control and AI vision for understanding.
 *
 * Mouse movement uses Bézier curves for human-like motion.
 * Click targeting uses AI vision with scroll-to-find retry.
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);

let robot = null;
try {
  robot = require('robotjs');
} catch {
  // robotjs not available — macOS only, requires native compilation
}

let Jimp = null;
try {
  Jimp = require('jimp');
} catch {
  // jimp not available
}

export class DesktopAgent {
  constructor(options = {}) {
    this.onProgress = options.onProgress || ((msg) => console.log(`[DesktopAgent] ${msg}`));
    this.aiManager = options.aiManager || null;
    if (robot) {
      this.screenSize = robot.getScreenSize();
      this.onProgress(`🤖 Desktop Agent initialized. Screen size: ${this.screenSize.width}x${this.screenSize.height}`);
    } else {
      this.screenSize = { width: 1920, height: 1080 };
      this.onProgress('🤖 Desktop Agent initialized (no robotjs — desktop control unavailable)');
    }
  }

  // ═══════════════════════════════════════════
  // MOUSE MOVEMENT — Human-like Bézier curves
  // ═══════════════════════════════════════════

  /**
   * Move mouse smoothly along a quadratic Bézier curve.
   * Duration scales with distance (200-400ms). A random control point
   * creates a gentle arc that looks natural. Tiny +/-1px jitter on
   * intermediate steps simulates hand tremor.
   */
  async smoothMoveMouse(targetX, targetY) {
    const start = robot.getMousePos();
    const dist = Math.hypot(targetX - start.x, targetY - start.y);

    // Skip animation for tiny moves (< 5px)
    if (dist < 5) {
      robot.moveMouse(targetX, targetY);
      return;
    }

    const duration = 200 + Math.random() * 200;                          // 200-400ms total
    const steps = Math.max(10, Math.min(25, Math.round(dist / 30)));     // Scale steps with distance
    const stepDelay = duration / steps;

    // Control point: midpoint + random offset for natural curve
    const cpX = (start.x + targetX) / 2 + (Math.random() - 0.5) * 80;  // +/- 40px
    const cpY = (start.y + targetY) / 2 + (Math.random() - 0.5) * 60;  // +/- 30px

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const inv = 1 - t;
      // Quadratic Bézier: B(t) = (1-t)²·P0 + 2·(1-t)·t·P1 + t²·P2
      let x = Math.round(inv * inv * start.x + 2 * inv * t * cpX + t * t * targetX);
      let y = Math.round(inv * inv * start.y + 2 * inv * t * cpY + t * t * targetY);

      // Tiny jitter on intermediate steps (+/- 1px)
      if (i < steps) {
        x += Math.round((Math.random() - 0.5) * 2);
        y += Math.round((Math.random() - 0.5) * 2);
      }

      robot.moveMouse(x, y);
      await new Promise(r => setTimeout(r, stepDelay));
    }

    // Final exact positioning
    robot.moveMouse(targetX, targetY);
  }

  /**
   * Move mouse to coordinates. Smooth Bézier by default.
   * Pass instant=true for immediate positioning (used by SOP pre-flight checks).
   */
  async moveMouse(x, y, instant = false) {
    this.onProgress(`🖱️ Moving mouse to ${x}, ${y}`);
    if (instant) {
      robot.moveMouse(x, y);
    } else {
      await this.smoothMoveMouse(x, y);
    }
  }

  /**
   * Random delay that mimics human reaction time.
   */
  async humanDelay(min = 80, max = 250) {
    await new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
  }

  /**
   * Performs a mouse click.
   * @param {string} button - 'left', 'right', or 'middle'. Defaults to 'left'.
   * @param {boolean} double - True for a double click. Defaults to false.
   */
  async click(button = 'left', double = false) {
    this.onProgress(`🖱️ Clicking ${button} mouse button${double ? ' (double)' : ''}`);
    robot.mouseClick(button, double);
  }

  /**
   * Types a string of text.
   * @param {string} text - The text to type.
   */
  async type(text) {
    this.onProgress(`⌨️ Typing: "${text}"`);
    robot.typeString(text);
  }

  // ═══════════════════════════════════════════
  // CHROME FOCUS — Ensure Chrome is in front
  // ═══════════════════════════════════════════

  /**
   * Bring Google Chrome to the foreground before any screen capture or click.
   * Without this, robot.screen.capture() captures whatever is in front
   * (usually the dashboard), and Ace ends up "looking at itself."
   */
  async _focusChrome() {
    try {
      if (process.platform === 'win32') {
        // Windows: use PowerShell COM
        execSync(
          'powershell -command "(New-Object -ComObject WScript.Shell).AppActivate(\'Google Chrome\')"',
          { timeout: 3000 }
        );
      } else {
        // macOS: AppleScript
        execSync('osascript -e \'tell application "Google Chrome" to activate\'', { timeout: 3000 });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch { /* best-effort — Chrome may not be running */ }
  }

  // ═══════════════════════════════════════════
  // SCREEN CAPTURE
  // ═══════════════════════════════════════════

  /**
   * Captures the screen and returns it as a Jimp image.
   * Converts robotjs BGRA buffer to RGBA.
   * NOTE: Does NOT focus Chrome — callers doing browser work should
   * call _focusChrome() themselves before this method.
   */
  async seeScreen() {
    this.onProgress('👁️ Looking at the screen...');
    const img = robot.screen.capture(0, 0, this.screenSize.width, this.screenSize.height);

    // Detect Retina/HiDPI: robotjs may report logical dimensions (1920x1080) but
    // the buffer contains physical pixels (3840x2160 on 2x Retina). If dimensions
    // don't match the buffer size, calculate real dimensions from the buffer.
    let imgWidth = img.width;
    let imgHeight = img.height;
    const expectedBytes = img.width * img.height * (img.bytesPerPixel || 4);
    const actualBytes = img.image.length;

    if (actualBytes > expectedBytes && actualBytes > 0) {
      // Buffer is larger than reported dimensions — Retina display
      const ratio = Math.sqrt(actualBytes / expectedBytes);
      imgWidth = Math.round(img.width * ratio);
      imgHeight = Math.round(img.height * ratio);
      // Store the pixel ratio for coordinate mapping
      if (!this._pixelRatio) {
        this._pixelRatio = ratio;
        this.onProgress(`🖥️ Retina display detected (${ratio}x) — real resolution: ${imgWidth}x${imgHeight}`);
      }
    } else if (!this._pixelRatio) {
      this._pixelRatio = 1;
    }

    const jimpImage = new Jimp.Jimp({
      data: img.image,
      width: imgWidth,
      height: imgHeight,
    });

    // Robotjs buffer is BGRA, Jimp expects RGBA — swap channels
    jimpImage.scan(0, 0, imgWidth, imgHeight, function (x, y, idx) {
      const red = this.bitmap.data[idx + 2];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 0];
      const alpha = this.bitmap.data[idx + 3];

      this.bitmap.data[idx + 0] = red;
      this.bitmap.data[idx + 1] = green;
      this.bitmap.data[idx + 2] = blue;
      this.bitmap.data[idx + 3] = alpha;
    });

    // Resize to logical resolution for AI vision (Retina images are too large)
    if (this._pixelRatio > 1) {
      jimpImage.resize({ w: this.screenSize.width, h: this.screenSize.height });
    }

    this.onProgress('✅ Screen captured.');
    return jimpImage;
  }

  // ═══════════════════════════════════════════
  // SMART CLICKING — AI Vision + Scroll-to-Find
  // ═══════════════════════════════════════════

  /**
   * Find an element on screen by description and click it.
   * Uses AI vision to locate the target. If not visible, scrolls down
   * and retries up to maxAttempts times (scroll-to-find).
   * Mouse moves with smooth Bézier curves, with human-like delays.
   *
   * @param {string} description - e.g., "the Sign In button", "first search result link"
   * @param {object} options - { maxAttempts: 3 }
   */
  async findAndClick(description, options = {}) {
    const maxAttempts = options.maxAttempts || 3;

    if (!this.aiManager) {
      return { success: false, error: 'AI Manager not available.' };
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check abort signal before each vision attempt
      if (options.isAborted?.()) {
        return { success: false, error: 'Stopped by user' };
      }
      this.onProgress(`🔍 Looking for "${description}"${attempt > 0 ? ` (attempt ${attempt + 1}/${maxAttempts})` : ''}...`);

      const image = await this.seeScreen();
      const imageBase64 = await image.getBase64('image/png');
      const { width, height } = this.screenSize;

      const prompt = `You are an expert computer operator looking at a ${width}x${height} pixel screenshot.
Find the PIXEL coordinates (x, y) of the CENTER of: "${description}".

RULES:
- Return coordinates in PIXELS (not normalized 0-1 values)
- x: 0 to ${width}, y: 0 to ${height}. Top-left is (0,0).
- If the element is clearly visible, return: {"x": 640, "y": 350, "visible": true}
- If the element is NOT visible anywhere on this screen, return: {"x": -1, "y": -1, "visible": false}
- Return ONLY the JSON object, nothing else.

IMPORTANT for accuracy:
- If this is a FORM FIELD or INPUT BOX: click the empty text input area itself, NOT the label text above/beside it.
- If there are MANY similar fields (e.g. a form with 20+ fields), carefully read each label to find the exact match.
- If the target is an ICON BUTTON (no text, just a symbol like ↑ ▶ ✕ ⋮ 📎), look for small clickable icons.
- If the target is a COPY or SEND button, look for icon buttons near the content area.
- Be PRECISE — even 30px off can hit the wrong element on a crowded page.`;

      try {
        this.onProgress(`📡 Sending to AI vision (${this.aiManager.getProviderForTask('vision')})...`);
        const response = await this.aiManager.chatWithVision(prompt, imageBase64);
        const content = response.content || response.text || '';
        this.onProgress(`🤖 Vision response (${content.length} chars): "${content.substring(0, 120)}"`);

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`No JSON in AI response: "${content.substring(0, 200)}"`);
        }

        let coords = JSON.parse(jsonMatch[0]);

        // Target not visible on screen — scroll and retry
        if (coords.visible === false || coords.x === -1) {
          if (attempt < maxAttempts - 1) {
            this.onProgress(`👀 "${description}" not visible — scrolling down to find it...`);
            robot.keyTap('space'); // Space = scroll one viewport in Chrome
            await this.humanDelay(800, 1500);
            continue;
          }
          return { success: false, error: `"${description}" not found after scrolling ${maxAttempts} times` };
        }

        // Safety: if AI returned normalized coords (0-1 range), scale to pixels
        if (coords.x >= -1 && coords.x <= 1 && coords.y >= -1 && coords.y <= 1) {
          this.onProgress(`⚠️ AI returned normalized coords (${coords.x}, ${coords.y}) — scaling to pixels`);
          coords.x = Math.round(Math.abs(coords.x) * width);
          coords.y = Math.round(Math.abs(coords.y) * height);
        }

        // Clamp to screen bounds
        coords.x = Math.max(0, Math.min(width - 1, Math.round(coords.x)));
        coords.y = Math.max(0, Math.min(height - 1, Math.round(coords.y)));

        // Crop-and-zoom verification: on crowded pages, re-check with a cropped region
        // for more precise coordinates (only on first attempt to avoid slowing retries)
        if (attempt === 0 && Jimp) {
          try {
            const cropSize = 500;
            const cropX = Math.max(0, Math.min(width - cropSize, coords.x - cropSize / 2));
            const cropY = Math.max(0, Math.min(height - cropSize, coords.y - cropSize / 2));
            const cropped = image.clone().crop({ x: cropX, y: cropY, w: cropSize, h: cropSize });
            const cropBase64 = await cropped.getBase64('image/png');

            const cropPrompt = `You are looking at a ${cropSize}x${cropSize} pixel CROPPED region of a screen.
Find the PIXEL coordinates (x, y) of the CENTER of: "${description}" within THIS cropped image.
Coordinates are relative to this crop: x: 0 to ${cropSize}, y: 0 to ${cropSize}.
If visible, return: {"x": 250, "y": 250, "visible": true}
If NOT visible in this crop, return: {"x": -1, "y": -1, "visible": false}
Return ONLY the JSON object.`;

            const cropResp = await this.aiManager.chatWithVision(cropPrompt, cropBase64);
            const cropContent = cropResp.content || cropResp.text || '';
            const cropJson = cropContent.match(/\{[\s\S]*\}/);
            if (cropJson) {
              const cropCoords = JSON.parse(cropJson[0]);
              if (cropCoords.visible !== false && cropCoords.x >= 0 && cropCoords.y >= 0) {
                // Map crop-relative coords back to screen coords
                const refinedX = Math.round(cropX + cropCoords.x);
                const refinedY = Math.round(cropY + cropCoords.y);
                // Only use refined coords if they differ meaningfully (>15px)
                const drift = Math.abs(refinedX - coords.x) + Math.abs(refinedY - coords.y);
                if (drift > 15 && drift < cropSize) {
                  this.onProgress(`🔬 Zoom refined: (${coords.x},${coords.y}) → (${refinedX},${refinedY})`);
                  coords.x = Math.max(0, Math.min(width - 1, refinedX));
                  coords.y = Math.max(0, Math.min(height - 1, refinedY));
                }
              }
            }
          } catch (e) {
            // Crop verification failed — proceed with original coords
          }
        }

        this.onProgress(`🎯 Found "${description}" at (${coords.x}, ${coords.y})`);

        // Smooth Bézier move → human pause → click → human pause
        await this.moveMouse(coords.x, coords.y);
        await this.humanDelay(50, 150);
        await this.click();
        await this.humanDelay(100, 300);

        return { success: true, x: coords.x, y: coords.y, attempt: attempt + 1 };
      } catch (error) {
        this.onProgress(`❌ Vision attempt ${attempt + 1} failed: ${error.message}`);
        if (attempt === maxAttempts - 1) {
          return { success: false, error: error.message };
        }
      }
    }

    return { success: false, error: 'All click attempts failed' };
  }

  /**
   * Finds a text field on screen and types into it.
   * Uses findAndClick to locate the field, then types.
   */
  async findAndType(fieldDescription, text) {
    this.onProgress(`🔍 Looking for "${fieldDescription}" to type in...`);
    const clickResult = await this.findAndClick(fieldDescription);
    if (clickResult.success) {
      await this.humanDelay(100, 200);
      await this.type(text);
      return { success: true };
    } else {
      return clickResult;
    }
  }
}

export default DesktopAgent;
