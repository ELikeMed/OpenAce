/**
 * SOPParser — Natural Language to Structured SOP Steps
 * 
 * Parses plain English instructions into executable SOP step objects.
 * Supports both rule-based parsing (fast, no AI needed) and AI-enhanced
 * parsing (for complex/ambiguous instructions).
 * 
 * Examples:
 *   "Go to google.com" → { action: 'navigate', url: 'https://google.com' }
 *   "Type 'search query'" → { action: 'type', text: 'search query' }
 *   "Click on the search button" → { action: 'click_text', text: 'search button' }
 *   "Wait 3 seconds" → { action: 'wait', ms: 3000 }
 *
 * Outputs ONLY the 16 unified action types that DesktopTaskRunner can replay.
 * Legacy actions from AI are normalized via _normalizeStep().
 */

// ═══════════════════════════════════════════════════════
// UNIFIED ACTION TYPES — the 16 actions DesktopTaskRunner can replay
// ═══════════════════════════════════════════════════════
const UNIFIED_ACTIONS = [
  'navigate', 'click_text', 'click_submit', 'smart_click', 'right_click',
  'select_option', 'hover', 'edit_field', 'type', 'press', 'scroll',
  'switch_tab', 'go_back', 'copy_text', 'wait', 'wait_navigation',
];

// Map legacy/old action names to their unified equivalents
const ACTION_ALIASES = {
  navigate_to: 'click_text',     // "go to settings page" → click "settings"
  click:       'click_text',     // CSS selector clicks → text-based
  smart_fill:  'edit_field',     // fill field → edit_field
  fill_form:   'edit_field',     // fill form → edit_field
  fill_credentials: 'edit_field',// auto-fill → edit_field (target: "username/password")
  copy:        'copy_text',      // old copy → copy_text
  search_google: 'navigate',    // google search → navigate to google + type
  wait_for:    'wait',           // wait for element → just wait
  goBack:      'go_back',        // camelCase alias
  goto:        'navigate',       // legacy navigate
  key:         'press',          // raw key event → press
  input:       'type',           // legacy type alias
  delay:       'wait',           // legacy wait alias
  extract_results: 'copy_text', // extract → copy_text
};

// Actions that exist but have no replay handler — strip these out
const DEAD_ACTIONS = ['screenshot', 'explore_page', 'extract', 'set_date', 'decide', 'fill_form'];

export class SOPParser {
  constructor(options = {}) {
    this.aiManager = options.aiManager || null;
  }

  /**
   * Initialize with system references
   */
  async initialize(systems = {}) {
    this.aiManager = systems.aiManager || this.aiManager;
    console.log('📝 SOPParser initialized — ready to parse natural language into SOPs');
    return this;
  }

  /**
   * Parse natural language text into structured SOP steps.
   * First tries rule-based parsing, falls back to AI if available.
   * 
   * @param {string} text - Natural language instructions
   * @returns {{ steps: Array, name: string, description: string }}
   */
  parseText(text) {
    if (!text || typeof text !== 'string') {
      return { steps: [], name: 'Untitled SOP', description: '' };
    }

    // Split into individual instruction lines
    const lines = this.splitInstructions(text);
    const steps = [];

    for (const line of lines) {
      const step = this.parseLine(line.trim());
      if (step) {
        step.description = line.trim();
        steps.push(step);
      }
    }

    // ═══ Post-processing Pass 1: Expand composite steps ═══
    // Steps with _pressEnterAfter flag → append press Enter + wait
    // navigate steps → append implicit wait_navigation if next step isn't a wait
    const expanded = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const next = steps[i + 1];

      // Expand _pressEnterAfter (search queries need Enter + wait for results)
      if (step._pressEnterAfter) {
        const cleanStep = { ...step };
        delete cleanStep._pressEnterAfter;
        delete cleanStep._searchGoogle;
        expanded.push(cleanStep);
        expanded.push({ action: 'press', key: 'enter', description: 'Press Enter to submit', _implicit: true });
        // Only add wait if next step isn't already a wait
        const isNextWait = next && (next.action === 'wait' || next.action === 'wait_navigation');
        if (!isNextWait) {
          expanded.push({ action: 'wait', ms: 2000, description: 'Wait for results to load', _implicit: true });
        }
        continue;
      }

      expanded.push(step);

      // After navigate, add implicit wait_navigation if next step isn't a wait
      if (step.action === 'navigate') {
        const isNextWait = next && (next.action === 'wait' || next.action === 'wait_navigation');
        if (!isNextWait) {
          expanded.push({ action: 'wait_navigation', description: 'Wait for page to load', _implicit: true });
        }
      }
    }

    // Replace steps with expanded version
    steps.length = 0;
    steps.push(...expanded);

    // ═══ Post-processing Pass 2: Content injection ═══
    // If the original text mentions pasting/posting/typing content but no step got {{content}},
    // insert a type {{content}} step at the right position (before submit-like clicks).
    const hasContentStep = steps.some(s => s.contentInjection || (s.text || '').includes('{{content}}'));
    if (!hasContentStep && this._descriptionNeedsContent(text)) {
      const insertIdx = this._findContentInsertionPoint(steps);
      if (insertIdx >= 0) {
        steps.splice(insertIdx, 0, {
          action: 'type',
          text: '{{content}}',
          contentInjection: true,
          description: 'Type the provided content'
        });
      }
    }

    // Auto-generate a name from the first meaningful step
    const name = this.generateName(text, steps);

    return {
      steps,
      name,
      description: text.substring(0, 200),
    };
  }

  /**
   * AI-enhanced parsing for complex instructions
   * @param {string} text - Natural language instructions
   * @returns {Promise<{ steps: Array, name: string, description: string }>}
   */
  async parseWithAI(text) {
    // Start with rule-based parsing as fallback
    const ruleBased = this.parseText(text);

    // If AI is available, use Gemini for intelligent parsing
    if (this.aiManager) {
      try {
        const prompt = `You are an expert at converting natural language instructions into structured browser automation steps. Parse the instructions below into a clean, executable SOP.

INSTRUCTIONS:
"""
${text}
"""

ACTION REFERENCE (16 supported actions — use ONLY these):
| Action | Use when | Required fields |
|--------|----------|-----------------|
| navigate | Opening a URL | url |
| click_text | Clicking a button, link, tab, menu item by visible text | text |
| click_submit | Clicking submit/sign in/log in/sign up/save buttons | (none) |
| smart_click | Clicking something hard to describe by text (AI vision finds it) | target |
| right_click | Right-clicking for context menus | target |
| select_option | Clicking a dropdown then selecting an option | target, text |
| hover | Hovering over an element (for menus/tooltips) | target |
| edit_field | Clicking a field, clearing it, and typing new text | target, text |
| type | Typing text into the currently focused field | text |
| press | Pressing a keyboard key (Enter, Tab, Escape, etc.) | key |
| scroll | Scrolling the page | direction (up/down) |
| switch_tab | Switching browser tabs | target (tab # or "next"/"previous") |
| go_back | Going back to previous page | (none) |
| copy_text | Copying text from the page | target |
| wait | Pausing for a set time | ms (milliseconds) |
| wait_navigation | Waiting for a full page load | (none) |

RULES:
1. After every "navigate" step, add a "wait_navigation" step
2. After a "type" step used for search, add a "press" step with key "enter", then a "wait" step
3. "Go to X" where X looks like a URL → navigate. Where X is NOT a URL → click_text
4. "Search for X" → type the query, then press Enter, then wait
5. "Go back" → go_back (NOT click_text)
6. "Fill in X with Y" or "enter X in the Y field" → edit_field with target and text
7. "Log in with credentials" → edit_field for username + edit_field for password + click_submit
8. If instructions mention typing/pasting user-provided content, use: { "action": "type", "text": "{{content}}", "contentInjection": true }
9. Short phrases like "Continue", "Next", "Publish" → click_text
10. Each step MUST have a "description" field

Return ONLY valid JSON:
{
  "name": "Short SOP name (max 60 chars)",
  "steps": [
    { "action": "navigate", "url": "https://example.com", "description": "Open the website" },
    { "action": "wait_navigation", "description": "Wait for page to load" }
  ]
}`;

        // Route to Gemini (not Ollama) — pass messages array, not raw string
        const response = await this.aiManager.chat(
          [{ role: 'user', content: prompt }],
          { temperature: 0.2, provider: 'gemini' }
        );
        const content = typeof response === 'string' ? response : response?.content || response?.text || '';

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
            // Validate and fix steps before returning
            const validated = this._validateAndFixSteps(parsed.steps);
            if (validated.length > 0) {
              return {
                steps: validated.map(s => ({ ...s, description: s.description || this.describeStep(s) })),
                name: parsed.name || ruleBased.name,
                description: text.substring(0, 200),
              };
            }
          }
        }
      } catch (e) {
        console.warn('[SOPParser] AI parsing failed, using rule-based:', e.message);
      }
    }

    return ruleBased;
  }

  /**
   * Normalize a single step's action to the unified 16 types.
   * Maps legacy actions to their modern equivalents and adapts fields.
   */
  _normalizeStep(step) {
    if (!step || !step.action) return null;

    // Already a unified action — pass through
    if (UNIFIED_ACTIONS.includes(step.action)) return step;

    // Dead actions with no replay handler — remove entirely
    if (DEAD_ACTIONS.includes(step.action)) return null;

    // Check alias map
    const mapped = ACTION_ALIASES[step.action];
    if (!mapped) return null; // Unknown action — drop it

    const normalized = { ...step, action: mapped };

    // Adapt fields for specific mappings
    switch (step.action) {
      case 'navigate_to':
        // "go to settings" → click_text with the section name
        normalized.text = step.section || step.target || step.description || '';
        break;
      case 'click':
        // CSS selector click → text-based (use selector as description, target as text)
        normalized.text = step.text || step.target || step.selector || '';
        break;
      case 'smart_fill':
        // fill field with value → edit_field
        normalized.target = step.context || step.target || '';
        normalized.text = step.value || step.text || '';
        break;
      case 'fill_credentials':
        // Auto-fill credentials → edit_field with placeholder
        normalized.target = step.credentialId || 'login credentials';
        normalized.text = '{{credentials}}';
        break;
      case 'copy':
        // old copy → copy_text
        normalized.target = step.target || '';
        break;
      case 'search_google':
        // google search → navigate to google.com
        normalized.url = `https://www.google.com/search?q=${encodeURIComponent(step.query || '')}`;
        break;
      case 'wait_for':
        // wait for element → wait with reasonable timeout
        normalized.ms = step.ms || 3000;
        break;
      case 'extract_results':
        // extract → copy_text
        normalized.target = step.target || 'results';
        break;
    }

    return normalized;
  }

  /**
   * Validate and fix AI-generated steps — normalize to unified actions, filter invalid
   */
  _validateAndFixSteps(steps) {
    return steps
      .map(step => this._normalizeStep(step))
      .filter(step => {
        if (!step) return false;
        // Check required fields after normalization
        if (step.action === 'navigate' && !step.url) return false;
        if (step.action === 'type' && !step.text) return false;
        if (step.action === 'click_text' && !step.text) return false;
        if (step.action === 'press' && !step.key) return false;
        if (step.action === 'edit_field' && !step.target && !step.text) return false;
        return true;
      });
  }

  /**
   * Split text into individual instructions
   */
  splitInstructions(text) {
    // Split on common delimiters
    let lines = text
      .split(/(?:\n|,\s*(?:then|and)\s+|,\s+|\.\s+|;\s*)/i)
      .map(l => l.trim())
      .filter(l => l.length > 3);

    // If we got only one line, try splitting on "then" and "and then"
    if (lines.length === 1) {
      lines = text
        .split(/\s+(?:then|and then|after that|next|afterwards)\s+/i)
        .map(l => l.trim())
        .filter(l => l.length > 3);
    }

    return lines;
  }

  /**
   * Parse a single instruction line into a step object.
   *
   * 23-pattern priority chain — most specific patterns first, NO catch-all.
   * Each pattern maps natural language to one of 27 supported action types.
   */
  parseLine(line) {
    const lower = line.toLowerCase().trim();
    if (!lower || lower.length < 2) return null;

    // ═══ P1: Content injection — "paste the information", "post whatever we ask" ═══
    const contentPatterns = [
      /(?:paste|pasting)\s+(?:the\s+)?(?:information|content|data|text|message|details|link|url|post)/i,
      /(?:type|enter|write|put|fill|input)\s+(?:the\s+)?(?:information|content|data|text|message|details)\s+(?:we|you|i|they)\s+(?:gave|give|provide|send|tell|ask)/i,
      /(?:post|share|publish|send|submit)\s+(?:whatever|what|the\s+(?:content|info|information|message|data|text))\s+(?:we|you|i|they)/i,
      /(?:create|make|write)\s+(?:a\s+)?(?:post|message|comment|reply|status)\s+(?:by\s+)?(?:pasting|typing|entering|writing|putting)/i,
      /(?:provided|given|supplied)\s+(?:content|information|data|text|message)/i,
      /(?:content|information|data|text|message)\s+(?:we|you|i|they)\s+(?:gave|give|provide|want|need)/i,
    ];
    if (contentPatterns.some(p => p.test(lower))) {
      return { action: 'type', text: '{{content}}', contentInjection: true };
    }

    // ═══ P2: Go back — "go back", "navigate back", "press back", "click the back button" ═══
    if (/\b(?:go|navigate|press|click|hit)\s+(?:the\s+)?back(?:\s+button)?\b/i.test(lower) && !/back\s+to\s+/i.test(lower)) {
      // "go back" but NOT "go back to google" (that's navigation)
      return { action: 'go_back' };
    }
    // Also catch "go back to X" as go_back (user wants browser back, not navigate)
    if (/\b(?:go|navigate)\s+back\s+to\s+/i.test(lower)) {
      return { action: 'go_back' };
    }

    // ═══ P3: Search Google — "search google for X", "google search X" ═══
    const googleSearchMatch = line.match(/(?:search\s+google\s+for|google\s+search(?:\s+for)?)\s+(.+)/i);
    if (googleSearchMatch) {
      const query = googleSearchMatch[1].replace(/['"]/g, '').trim();
      return { action: 'type', text: query, _pressEnterAfter: true, _searchGoogle: true };
    }

    // ═══ P4: Search for X (generic) — "search for brokers in Miami" ═══
    // Must come before navigate to prevent "search for X" matching "go to" patterns
    const searchForMatch = line.match(/^(?:search\s+for|search|look\s+up|find)\s+(.+)/i);
    if (searchForMatch) {
      const query = searchForMatch[1].replace(/['"]/g, '').trim();
      // Don't match "look for a contact form" — that's smart_click (P20)
      if (/^(?:a\s+)?(?:contact|submit|sign\s*up|subscribe|login|log\s*in)\s+(?:form|button|field|link)/i.test(query)) {
        return { action: 'smart_click', target: query };
      }
      return { action: 'type', text: query, _pressEnterAfter: true };
    }

    // ═══ P5: Navigate — "go to X" / "navigate to X" / "open X" / "visit X" ═══
    const navMatch = line.match(/(?:go\s+to|navigate\s+to|open|visit|browse\s+to|head\s+to)\s+(.+)/i);
    if (navMatch) {
      let target = navMatch[1].replace(/['"]/g, '').trim();
      // Check if target looks like a URL (has a dot with valid TLD pattern)
      const looksLikeUrl = /^(?:https?:\/\/)?[a-z0-9][\w.-]*\.[a-z]{2,}/i.test(target);
      if (looksLikeUrl) {
        let url = target;
        if (!url.startsWith('http')) url = 'https://' + url;
        return { action: 'navigate', url };
      }
      // Not a URL — it's a section/page navigation ("go to our pipeline", "go to settings")
      return { action: 'click_text', text: target };
    }

    // ═══ P6: Edit field — "fill in X with Y" / "enter X in Y field" ═══
    const fillMatch = line.match(/(?:fill\s+(?:in|out)\s+(?:the\s+)?(.+?)\s+(?:with|as|to)\s+(.+))/i);
    if (fillMatch) {
      return { action: 'edit_field', target: fillMatch[1].trim(), text: fillMatch[2].trim() };
    }
    // "enter X in the Y field" / "put X in the Y box"
    const enterInFieldMatch = line.match(/(?:enter|put|input|write)\s+(.+?)\s+(?:in|into|on)\s+(?:the\s+)?(.+?)\s*(?:field|input|box|area|textbox|bar|form)\s*$/i);
    if (enterInFieldMatch) {
      return { action: 'edit_field', target: enterInFieldMatch[2].trim(), text: enterInFieldMatch[1].trim() };
    }

    // ═══ P7: Type quoted text — type "hello world" ═══
    const typeQuotedMatch = line.match(/(?:type|enter|input|write|put)\s+['"]([^'"]+)['"]/i);
    if (typeQuotedMatch) {
      return { action: 'type', text: typeQuotedMatch[1] };
    }

    // ═══ P8: Type unquoted — "type hello world" ═══
    // Only split on "in/into/on" when followed by a field indicator word
    const typeFieldMatch = line.match(/(?:type|enter|input)\s+(.+?)\s+(?:in|into|on)\s+(?:the\s+)?(.+?)\s*(?:field|input|box|area|textbox|bar|form)\s*$/i);
    if (typeFieldMatch) {
      return { action: 'type', text: typeFieldMatch[1].replace(/['"]/g, '').trim(), target: typeFieldMatch[2].trim() };
    }
    // Plain type without field split — "type brokers in Miami" keeps full text
    const typePlainMatch = line.match(/^(?:type|enter|input)\s+(.+)/i);
    if (typePlainMatch && !navMatch) {
      return { action: 'type', text: typePlainMatch[1].replace(/['"]/g, '').trim() };
    }

    // ═══ P9: Press key — "press Enter", "hit Tab", "tap Escape" ═══
    const pressMatch = line.match(/(?:press|hit|tap)\s+(?:the\s+)?(?:(?:Enter|Return)|(?:Tab)|(?:Escape|Esc)|(?:Space|Spacebar)|(?:Delete|Backspace)|(?:Arrow\s*(?:Up|Down|Left|Right)))\s*$/i);
    if (pressMatch) {
      let key = line.match(/(?:press|hit|tap)\s+(?:the\s+)?([\w\s]+)\s*$/i)[1].trim().toLowerCase();
      // Normalize key names
      if (key === 'return') key = 'enter';
      if (key === 'esc') key = 'escape';
      if (key === 'spacebar') key = 'space';
      if (key === 'backspace') key = 'delete';
      key = key.replace(/arrow\s*/i, '').trim();
      return { action: 'press', key };
    }

    // ═══ P10: Click submit/sign in/log in ═══
    const submitMatch = line.match(/(?:click|tap|press|hit)\s+(?:on\s+)?(?:the\s+)?['"]?(.+?)['"]?\s*$/i);
    if (submitMatch) {
      const target = submitMatch[1].replace(/['"]/g, '').trim();
      if (/^(?:submit|sign\s*in|log\s*in|login|sign\s*up|register)\s*(?:button)?$/i.test(target)) {
        return { action: 'click_submit' };
      }
    }

    // ═══ P11: Click / Tap / Select — "click the search button", "select Miami" ═══
    const clickMatch = line.match(/(?:click|tap|select|choose|pick)\s+(?:on\s+)?(?:the\s+)?['"]?(.+?)['"]?\s*$/i);
    if (clickMatch) {
      const target = clickMatch[1].replace(/['"]/g, '').trim();
      if (target.length > 0) {
        return { action: 'click_text', text: target };
      }
    }

    // ═══ P12: Wait N seconds — "wait 3 seconds", "wait 5s" ═══
    const waitMatch = lower.match(/wait\s+(?:for\s+)?(\d+)\s*(?:seconds?|secs?|s)\b/i);
    if (waitMatch) {
      return { action: 'wait', ms: parseInt(waitMatch[1]) * 1000 };
    }

    // ═══ P13: Wait for page/element — "wait for the page to load", "wait for results" ═══
    if (/wait\s+(?:for\s+)?(?:the\s+)?(?:page|site|website)\s*(?:to\s+load)?/i.test(lower)) {
      return { action: 'wait_navigation' };
    }
    const waitForMatch = line.match(/wait\s+(?:for\s+)?(?:the\s+)?(.+?)(?:\s+to\s+(?:load|appear|show|display|render))?\s*$/i);
    if (waitForMatch && /wait\s+for/i.test(lower)) {
      return { action: 'wait', ms: 3000 };
    }

    // ═══ P14: Generic wait — just "wait" or "pause" ═══
    if (/^(?:wait|pause|hold)\s*$/i.test(lower)) {
      return { action: 'wait', ms: 2000 };
    }

    // ═══ P15: Copy — "copy the email address" ═══
    const copyMatch = line.match(/copy\s+(?:the\s+)?(.+)/i);
    if (copyMatch && !/copy\s+event/i.test(lower)) {
      // Don't match "copy event" — that's a click action (Eventbrite)
      return { action: 'copy_text', target: copyMatch[1].trim() };
    }

    // ═══ P16: Extract / Scrape — "extract all phone numbers", "scrape the results" ═══
    const extractMatch = line.match(/(?:extract|scrape|grab|collect|pull)\s+(?:the\s+)?(?:all\s+)?(.+)/i);
    if (extractMatch) {
      return { action: 'copy_text', target: extractMatch[1].trim() };
    }

    // ═══ P18: Scroll — "scroll down", "scroll up 500px" ═══
    if (/scroll\s+(?:down|up)/i.test(lower)) {
      const direction = /scroll\s+up/i.test(lower) ? 'up' : 'down';
      const amountMatch = lower.match(/scroll\s+(?:down|up)\s+(\d+)/i);
      return { action: 'scroll', direction, amount: amountMatch ? parseInt(amountMatch[1]) : 500 };
    }

    // ═══ P19: Log in with credentials — "log in with credentials", "sign in with saved password" ═══
    if (/(?:log\s*in|sign\s*in)\s+(?:to\s+)?(?:with\s+)?(?:my\s+)?(?:saved\s+)?(?:credentials|password|account)/i.test(lower)) {
      return { action: 'edit_field', target: 'login credentials', text: '{{credentials}}' };
    }

    // ═══ P20: Look for element — "look for a contact form", "find a submit button" ═══
    if (/(?:look\s+for|find|locate|spot)\s+(?:a\s+)?(?:contact|submit|sign\s*up|subscribe|login|log\s*in|search|email|phone|newsletter)?\s*(?:form|button|field|link|input|box|area)/i.test(lower)) {
      const lookMatch = line.match(/(?:look\s+for|find|locate|spot)\s+(.+)/i);
      return { action: 'smart_click', target: lookMatch ? lookMatch[1].trim() : 'interactive element' };
    }

    // ═══ P21: Set date — "set date to March 15", "change the date", "update the date" ═══
    const dateMatch = line.match(/(?:set|change|update|modify|pick|select)\s+(?:the\s+)?date\s+(?:to\s+)?(.+)?/i);
    if (dateMatch) {
      return { action: 'edit_field', target: 'date field', text: dateMatch[1]?.trim() || '' };
    }

    // ═══ P23: No catch-all — return null if nothing matched ═══
    // This is intentional. Unknown lines should NOT become click_text.
    // The caller (parseText) will log these as skipped for debugging.
    return null;
  }

  /**
   * Generate a name for the SOP from text and steps
   */
  generateName(text, steps) {
    // Try to build a meaningful name from the first navigate + first action
    const navStep = steps.find(s => s.action === 'navigate');
    const actionStep = steps.find(s =>
      s.action !== 'navigate' && s.action !== 'wait_navigation' &&
      s.action !== 'wait' && !s._implicit
    );

    if (navStep && actionStep) {
      // Extract domain from URL
      try {
        const domain = new URL(navStep.url).hostname.replace('www.', '');
        const actionDesc = actionStep.description || this.describeStep(actionStep);
        const name = `${domain}: ${actionDesc}`;
        if (name.length <= 60) return name;
        return name.substring(0, 57) + '...';
      } catch (e) { /* fall through */ }
    }

    // Fallback: cleaned text
    const clean = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= 60) return clean;
    return clean.substring(0, 57) + '...';
  }

  /**
   * Generate a human-readable description for a step
   */
  describeStep(step) {
    switch (step.action) {
      case 'navigate': return `Go to ${step.url}`;
      case 'click_text': return `Click on "${step.text}"`;
      case 'click_submit': return 'Click the submit/login button';
      case 'smart_click': return `Click on ${step.target || 'element'} (AI vision)`;
      case 'right_click': return `Right-click on ${step.target || 'element'}`;
      case 'select_option': return `Select "${step.text || 'option'}" from ${step.target || 'dropdown'}`;
      case 'hover': return `Hover over ${step.target || 'element'}`;
      case 'edit_field': return `Type "${step.text || '...'}" in ${step.target || 'field'}`;
      case 'type': {
        if (step.contentInjection) return 'Type the provided content';
        return `Type "${step.text}"${step.target ? ` in ${step.target}` : ''}`;
      }
      case 'press': return `Press ${(step.key || 'key').charAt(0).toUpperCase() + (step.key || 'key').slice(1)}`;
      case 'scroll': return `Scroll ${step.direction || 'down'}`;
      case 'switch_tab': return `Switch to ${step.target || 'next'} tab`;
      case 'go_back': return 'Go back to previous page';
      case 'copy_text': return `Copy ${step.target || 'text'}`;
      case 'wait': return `Wait ${(step.ms || 2000) / 1000} seconds`;
      case 'wait_navigation': return 'Wait for page to load';
      default: return step.action;
    }
  }

  /**
   * Check if the SOP description implies dynamic content is needed.
   * Looks for phrases that suggest the user will provide content when triggering.
   */
  _descriptionNeedsContent(text) {
    const lower = (text || '').toLowerCase();
    const hints = [
      'paste', 'pasting', 'the information', 'the content', 'the data', 'the text',
      'the message', 'whatever we', 'whatever you', 'what we', 'what you',
      'we gave you', 'we give you', 'we provide', 'we tell you', 'we ask',
      'provided content', 'given content', 'supplied content',
      'post the', 'share the', 'publish the', 'send the',
      'by typing', 'by entering', 'by writing', 'by putting',
    ];
    return hints.some(h => lower.includes(h));
  }

  /**
   * Find the best position to insert a {{content}} type step.
   * Inserts BEFORE the first submit-like click (Next, Post, Submit, Send, etc.)
   * or at the end if no submit found.
   */
  _findContentInsertionPoint(steps) {
    const submitWords = ['next', 'post', 'submit', 'send', 'save', 'done', 'confirm', 'publish', 'share', 'ok', 'continue'];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.action === 'click_submit') return i;
      if (s.action === 'click_text' || s.action === 'click') {
        const lower = (s.text || s.description || '').toLowerCase();
        if (submitWords.some(w => lower.includes(w))) return i;
      }
    }
    // No submit found — insert before last step or at end
    return steps.length > 1 ? steps.length - 1 : steps.length;
  }

  /**
   * Parse an uploaded document into structured SOP steps using AI.
   * Routes to Gemini for intelligent document understanding.
   * AI optimizes the workflow — adding, removing, or restructuring steps for smooth automation.
   *
   * @param {string} text - Extracted text content from a document (PDF, DOCX, TXT)
   * @param {string} [docName] - Original filename for context
   * @returns {Promise<{ steps: Array, name: string, description: string }>}
   */
  async parseDocument(text, docName = '') {
    if (!text || typeof text !== 'string') {
      return { steps: [], name: 'Untitled SOP', description: '' };
    }

    // Clean up document text — remove excessive whitespace, page numbers, headers/footers
    const cleaned = text
      .replace(/Page\s+\d+\s*(of\s+\d+)?/gi, '')           // Page numbers
      .replace(/^\s*\d+\s*$/gm, '')                          // Standalone page numbers
      .replace(/\r\n/g, '\n')                                 // Normalize line endings
      .replace(/\n{4,}/g, '\n\n\n')                          // Collapse excessive blank lines
      .replace(/[\t ]{3,}/g, '  ')                           // Collapse excessive spaces
      .trim();

    if (!cleaned) {
      return { steps: [], name: 'Untitled SOP', description: '' };
    }

    // Detect if the document has its own numbering
    const numberedLines = cleaned.match(/^\s*(?:\d+[\.\):]|step\s+\d+)/gmi);
    const docStepCount = numberedLines ? numberedLines.length : 0;
    const stepCountContext = docStepCount > 0
      ? `\nThe document appears to have ${docStepCount} numbered steps. Use this as a starting point, but you are free to adjust — add a step if something is missing for smooth automation (like a wait after navigation), remove steps that are just commentary and don't translate to a browser action, or merge steps that are really one action.`
      : '';

    // If AI is available, route to Gemini for intelligent parsing
    if (this.aiManager) {
      try {
        const prompt = `You are Ace, an expert automation assistant. A user uploaded an SOP document describing a business workflow. Your job is to understand the workflow and convert it into a clean, optimized sequence of browser automation steps.

DOCUMENT TEXT:
"""
${cleaned.substring(0, 8000)}
"""
${docName ? `\nOriginal filename: "${docName}"` : ''}${stepCountContext}

YOUR APPROACH:
1. Read the entire document and understand the INTENT of the workflow — what is the user trying to accomplish?
2. Identify the core actions (navigate, click, type, etc.) that make up this workflow
3. Optimize the sequence for smooth browser automation:
   - ADD a "wait_navigation" after any step that loads a new page (navigate, clicking a link)
   - ADD a "wait" if there's a form submission or page transition that needs time
   - REMOVE steps that are just commentary, notes, or reminders that don't involve a browser action (e.g. "Remember to double-check", "Make sure you have access", "Note: this may take time")
   - MERGE steps if they're really the same action described in two parts
   - KEEP the document's wording in descriptions where it's helpful — the user wrote it that way for a reason
4. The final sequence should flow smoothly from start to finish when a bot executes it

ACTION REFERENCE (16 supported actions — use ONLY these):
| Action | Use when | Required fields |
|--------|----------|-----------------|
| navigate | Opening a URL | url |
| click_text | Clicking a button, link, tab, or menu item by its visible text | text |
| click_submit | Clicking a submit/login/save/send button | (none) |
| smart_click | Clicking something hard to describe by text (AI vision finds it) | target |
| right_click | Right-clicking for context menus | target |
| select_option | Clicking a dropdown then selecting an option | target, text |
| hover | Hovering over an element (for menus/tooltips) | target |
| edit_field | Clicking a field, clearing it, and typing new text | target, text |
| type | Typing text into a field | text |
| press | Pressing a keyboard key (Enter, Tab, Escape) | key |
| scroll | Scrolling the page | direction (up/down) |
| switch_tab | Switching browser tabs | target (tab # or "next"/"previous") |
| go_back | Going back to previous page | (none) |
| copy_text | Copying text from the page | target |
| wait | Pausing for a set time | ms (milliseconds) |
| wait_navigation | Waiting for a full page load after clicking a link | (none) |

SPECIAL CASES:
- If the document mentions typing/entering data that will vary each time (user-provided content), use: { "action": "type", "text": "{{content}}", "contentInjection": true }
- If a step says "log in" or "sign in", use edit_field for username + edit_field for password + click_submit
- If a step is vague like "review the results", use smart_click — Ace's AI vision will handle it

Return ONLY valid JSON:
{
  "name": "Short SOP name (max 60 chars)",
  "description": "One sentence summary of what this workflow accomplishes",
  "steps": [
    { "action": "navigate", "url": "https://example.com", "description": "Open the CRM dashboard" },
    { "action": "wait_navigation", "description": "Wait for page to load" },
    { "action": "click_text", "text": "New Lead", "description": "Click New Lead button" }
  ]
}`;

        // Route to Gemini — this is a heavy document understanding task
        const response = await this.aiManager.chat(prompt, {
          temperature: 0.2,
          provider: 'gemini',
        });
        const content = typeof response === 'string' ? response : response?.content || response?.text || '';

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
            // Normalize AI-generated steps to unified action types
            const validSteps = this._validateAndFixSteps(parsed.steps)
              .map(s => ({ ...s, description: s.description || this.describeStep(s) }));

            if (validSteps.length > 0) {
              return {
                steps: validSteps,
                name: parsed.name || this._nameFromFilename(docName) || 'Imported SOP',
                description: parsed.description || cleaned.substring(0, 200),
              };
            }
          }
        }
      } catch (e) {
        console.warn('[SOPParser] AI document parsing failed, falling back to rule-based:', e.message);
      }
    }

    // Fallback: rule-based parsing of the document text
    return this.parseText(cleaned);
  }

  /**
   * Extract a clean SOP name from a filename
   */
  _nameFromFilename(filename) {
    if (!filename) return null;
    return filename
      .replace(/\.[^.]+$/, '')                     // Remove extension
      .replace(/[_-]+/g, ' ')                      // Underscores/dashes to spaces
      .replace(/\b\w/g, c => c.toUpperCase())      // Title case
      .trim();
  }

  /**
   * Validate SOP steps structure
   */
  validateSteps(steps) {
    const errors = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.action) {
        errors.push(`Step ${i + 1}: missing action`);
      } else if (!UNIFIED_ACTIONS.includes(step.action) && !ACTION_ALIASES[step.action]) {
        errors.push(`Step ${i + 1}: unknown action "${step.action}"`);
      }
      // Required field checks
      if (step.action === 'navigate' && !step.url) {
        errors.push(`Step ${i + 1}: navigate requires url`);
      }
      if (step.action === 'type' && !step.text) {
        errors.push(`Step ${i + 1}: type requires text`);
      }
      if (step.action === 'click_text' && !step.text) {
        errors.push(`Step ${i + 1}: click_text requires text`);
      }
      if (step.action === 'press' && !step.key) {
        errors.push(`Step ${i + 1}: press requires key`);
      }
      if (step.action === 'edit_field' && !step.target && !step.text) {
        errors.push(`Step ${i + 1}: edit_field requires target or text`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

export default SOPParser;
