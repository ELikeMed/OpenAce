/**
 * BusinessCategorizer — Uses AI to classify discovered businesses
 *
 * Takes raw Google Places data and enriches it with:
 * - Business category (medical, office, legal, school, etc.)
 * - Estimated headcount
 * - Best outreach approach
 * - Weekday relevance score (1-10)
 */

export class BusinessCategorizer {
  constructor({ aiManager }) {
    this.aiManager = aiManager;
  }

  /**
   * Categorize a batch of prospects in a single AI call (cost-efficient)
   * Processes up to 15 at a time to stay within token limits
   */
  async batchCategorize(prospects) {
    const results = [];
    const batchSize = 15;

    for (let i = 0; i < prospects.length; i += batchSize) {
      const batch = prospects.slice(i, i + batchSize);
      const batchResults = await this._categorizeBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  async _categorizeBatch(prospects) {
    const businessList = prospects.map((p, i) => (
      `${i + 1}. "${p.name}" — Types: [${(p.googleTypes || []).join(', ')}], Address: ${p.address}, Website: ${p.website || 'none'}`
    )).join('\n');

    const prompt = `You are a business analyst helping a local business find nearby prospects for B2B outreach.

Analyze each business below and return a JSON array with one object per business. Each object must have:
- "category": one of: "medical", "office", "legal", "dental", "school", "financial", "insurance", "fitness", "religious", "automotive", "retail", "other"
- "subcategory": more specific (e.g., "law_firm", "dental_office", "elementary_school", "accounting_firm")
- "estimatedHeadcount": number — rough estimate of employees/staff
- "bestApproach": one of: "team_breakfast", "lunch_delivery", "shift_change_meals", "meeting_catering", "faculty_meals", "individual_outreach"
- "weekdayRelevance": 1-10 — how likely are they to be a good outreach target? (10 = very likely, 1 = unlikely)
- "suggestedMessage": a short, casual 1-2 sentence outreach pitch to this business

Businesses to analyze:
${businessList}

Return ONLY a valid JSON array. No markdown, no explanation.`;

    try {
      const response = await this.aiManager.chat(
        [{ role: 'user', content: prompt }],
        { maxTokens: 3000 }
      );

      const content = response.content || response;
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('AI categorization: no JSON array found in response');
        return prospects.map(() => this._defaultCategory());
      }

      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure we have the right number of results
      return prospects.map((_, i) => parsed[i] || this._defaultCategory());

    } catch (err) {
      console.error('AI categorization error:', err.message);
      return prospects.map(() => this._defaultCategory());
    }
  }

  /**
   * Categorize a single prospect
   */
  async categorize(prospect) {
    const results = await this.batchCategorize([prospect]);
    return results[0];
  }

  _defaultCategory() {
    return {
      category: 'other',
      subcategory: 'unknown',
      estimatedHeadcount: 5,
      bestApproach: 'individual_outreach',
      weekdayRelevance: 5,
      suggestedMessage: ''
    };
  }
}
