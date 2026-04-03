/**
 * SeoToolkit.js — 4 SEO & Blog Generation tools for the OpenAce Embed SDK.
 *
 * These are embed-only tools (not available in the desktop app).
 * They use standard Node fetch (no external dependencies) and the
 * shared aiManager.chat() interface for AI calls.
 *
 * Tools:
 *   1. analyze_seo      — Fetch a URL, parse HTML, return a scored SEO report
 *   2. generate_blog_post — Multi-step AI blog generation with SEO optimization
 *   3. optimize_page_seo — Fetch a page + target keywords, return actionable fixes
 *   4. generate_structured_data — Create JSON-LD schema.org markup
 */

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return raw HTML. Follows redirects, 10 s timeout.
 */
async function fetchHTML(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenAce-SEO/1.0 (+https://openaceai.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Minimal regex-based HTML parser. Returns structured data for SEO analysis.
 * No dependency on cheerio / jsdom — pure regex for the tags we care about.
 */
function parseHTML(html) {
  const get = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };
  const getAll = (re) => { const out = []; let m; while ((m = re.exec(html)) !== null) out.push(m); return out; };

  // Title
  const title = get(/<title[^>]*>([\s\S]*?)<\/title>/i);

  // Meta tags
  const metaDesc = get(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)
    || get(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  const robots = get(/<meta[^>]+name=["']robots["'][^>]+content=["']([\s\S]*?)["']/i)
    || get(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']robots["']/i);
  const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i)
    || get(/<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["']/i);

  // Open Graph
  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i)
    || get(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:title["']/i);
  const ogDesc = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i)
    || get(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["']/i);
  const ogImage = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["']/i)
    || get(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:image["']/i);

  // Headings
  const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
  const headingRe = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm;
  while ((hm = headingRe.exec(html)) !== null) {
    const tag = hm[1].toLowerCase();
    const text = hm[2].replace(/<[^>]+>/g, '').trim();
    if (headings[tag]) headings[tag].push(text);
  }

  // Images
  const imgRe = /<img[^>]*>/gi;
  const imgs = html.match(imgRe) || [];
  const totalImages = imgs.length;
  const imgsWithAlt = imgs.filter(i => /alt=["'][^"']+["']/i.test(i)).length;

  // Links
  const linkRe = /<a[^>]+href=["']([^"'#][^"']*)["']/gi;
  const links = { internal: 0, external: 0 };
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const href = lm[1];
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      links.external++;
    } else {
      links.internal++;
    }
  }

  // JSON-LD
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jsonLdBlocks = [];
  let jm;
  while ((jm = jsonLdRe.exec(html)) !== null) {
    try { jsonLdBlocks.push(JSON.parse(jm[1].trim())); } catch { /* skip malformed */ }
  }

  return {
    title,
    metaDesc,
    robots,
    canonical,
    og: { title: ogTitle, description: ogDesc, image: ogImage },
    headings,
    images: { total: totalImages, withAlt: imgsWithAlt },
    links,
    jsonLd: jsonLdBlocks,
  };
}

/**
 * Score the parsed SEO data on a 0-100 scale with per-check details.
 */
function scoreSEO(parsed, url) {
  const checks = [];
  let score = 0;
  let maxScore = 0;

  const add = (name, points, pass, detail, fix) => {
    maxScore += points;
    if (pass) score += points;
    checks.push({ name, points, pass, detail, ...(fix && !pass ? { fix } : {}) });
  };

  // Title (15 pts)
  if (parsed.title) {
    const len = parsed.title.length;
    const ideal = len >= 30 && len <= 65;
    add('Title Tag', 10, true, `Present (${len} chars)`, null);
    add('Title Length', 5, ideal,
      ideal ? `Good length (${len} chars)` : `${len} chars — aim for 50-60`,
      `Rewrite title to 50-60 characters. Current: "${parsed.title}"`);
  } else {
    add('Title Tag', 15, false, 'Missing', 'Add a <title> tag with 50-60 characters including your primary keyword.');
  }

  // Meta description (15 pts)
  if (parsed.metaDesc) {
    const len = parsed.metaDesc.length;
    const ideal = len >= 120 && len <= 165;
    add('Meta Description', 10, true, `Present (${len} chars)`, null);
    add('Meta Description Length', 5, ideal,
      ideal ? `Good length (${len} chars)` : `${len} chars — aim for 150-160`,
      `Rewrite meta description to 150-160 characters. Include your primary keyword naturally.`);
  } else {
    add('Meta Description', 15, false, 'Missing', 'Add a meta description of 150-160 characters with your target keyword.');
  }

  // Open Graph (10 pts)
  add('OG Title', 3, !!parsed.og.title, parsed.og.title ? 'Present' : 'Missing',
    'Add <meta property="og:title" content="..."> for better social sharing.');
  add('OG Description', 3, !!parsed.og.description, parsed.og.description ? 'Present' : 'Missing',
    'Add <meta property="og:description" content="..."> for social previews.');
  add('OG Image', 4, !!parsed.og.image, parsed.og.image ? 'Present' : 'Missing',
    'Add <meta property="og:image" content="..."> — posts with images get 2x more engagement.');

  // Heading structure (15 pts)
  const h1Count = parsed.headings.h1.length;
  add('Single H1', 8, h1Count === 1,
    h1Count === 0 ? 'No H1 found' : h1Count === 1 ? `1 H1: "${parsed.headings.h1[0]}"` : `${h1Count} H1 tags (should be exactly 1)`,
    h1Count === 0 ? 'Add exactly one <h1> tag containing your primary keyword.' : 'Reduce to a single <h1>. Use <h2> for sub-sections.');
  const hasH2 = parsed.headings.h2.length > 0;
  add('H2 Subheadings', 4, hasH2, hasH2 ? `${parsed.headings.h2.length} H2 tags` : 'No H2 tags',
    'Add <h2> subheadings to break up content. Include secondary keywords.');
  const hasHierarchy = h1Count > 0 && hasH2;
  add('Heading Hierarchy', 3, hasHierarchy, hasHierarchy ? 'H1 > H2 structure present' : 'Incomplete hierarchy',
    'Ensure a clear H1 > H2 > H3 heading hierarchy for better crawlability.');

  // Image alt text (10 pts)
  if (parsed.images.total > 0) {
    const pct = Math.round((parsed.images.withAlt / parsed.images.total) * 100);
    add('Image Alt Text', 10, pct >= 80,
      `${parsed.images.withAlt}/${parsed.images.total} images have alt text (${pct}%)`,
      `Add descriptive alt text to all images. ${parsed.images.total - parsed.images.withAlt} images are missing alt attributes.`);
  } else {
    add('Image Alt Text', 10, true, 'No images found (N/A)');
  }

  // Link ratio (10 pts)
  const totalLinks = parsed.links.internal + parsed.links.external;
  const hasInternalLinks = parsed.links.internal >= 2;
  add('Internal Links', 5, hasInternalLinks,
    `${parsed.links.internal} internal, ${parsed.links.external} external`,
    'Add at least 2-3 internal links to related pages on your site.');
  const ratio = totalLinks > 0 ? parsed.links.internal / totalLinks : 0;
  add('Link Ratio', 5, ratio >= 0.3 || totalLinks < 3,
    totalLinks > 0 ? `${Math.round(ratio * 100)}% internal` : 'No links found',
    'Increase internal links. Aim for at least 30% of links pointing to your own site.');

  // JSON-LD (10 pts)
  add('Structured Data (JSON-LD)', 10, parsed.jsonLd.length > 0,
    parsed.jsonLd.length > 0 ? `${parsed.jsonLd.length} JSON-LD block(s) found` : 'No structured data',
    'Add JSON-LD structured data (Article, FAQ, Organization, etc.) for rich snippets in search results and LLM citations.');

  // Canonical (5 pts)
  add('Canonical URL', 5, !!parsed.canonical, parsed.canonical ? `Set to: ${parsed.canonical}` : 'Missing',
    'Add <link rel="canonical" href="..."> to prevent duplicate content issues.');

  // Robots (5 pts)
  const robotsOk = !parsed.robots || !parsed.robots.includes('noindex');
  add('Robots Meta', 5, robotsOk,
    parsed.robots ? `Value: "${parsed.robots}"` : 'Not set (defaults to index, follow)',
    parsed.robots?.includes('noindex') ? 'Remove "noindex" from robots meta to allow search engine indexing.' : null);

  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return { score: finalScore, maxScore, earnedPoints: score, checks };
}

/**
 * Slugify a title string.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool 1: analyze_seo
// ──────────────────────────────────────────────────────────────────────────────

export async function toolAnalyzeSeo(args, ctx) {
  const { url } = args;
  if (!url) return JSON.stringify({ success: false, error: 'url is required' });

  ctx.onProgress?.('Fetching page...');

  let html;
  try {
    html = await fetchHTML(url);
  } catch (err) {
    return JSON.stringify({ success: false, error: `Failed to fetch URL: ${err.message}` });
  }

  ctx.onProgress?.('Analyzing SEO...');

  const parsed = parseHTML(html);
  const report = scoreSEO(parsed, url);

  // Build the top-level summary
  const failedChecks = report.checks.filter(c => !c.pass);
  const passedChecks = report.checks.filter(c => c.pass);

  const summary = {
    url,
    score: report.score,
    grade: report.score >= 90 ? 'A' : report.score >= 75 ? 'B' : report.score >= 60 ? 'C' : report.score >= 40 ? 'D' : 'F',
    passed: passedChecks.length,
    failed: failedChecks.length,
    total: report.checks.length,
  };

  // Actionable fix list (ordered by point value, highest first)
  const fixes = failedChecks
    .filter(c => c.fix)
    .sort((a, b) => b.points - a.points)
    .map(c => ({ issue: c.name, impact: c.points, suggestion: c.fix }));

  // Structured snapshot
  const snapshot = {
    title: parsed.title,
    metaDescription: parsed.metaDesc,
    canonical: parsed.canonical,
    robots: parsed.robots,
    og: parsed.og,
    h1: parsed.headings.h1,
    h2Count: parsed.headings.h2.length,
    h3Count: parsed.headings.h3.length,
    images: parsed.images,
    links: parsed.links,
    jsonLdTypes: parsed.jsonLd.map(j => j['@type'] || 'unknown'),
  };

  return JSON.stringify({
    success: true,
    summary,
    snapshot,
    checks: report.checks,
    fixes,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool 2: generate_blog_post
// ──────────────────────────────────────────────────────────────────────────────

export async function toolGenerateBlogPost(args, ctx) {
  const {
    topic,
    target_keywords = [],
    tone = 'professional',
    length = 'medium',
  } = args;

  if (!topic) return JSON.stringify({ success: false, error: 'topic is required' });

  const aiManager = ctx.aiManager;
  if (!aiManager) return JSON.stringify({ success: false, error: 'AI manager not available' });

  const wordTarget = length === 'short' ? '600-800' : length === 'long' ? '1800-2500' : '1000-1400';
  const keywordsStr = target_keywords.length > 0
    ? `Target keywords: ${target_keywords.join(', ')}`
    : 'No specific keywords provided — infer the best ones from the topic.';

  // ── Step 1: Generate SEO-optimized outline (use free/Gemini tier) ──
  ctx.onProgress?.('Generating SEO outline...');

  const outlinePrompt = [
    { role: 'user', content:
      `You are an SEO content strategist. Create a detailed blog post outline for the topic: "${topic}"

${keywordsStr}
Target tone: ${tone}
Target length: ${wordTarget} words

Return a JSON object (no markdown fences) with:
{
  "title": "SEO-optimized title (50-60 chars, includes primary keyword)",
  "slug": "url-friendly-slug",
  "primary_keyword": "main keyword",
  "secondary_keywords": ["kw1", "kw2", "kw3"],
  "meta_description": "150-160 char meta description with primary keyword",
  "sections": [
    { "heading": "H2 heading text", "key_points": ["point1", "point2"], "keyword_focus": "keyword to include" }
  ],
  "faq": [
    { "question": "...", "answer_hint": "brief direction for the answer" }
  ]
}

Return ONLY the JSON object.` }
  ];

  let outline;
  try {
    const outlineRaw = await aiManager.chat(outlinePrompt, { provider: 'gemini' });
    const cleaned = outlineRaw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    outline = JSON.parse(cleaned);
  } catch (err) {
    // Fallback: build a basic outline ourselves
    outline = {
      title: topic,
      slug: slugify(topic),
      primary_keyword: target_keywords[0] || topic.split(' ').slice(0, 3).join(' '),
      secondary_keywords: target_keywords.slice(1),
      meta_description: `Learn about ${topic}. A comprehensive guide covering everything you need to know.`,
      sections: [
        { heading: 'Introduction', key_points: ['Overview of the topic'], keyword_focus: target_keywords[0] || topic },
        { heading: 'Key Insights', key_points: ['Main analysis'], keyword_focus: target_keywords[1] || '' },
        { heading: 'Best Practices', key_points: ['Actionable advice'], keyword_focus: target_keywords[2] || '' },
        { heading: 'Conclusion', key_points: ['Summary and next steps'], keyword_focus: '' },
      ],
      faq: [],
    };
  }

  // ── Step 2: Write the prose (prefer Claude or GPT-4, fall back to Gemini) ──
  ctx.onProgress?.('Writing blog content...');

  const sectionsGuide = (outline.sections || [])
    .map((s, i) => `## ${s.heading}\nKey points: ${(s.key_points || []).join('; ')}${s.keyword_focus ? `\nNaturally include keyword: "${s.keyword_focus}"` : ''}`)
    .join('\n\n');

  const prosePrompt = [
    { role: 'user', content:
      `Write a complete blog post in Markdown following this outline exactly.

Title: ${outline.title}
Tone: ${tone}
Word count target: ${wordTarget}

Outline:
${sectionsGuide}

Guidelines:
- Use the H2 headings from the outline (## Heading)
- Write engaging, original prose — no filler
- Naturally weave in the primary keyword "${outline.primary_keyword}" 3-5 times
- Include secondary keywords where they fit: ${(outline.secondary_keywords || []).join(', ')}
- Start with a compelling opening paragraph (no heading above it)
- End with a clear conclusion and call-to-action
- Use short paragraphs (2-4 sentences)
- Include bullet points or numbered lists where appropriate
- Do NOT include meta description or frontmatter — just the article body in Markdown
- Do NOT wrap in markdown code fences

Write the full article now.` }
  ];

  // Try premium providers first for better prose quality
  let prose;
  const proseProviders = ['claude', 'openai', 'gemini'];
  for (const provider of proseProviders) {
    try {
      prose = await aiManager.chat(prosePrompt, { provider });
      if (prose && prose.length > 200) break;
    } catch {
      // Provider unavailable, try next
    }
  }

  if (!prose || prose.length < 100) {
    return JSON.stringify({ success: false, error: 'All AI providers failed to generate blog content.' });
  }

  // ── Step 3: SEO optimization pass (Gemini/free) ──
  ctx.onProgress?.('Optimizing for SEO...');

  const optimizePrompt = [
    { role: 'user', content:
      `You are an SEO editor. Review this blog post and return a JSON object (no markdown fences) with optimizations.

Title: ${outline.title}
Primary keyword: ${outline.primary_keyword}
Meta description: ${outline.meta_description}

Article:
${prose.slice(0, 6000)}

Return ONLY a JSON object:
{
  "optimized_title": "improved title if needed, or same title",
  "optimized_meta": "improved meta description (150-160 chars)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "internal_link_suggestions": ["topic that could link to another page on the site"],
  "keyword_density_ok": true/false,
  "heading_improvements": ["suggested change to a heading, if any"]
}` }
  ];

  let seoPass = {};
  try {
    const seoRaw = await aiManager.chat(optimizePrompt, { provider: 'gemini' });
    const cleaned = seoRaw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    seoPass = JSON.parse(cleaned);
  } catch {
    seoPass = {
      optimized_title: outline.title,
      optimized_meta: outline.meta_description,
      tags: [outline.primary_keyword, ...(outline.secondary_keywords || [])].slice(0, 5),
      internal_link_suggestions: [],
      keyword_density_ok: true,
      heading_improvements: [],
    };
  }

  // Build JSON-LD Article schema
  const finalTitle = seoPass.optimized_title || outline.title;
  const finalMeta = seoPass.optimized_meta || outline.meta_description;
  const finalSlug = outline.slug || slugify(finalTitle);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: finalTitle,
    description: finalMeta,
    keywords: (seoPass.tags || []).join(', '),
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    author: { '@type': 'Organization', name: ctx.businessName || 'Author' },
  };

  // Build FAQ schema if outline had FAQs
  let faqSchema = null;
  if (outline.faq && outline.faq.length > 0) {
    faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: outline.faq.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer_hint || f.question,
        },
      })),
    };
  }

  return JSON.stringify({
    success: true,
    title: finalTitle,
    slug: finalSlug,
    content: prose,
    meta_description: finalMeta,
    tags: seoPass.tags || [],
    structured_data: structuredData,
    faq_schema: faqSchema,
    internal_link_suggestions: seoPass.internal_link_suggestions || [],
    seo_notes: {
      keyword_density_ok: seoPass.keyword_density_ok,
      heading_improvements: seoPass.heading_improvements || [],
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool 3: optimize_page_seo
// ──────────────────────────────────────────────────────────────────────────────

export async function toolOptimizePageSeo(args, ctx) {
  const { url, target_keywords = [] } = args;
  if (!url) return JSON.stringify({ success: false, error: 'url is required' });
  if (!target_keywords.length) return JSON.stringify({ success: false, error: 'target_keywords array is required (at least one keyword)' });

  const aiManager = ctx.aiManager;

  ctx.onProgress?.('Fetching page for analysis...');

  let html;
  try {
    html = await fetchHTML(url);
  } catch (err) {
    return JSON.stringify({ success: false, error: `Failed to fetch URL: ${err.message}` });
  }

  const parsed = parseHTML(html);
  const primaryKw = target_keywords[0];
  const secondaryKws = target_keywords.slice(1);
  const recommendations = [];

  // ── Title tag ──
  if (!parsed.title) {
    recommendations.push({
      area: 'Title Tag',
      priority: 'high',
      current: null,
      suggestion: `Add a title tag: "${primaryKw} - ${secondaryKws[0] || 'Guide'} | Your Site"`,
      reason: 'Missing title tag is a critical SEO issue. Search engines display this in results.',
    });
  } else {
    const hasKeyword = parsed.title.toLowerCase().includes(primaryKw.toLowerCase());
    const goodLength = parsed.title.length >= 30 && parsed.title.length <= 65;
    if (!hasKeyword || !goodLength) {
      const issues = [];
      if (!hasKeyword) issues.push(`does not contain primary keyword "${primaryKw}"`);
      if (!goodLength) issues.push(`length is ${parsed.title.length} chars (aim for 50-60)`);
      recommendations.push({
        area: 'Title Tag',
        priority: 'high',
        current: parsed.title,
        suggestion: `Rewrite to include "${primaryKw}" near the start, 50-60 characters total.`,
        reason: issues.join('; '),
      });
    }
  }

  // ── Meta description ──
  if (!parsed.metaDesc) {
    recommendations.push({
      area: 'Meta Description',
      priority: 'high',
      current: null,
      suggestion: `Add a 150-160 character meta description naturally including "${primaryKw}".`,
      reason: 'Missing meta description. Google may auto-generate one that is less compelling.',
    });
  } else {
    const hasKw = parsed.metaDesc.toLowerCase().includes(primaryKw.toLowerCase());
    const goodLen = parsed.metaDesc.length >= 120 && parsed.metaDesc.length <= 165;
    if (!hasKw || !goodLen) {
      recommendations.push({
        area: 'Meta Description',
        priority: 'medium',
        current: parsed.metaDesc,
        suggestion: `Rewrite to 150-160 chars, include "${primaryKw}", and add a call-to-action.`,
        reason: !hasKw ? `Missing keyword "${primaryKw}"` : `Length is ${parsed.metaDesc.length} chars`,
      });
    }
  }

  // ── Heading structure ──
  const h1s = parsed.headings.h1;
  if (h1s.length === 0) {
    recommendations.push({
      area: 'H1 Heading',
      priority: 'high',
      current: null,
      suggestion: `Add an H1 heading that includes "${primaryKw}".`,
      reason: 'No H1 tag found. The H1 is one of the strongest on-page ranking signals.',
    });
  } else if (h1s.length > 1) {
    recommendations.push({
      area: 'H1 Heading',
      priority: 'medium',
      current: `${h1s.length} H1 tags: ${h1s.map(h => `"${h}"`).join(', ')}`,
      suggestion: 'Keep exactly one H1. Convert extras to H2.',
      reason: 'Multiple H1 tags dilute keyword relevance and confuse crawlers.',
    });
  } else {
    const h1HasKw = h1s[0].toLowerCase().includes(primaryKw.toLowerCase());
    if (!h1HasKw) {
      recommendations.push({
        area: 'H1 Heading',
        priority: 'medium',
        current: h1s[0],
        suggestion: `Rewrite H1 to include "${primaryKw}": e.g., "${primaryKw}: ${h1s[0]}"`,
        reason: 'H1 does not contain the primary keyword.',
      });
    }
  }

  // Check H2s for secondary keyword coverage
  const h2Texts = parsed.headings.h2.map(h => h.toLowerCase());
  const uncoveredKws = secondaryKws.filter(kw => !h2Texts.some(h => h.includes(kw.toLowerCase())));
  if (uncoveredKws.length > 0) {
    recommendations.push({
      area: 'H2 Subheadings',
      priority: 'medium',
      current: `${parsed.headings.h2.length} H2 tags`,
      suggestion: `Add H2 sections covering: ${uncoveredKws.map(k => `"${k}"`).join(', ')}`,
      reason: 'Secondary keywords not present in any H2, missing ranking opportunity.',
    });
  }

  // ── Generate FAQ schema for LLM search visibility ──
  ctx.onProgress?.('Generating FAQ schema...');

  let faqSchema = null;
  if (aiManager) {
    const faqPrompt = [
      { role: 'user', content:
        `Generate 5 FAQ questions and answers related to these keywords: ${target_keywords.join(', ')}

The page is about: ${parsed.title || url}

Return a JSON array (no markdown fences):
[
  { "question": "...", "answer": "2-3 sentence answer" }
]

Make questions natural and conversational (how people actually search).
Return ONLY the JSON array.` }
    ];

    try {
      const faqRaw = await aiManager.chat(faqPrompt, { provider: 'gemini' });
      const cleaned = faqRaw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      const faqItems = JSON.parse(cleaned);
      if (Array.isArray(faqItems) && faqItems.length > 0) {
        faqSchema = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map(f => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        };
      }
    } catch {
      // AI unavailable — skip FAQ generation
    }
  }

  // ── Internal linking suggestions ──
  const internalLinkSuggestions = [];
  if (parsed.links.internal < 3) {
    internalLinkSuggestions.push({
      suggestion: `Add ${3 - parsed.links.internal} more internal links to related pages on your site.`,
      reason: 'Internal links help search engines discover and rank your other pages.',
    });
  }
  for (const kw of target_keywords.slice(0, 3)) {
    internalLinkSuggestions.push({
      suggestion: `Link the phrase "${kw}" to a relevant page on your site (if one exists).`,
      reason: 'Keyword-rich anchor text for internal links boosts relevance for that term.',
    });
  }

  // ── Open Graph check ──
  if (!parsed.og.title || !parsed.og.description || !parsed.og.image) {
    const missing = [];
    if (!parsed.og.title) missing.push('og:title');
    if (!parsed.og.description) missing.push('og:description');
    if (!parsed.og.image) missing.push('og:image');
    recommendations.push({
      area: 'Open Graph Tags',
      priority: 'low',
      current: `Missing: ${missing.join(', ')}`,
      suggestion: `Add the missing OG tags for better social media sharing previews.`,
      reason: 'Open Graph tags control how your page appears when shared on social media.',
    });
  }

  // ── Image alt text ──
  if (parsed.images.total > 0) {
    const pct = Math.round((parsed.images.withAlt / parsed.images.total) * 100);
    if (pct < 80) {
      recommendations.push({
        area: 'Image Alt Text',
        priority: 'medium',
        current: `${pct}% of images have alt text (${parsed.images.withAlt}/${parsed.images.total})`,
        suggestion: `Add descriptive alt text to all images. Include "${primaryKw}" in at least one image alt.`,
        reason: 'Alt text helps image search ranking and accessibility.',
      });
    }
  }

  // Sort recommendations by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  return JSON.stringify({
    success: true,
    url,
    target_keywords,
    recommendations,
    faq_schema: faqSchema,
    faq_script_tag: faqSchema
      ? `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`
      : null,
    internal_link_suggestions: internalLinkSuggestions,
    current_snapshot: {
      title: parsed.title,
      meta_description: parsed.metaDesc,
      h1: parsed.headings.h1,
      h2_count: parsed.headings.h2.length,
      images: parsed.images,
      links: parsed.links,
      has_structured_data: parsed.jsonLd.length > 0,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool 4: generate_structured_data
// ──────────────────────────────────────────────────────────────────────────────

const SCHEMA_TEMPLATES = {
  Article: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline || data.title || '',
    description: data.description || '',
    image: data.image || undefined,
    datePublished: data.datePublished || new Date().toISOString().split('T')[0],
    dateModified: data.dateModified || data.datePublished || new Date().toISOString().split('T')[0],
    author: {
      '@type': data.authorType || 'Person',
      name: data.author || data.authorName || '',
      ...(data.authorUrl ? { url: data.authorUrl } : {}),
    },
    publisher: data.publisher ? {
      '@type': 'Organization',
      name: data.publisher,
      ...(data.publisherLogo ? { logo: { '@type': 'ImageObject', url: data.publisherLogo } } : {}),
    } : undefined,
    mainEntityOfPage: data.url || undefined,
    keywords: data.keywords || undefined,
  }),

  FAQ: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (data.questions || data.faq || []).map(q => ({
      '@type': 'Question',
      name: q.question || q.q || '',
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer || q.a || '',
      },
    })),
  }),

  HowTo: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name || data.title || '',
    description: data.description || '',
    totalTime: data.totalTime || undefined,
    estimatedCost: data.estimatedCost ? {
      '@type': 'MonetaryAmount',
      currency: data.currency || 'USD',
      value: data.estimatedCost,
    } : undefined,
    supply: (data.supplies || data.materials || []).map(s => ({
      '@type': 'HowToSupply',
      name: typeof s === 'string' ? s : s.name,
    })),
    tool: (data.tools || []).map(t => ({
      '@type': 'HowToTool',
      name: typeof t === 'string' ? t : t.name,
    })),
    step: (data.steps || []).map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name || step.title || `Step ${i + 1}`,
      text: step.text || step.description || '',
      image: step.image || undefined,
      url: step.url || undefined,
    })),
  }),

  LocalBusiness: (data) => ({
    '@context': 'https://schema.org',
    '@type': data.subType || 'LocalBusiness',
    name: data.name || '',
    description: data.description || '',
    image: data.image || undefined,
    telephone: data.phone || data.telephone || undefined,
    email: data.email || undefined,
    url: data.url || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.streetAddress || data.address || '',
      addressLocality: data.city || data.locality || '',
      addressRegion: data.state || data.region || '',
      postalCode: data.postalCode || data.zip || '',
      addressCountry: data.country || 'US',
    },
    geo: data.latitude && data.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: data.latitude,
      longitude: data.longitude,
    } : undefined,
    openingHoursSpecification: (data.hours || []).map(h => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days || h.dayOfWeek,
      opens: h.opens || h.open,
      closes: h.closes || h.close,
    })),
    priceRange: data.priceRange || undefined,
    aggregateRating: data.rating ? {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      reviewCount: data.reviewCount || undefined,
      bestRating: data.bestRating || 5,
    } : undefined,
  }),

  Organization: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name || '',
    description: data.description || '',
    url: data.url || '',
    logo: data.logo || undefined,
    foundingDate: data.foundingDate || undefined,
    founder: data.founder ? { '@type': 'Person', name: data.founder } : undefined,
    contactPoint: data.contactEmail || data.contactPhone ? {
      '@type': 'ContactPoint',
      email: data.contactEmail || undefined,
      telephone: data.contactPhone || undefined,
      contactType: data.contactType || 'customer service',
    } : undefined,
    sameAs: data.socialProfiles || data.sameAs || undefined,
    address: data.address || data.city ? {
      '@type': 'PostalAddress',
      streetAddress: data.streetAddress || data.address || '',
      addressLocality: data.city || '',
      addressRegion: data.state || '',
      postalCode: data.postalCode || '',
      addressCountry: data.country || 'US',
    } : undefined,
  }),

  Product: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name || '',
    description: data.description || '',
    image: data.image || undefined,
    sku: data.sku || undefined,
    brand: data.brand ? { '@type': 'Brand', name: data.brand } : undefined,
    offers: {
      '@type': 'Offer',
      url: data.url || undefined,
      priceCurrency: data.currency || 'USD',
      price: data.price || 0,
      availability: data.availability || 'https://schema.org/InStock',
      priceValidUntil: data.priceValidUntil || undefined,
      seller: data.seller ? { '@type': 'Organization', name: data.seller } : undefined,
    },
    aggregateRating: data.rating ? {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      reviewCount: data.reviewCount || undefined,
      bestRating: data.bestRating || 5,
    } : undefined,
    review: (data.reviews || []).slice(0, 5).map(r => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating || 5 },
      author: { '@type': 'Person', name: r.author || 'Reviewer' },
      reviewBody: r.text || r.body || '',
    })),
  }),

  Event: (data) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.name || data.title || '',
    description: data.description || '',
    startDate: data.startDate || '',
    endDate: data.endDate || undefined,
    eventStatus: data.status || 'https://schema.org/EventScheduled',
    eventAttendanceMode: data.online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: data.online ? {
      '@type': 'VirtualLocation',
      url: data.locationUrl || data.url || '',
    } : {
      '@type': 'Place',
      name: data.locationName || data.venue || '',
      address: {
        '@type': 'PostalAddress',
        streetAddress: data.streetAddress || data.address || '',
        addressLocality: data.city || '',
        addressRegion: data.state || '',
        postalCode: data.postalCode || '',
        addressCountry: data.country || 'US',
      },
    },
    image: data.image || undefined,
    organizer: data.organizer ? {
      '@type': 'Organization',
      name: data.organizer,
      url: data.organizerUrl || undefined,
    } : undefined,
    offers: data.price !== undefined ? {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'USD',
      availability: data.ticketsAvailable !== false ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: data.ticketUrl || data.url || undefined,
      validFrom: data.ticketSaleDate || undefined,
    } : undefined,
    performer: data.performer ? {
      '@type': 'Person',
      name: data.performer,
    } : undefined,
  }),
};

export async function toolGenerateStructuredData(args, ctx) {
  const { type, data } = args;
  if (!type) return JSON.stringify({ success: false, error: 'type is required (Article, FAQ, HowTo, LocalBusiness, Organization, Product, Event)' });
  if (!data || typeof data !== 'object') return JSON.stringify({ success: false, error: 'data object is required' });

  const templateFn = SCHEMA_TEMPLATES[type];
  if (!templateFn) {
    return JSON.stringify({
      success: false,
      error: `Unknown type "${type}". Supported: ${Object.keys(SCHEMA_TEMPLATES).join(', ')}`,
    });
  }

  ctx.onProgress?.(`Generating ${type} schema...`);

  // Generate the JSON-LD, strip undefined values
  const jsonLd = JSON.parse(JSON.stringify(templateFn(data)));

  // Validate required fields per type
  const warnings = [];
  switch (type) {
    case 'Article':
      if (!jsonLd.headline) warnings.push('Missing "headline" — required for Article rich snippets.');
      if (!jsonLd.author?.name) warnings.push('Missing "author" — Google requires author for Article schema.');
      if (!jsonLd.datePublished) warnings.push('Missing "datePublished" — needed for search result display.');
      break;
    case 'FAQ':
      if (!jsonLd.mainEntity?.length) warnings.push('No questions provided. Pass a "questions" array with {question, answer} objects.');
      break;
    case 'HowTo':
      if (!jsonLd.step?.length) warnings.push('No steps provided. Pass a "steps" array with {name, text} objects.');
      if (!jsonLd.name) warnings.push('Missing "name" — required for HowTo schema.');
      break;
    case 'LocalBusiness':
      if (!jsonLd.name) warnings.push('Missing "name" — required for LocalBusiness.');
      if (!jsonLd.address?.streetAddress) warnings.push('Missing address — strongly recommended for local SEO.');
      break;
    case 'Organization':
      if (!jsonLd.name) warnings.push('Missing "name" — required for Organization schema.');
      if (!jsonLd.url) warnings.push('Missing "url" — recommended for Organization schema.');
      break;
    case 'Product':
      if (!jsonLd.name) warnings.push('Missing "name" — required for Product rich snippets.');
      if (!jsonLd.offers?.price && jsonLd.offers?.price !== 0) warnings.push('Missing "price" — needed for Product rich results.');
      break;
    case 'Event':
      if (!jsonLd.name) warnings.push('Missing "name" — required for Event schema.');
      if (!jsonLd.startDate) warnings.push('Missing "startDate" — required for Event schema.');
      break;
  }

  const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

  return JSON.stringify({
    success: true,
    type,
    json_ld: jsonLd,
    script_tag: scriptTag,
    warnings,
    tips: [
      'Paste the script tag in your <head> or at the end of <body>.',
      'Test with Google Rich Results Test: https://search.google.com/test/rich-results',
      'Structured data improves visibility in Google rich snippets and LLM-based search (ChatGPT, Perplexity, etc.).',
    ],
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool Declarations (Gemini format)
// ──────────────────────────────────────────────────────────────────────────────

export function getSeoToolDeclarations() {
  return [
    {
      name: 'analyze_seo',
      description: 'Fetch a URL and analyze its SEO health. Returns a scored report (0-100) covering title, meta description, Open Graph, headings, image alt text, links, structured data, and more — with actionable fix suggestions.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The full URL to analyze (e.g., https://example.com/page)' },
        },
        required: ['url'],
      },
    },
    {
      name: 'generate_blog_post',
      description: 'Generate a complete SEO-optimized blog post using a multi-step AI pipeline. Returns the full article in Markdown with title, slug, meta description, tags, and JSON-LD Article schema ready to publish.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'The blog post topic or title idea' },
          target_keywords: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Target SEO keywords to optimize for (optional, will be inferred if omitted)',
          },
          tone: {
            type: 'STRING',
            description: 'Writing tone: "professional", "casual", "technical", "friendly", "authoritative". Default: "professional".',
          },
          length: {
            type: 'STRING',
            description: 'Article length: "short" (600-800 words), "medium" (1000-1400), "long" (1800-2500). Default: "medium".',
          },
        },
        required: ['topic'],
      },
    },
    {
      name: 'optimize_page_seo',
      description: 'Fetch a page and provide specific SEO optimization recommendations for target keywords. Includes title/meta/heading suggestions, generated FAQ schema (JSON-LD) for LLM search visibility, and internal linking advice.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The full URL of the page to optimize' },
          target_keywords: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Keywords to optimize the page for. First keyword is treated as primary.',
          },
        },
        required: ['url', 'target_keywords'],
      },
    },
    {
      name: 'generate_structured_data',
      description: 'Generate valid JSON-LD structured data (schema.org) for a given type. Returns a ready-to-paste <script> tag optimized for Google rich snippets and LLM citation. Supported types: Article, FAQ, HowTo, LocalBusiness, Organization, Product, Event.',
      parameters: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            description: 'Schema type: "Article", "FAQ", "HowTo", "LocalBusiness", "Organization", "Product", or "Event".',
          },
          data: {
            type: 'OBJECT',
            description: 'Data object with fields for the chosen type. Article: {headline, description, author, datePublished, image, url, publisher}. FAQ: {questions: [{question, answer}]}. HowTo: {name, description, steps: [{name, text}], tools, supplies}. LocalBusiness: {name, description, phone, address, city, state, zip, hours: [{days, opens, closes}]}. Organization: {name, url, logo, description, socialProfiles}. Product: {name, description, price, currency, brand, image, rating, sku}. Event: {name, startDate, endDate, venue, city, online, price, organizer}.',
            properties: {},
          },
        },
        required: ['type', 'data'],
      },
    },
  ];
}
