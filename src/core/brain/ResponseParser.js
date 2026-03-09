/**
 * ResponseParser — Shared parsing for ACE_QUESTION and ACE_ACTIONS tags.
 * Extracted from DepartmentAgent.handle() so UnifiedAgent can reuse it.
 */

export class ResponseParser {
  /**
   * Parse ACE_QUESTION tags from AI response text.
   * Returns { cleanText, question } where question is null if none found.
   */
  static parseQuestionCards(text) {
    let cleanText = text;
    let question = null;

    // Primary format: [ACE_QUESTION]{...}[/ACE_QUESTION]
    const questionMatch = cleanText.match(/\[ACE_QUESTION\]([\s\S]*?)\[\/ACE_QUESTION\]/);
    if (questionMatch) {
      try {
        const parsed = JSON.parse(questionMatch[1].trim());
        if (Array.isArray(parsed.options) && parsed.options.length > 0) {
          question = {
            options: parsed.options.map((opt, i) => ({
              id: opt.id || i + 1,
              label: opt.label || `Option ${i + 1}`,
              description: opt.description || '',
            })),
            allowCustom: parsed.allowCustom !== false,
          };
        }
      } catch (e) { /* malformed JSON — ignore */ }
      cleanText = cleanText.replace(/\[ACE_QUESTION\][\s\S]*?\[\/ACE_QUESTION\]/g, '').trim();
    }

    // Fallback: model used markdown format — ### ACE_QUESTION\n```json\n{...}\n```
    if (!question) {
      const mdQMatch = cleanText.match(/#{1,4}\s*ACE_QUESTION[^\n]*\n```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (mdQMatch) {
        try {
          const parsed = JSON.parse(mdQMatch[1].trim());
          if (Array.isArray(parsed.options) && parsed.options.length > 0) {
            question = {
              options: parsed.options.map((opt, i) => ({
                id: opt.id || i + 1,
                label: opt.label || `Option ${i + 1}`,
                description: opt.description || '',
              })),
              allowCustom: parsed.allowCustom !== false,
            };
          }
        } catch (e) { /* malformed JSON — ignore */ }
        cleanText = cleanText.replace(/#{1,4}\s*ACE_QUESTION[^\n]*\n```(?:json)?\s*[\s\S]*?\s*```/gi, '').trim();
      }
    }

    return { cleanText, question };
  }

  /**
   * Parse ACE_ACTIONS tags from AI response text.
   * Returns { cleanText, pendingActions } where pendingActions is null if none found.
   */
  static parseActionTags(text) {
    let cleanText = text;
    let pendingActions = null;

    // Primary format: [ACE_ACTIONS]{...}[/ACE_ACTIONS]
    const actionsMatch = cleanText.match(/\[ACE_ACTIONS\]([\s\S]*?)\[\/ACE_ACTIONS\]/);
    if (actionsMatch) {
      try {
        const parsed = JSON.parse(actionsMatch[1].trim());
        if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
          pendingActions = parsed.actions;
        }
      } catch (e) { /* malformed JSON — ignore */ }
      cleanText = cleanText.replace(/\[ACE_ACTIONS\][\s\S]*?\[\/ACE_ACTIONS\]/g, '').trim();
    }

    // Fallback: model used markdown format
    if (!pendingActions) {
      const mdMatch = cleanText.match(/#{1,4}\s*ACE_ACTIONS[^\n]*\n```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (mdMatch) {
        try {
          const parsed = JSON.parse(mdMatch[1].trim());
          if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
            pendingActions = parsed.actions;
          }
        } catch (e) { /* malformed JSON — ignore */ }
        cleanText = cleanText.replace(/#{1,4}\s*ACE_ACTIONS[^\n]*\n```(?:json)?\s*[\s\S]*?\s*```/gi, '').trim();
      }
    }

    return { cleanText, pendingActions };
  }

  /**
   * Strip all bracket-enclosed directive tags the AI might generate.
   * [ACTION:...], [SEARCH:...], [BROWSE:...], etc.
   */
  static stripDirectiveTags(text) {
    let clean = text;
    clean = clean.replace(/\[(?:ACTION|EMAIL ACTION|SEARCH|CALLOUT|IMAGE|BACKGROUND|BROWSE|NAVIGATE|CLICK|RESEARCH|TASK|SAVE)[:\s][^\[\]]*(?:\{[\s\S]*?\})?[^\[\]]*\]/gi, '').trim();
    clean = clean.replace(/\[?\$?[A-Z_]+:\w*[:\{][^\]]*\]?\]?/g, '').trim();
    clean = clean.replace(/\[[A-Z_ ]+:[^\]]*\]/g, '').trim();
    clean = clean.replace(/^.*(?:Opening .* to search|Starting a web|I'm starting a|I'm opening).*$/gm, '').trim();
    clean = clean.replace(/#{1,4}\s*ACE_(?:ACTIONS|QUESTION)\s*$/gim, '').trim();
    clean = clean.replace(/\n{3,}/g, '\n\n').trim();
    return clean;
  }

  /**
   * Full parse — extract questions, actions, strip tags, return clean result.
   */
  static parse(text) {
    const { cleanText: t1, pendingActions } = ResponseParser.parseActionTags(text);
    const { cleanText: t2, question } = ResponseParser.parseQuestionCards(t1);
    const cleanText = ResponseParser.stripDirectiveTags(t2);
    return { cleanText, question, pendingActions };
  }
}
