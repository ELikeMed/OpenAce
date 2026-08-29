/**
 * DocumentGenerator — turns HTML into printable documents.
 *
 * Renders through headless Chrome rather than Puppeteer: Chrome is already a dependency of
 * this project (BrowserAgent drives it over AppleScript) and Puppeteer was deliberately
 * removed, so shelling out to the browser that is already installed adds no new package and
 * no bundled Chromium download.
 *
 * If no browser is found the generator still writes the HTML and says so, rather than
 * failing the request outright — an HTML file the user can open and print themselves is a
 * far better outcome than an error.
 */
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// Checked in order. OPENACE_CHROME_PATH overrides everything, for unusual installs.
const CHROME_CANDIDATES = [
  process.env.OPENACE_CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const PAPER_SIZES = new Set(['Letter', 'Legal', 'Tabloid', 'A3', 'A4', 'A5']);

export class DocumentGenerator {
  constructor(dataDir) {
    // Resolved because the PDF step hands this to Chrome as a file:// URL, and a relative
    // path there is not a valid URL — it fails with ERR_INVALID_URL rather than anything
    // that points at the cause.
    this.docsDir = path.resolve(dataDir, 'documents');
    this.chromePath = null;
  }

  async initialize() {
    await fs.mkdir(this.docsDir, { recursive: true });
    this.chromePath = await this._findChrome();
    console.log(this.chromePath
      ? '✅ Document generator ready (PDF via headless Chrome)'
      : 'ℹ️  Document generator ready (HTML only — no Chrome/Chromium found for PDF)');
    return this;
  }

  async _findChrome() {
    for (const candidate of CHROME_CANDIDATES) {
      try {
        await fs.access(candidate, (await import('fs')).constants.X_OK);
        return candidate;
      } catch { /* try the next one */ }
    }
    return null;
  }

  /**
   * Create a document from HTML.
   *
   * `html` may be a complete page or just body content — bare content is wrapped in the
   * print stylesheet below, so the model can write plain semantic HTML and still get a
   * document that looks deliberately designed.
   */
  async createDocument({ title, html, format = 'pdf', paper = 'Letter', landscape = false, ownerId = null }) {
    if (!title || !String(title).trim()) throw new Error('title is required');
    if (!html || !String(html).trim()) throw new Error('html is required');

    const paperSize = PAPER_SIZES.has(paper) ? paper : 'Letter';
    const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = `${stamp}_${slug}`;

    const fullHtml = this._isFullPage(html) ? html : this._wrap(title, html, paperSize, landscape);
    const htmlPath = path.join(this.docsDir, `${base}.html`);
    await fs.writeFile(htmlPath, fullHtml, 'utf-8');

    const result = {
      title, format, paper: paperSize, landscape,
      htmlPath, htmlFile: path.basename(htmlPath),
      pdfPath: null, pdfFile: null, ownerId,
      createdAt: new Date().toISOString()
    };

    if (format === 'html') return result;

    if (!this.chromePath) {
      result.warning = 'No Chrome or Chromium found, so only the HTML was produced. It can be opened in a browser and printed to PDF.';
      return result;
    }

    const pdfPath = path.join(this.docsDir, `${base}.pdf`);
    try {
      await this._printToPdf(htmlPath, pdfPath, landscape);
      await fs.access(pdfPath);
      result.pdfPath = pdfPath;
      result.pdfFile = path.basename(pdfPath);
    } catch (err) {
      result.warning = `PDF rendering failed (${err.message}). The HTML was still saved and can be printed from a browser.`;
    }
    return result;
  }

  async _printToPdf(htmlPath, pdfPath, landscape) {
    const args = [
      '--headless',
      '--disable-gpu',
      // Headers and footers would stamp a file:// URL and page numbers across every
      // document, which is wrong for an invoice or a proposal.
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      `--print-to-pdf=${pdfPath}`,
    ];
    if (landscape) args.push('--landscape');
    args.push(`file://${path.resolve(htmlPath)}`);

    await run(this.chromePath, args, { timeout: 60_000, maxBuffer: 1024 * 1024 });
  }

  _isFullPage(html) {
    return /<html[\s>]/i.test(html) || /<!doctype/i.test(html);
  }

  /**
   * Print stylesheet applied to bare content. Sized in points and inches because the output
   * is paper, not a screen — and printed at a serif body size that stays readable on paper.
   */
  _wrap(title, bodyHtml, paper, landscape) {
    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${paper}${landscape ? ' landscape' : ''}; margin: 0.75in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 10.5pt/1.55 "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #14171a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin: 0 0 .4em; font-weight: 600; }
  h1 { font-size: 20pt; letter-spacing: -0.01em; }
  h2 { font-size: 14pt; margin-top: 1.4em; }
  h3 { font-size: 11.5pt; margin-top: 1.2em; }
  p, li { orphans: 3; widows: 3; }
  p { margin: 0 0 .75em; }
  ul, ol { margin: 0 0 .75em; padding-left: 1.3em; }
  li { margin-bottom: .3em; }
  a { color: #14171a; text-decoration: underline; }
  small, .muted { color: #5b6570; font-size: 9pt; }
  hr { border: none; border-top: 1px solid #d8dde2; margin: 1.4em 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 10pt; }
  th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #d8dde2; vertical-align: top; }
  th { font-weight: 600; border-bottom-width: 2px; border-bottom-color: #14171a; }
  tbody tr:last-child td { border-bottom: none; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 600; border-top: 2px solid #14171a; }
  header.doc { margin-bottom: 1.6em; padding-bottom: .9em; border-bottom: 2px solid #14171a; }
  header.doc h1 { margin-bottom: .15em; }
  footer.doc { margin-top: 2em; padding-top: .8em; border-top: 1px solid #d8dde2; font-size: 9pt; color: #5b6570; }
  blockquote { margin: 1em 0; padding-left: .9em; border-left: 3px solid #d8dde2; color: #414a54; }
  code, pre { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9.5pt; }
  pre { background: #f5f7f9; padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; }
  /* Keep headings with the text they introduce, and never split a row across pages. */
  h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  tr, li, blockquote { break-inside: avoid; page-break-inside: avoid; }
  .page-break { break-before: page; page-break-before: always; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  /**
   * Render an invoice or quote from structured data rather than model-authored markup.
   *
   * Asking a small local model to write correct print HTML produced documents that dropped
   * the line-item table, lost the invoice number, invented services, and dated themselves
   * years in the past. Money documents have to be right, so the model supplies the figures
   * and this builds the markup — the date defaults to today here rather than being recalled.
   */
  renderInvoice(data = {}) {
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const money = (n) => {
      const num = typeof n === 'number' ? n : parseFloat(String(n).replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(num)
        ? num.toLocaleString('en-US', { style: 'currency', currency: data.currency || 'USD' })
        : esc(n);
    };
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const kind = (data.kind || 'Invoice').replace(/[^A-Za-z ]/g, '') || 'Invoice';
    const items = Array.isArray(data.items) ? data.items : [];

    let subtotal = 0;
    const rows = items.map((it) => {
      const qty = it.quantity == null ? 1 : Number(it.quantity);
      const rate = parseFloat(String(it.rate ?? it.amount ?? 0).replace(/[^0-9.\-]/g, '')) || 0;
      const amount = it.amount != null && it.quantity == null
        ? (parseFloat(String(it.amount).replace(/[^0-9.\-]/g, '')) || 0)
        : qty * rate;
      subtotal += amount;
      return `    <tr><td>${esc(it.description || '')}</td><td class="num">${esc(qty)}</td><td class="num">${money(rate)}</td><td class="num">${money(amount)}</td></tr>`;
    }).join('\n');

    const taxRate = Number(data.taxRate) || 0;
    const tax = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + tax;

    const meta = [
      data.number ? `${esc(kind)} #${esc(data.number)}` : null,
      `Issued ${esc(data.date || today)}`,
      data.dueDate ? `Due ${esc(data.dueDate)}` : (data.terms ? esc(data.terms) : null),
    ].filter(Boolean).join(' &middot; ');

    const party = (label, p) => {
      if (!p) return '';
      const lines = (typeof p === 'string' ? [p] : [p.name, p.address, p.email, p.phone]).filter(Boolean);
      if (lines.length === 0) return '';
      return `<div class="party"><div class="muted">${label}</div>${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
    };

    return `
<header class="doc">
  <h1>${esc(kind)}</h1>
  <div class="muted">${meta}</div>
</header>
<div class="parties">
  ${party('From', data.from)}
  ${party('Bill to', data.to)}
</div>
<table>
  <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
  <tbody>
${rows || '    <tr><td colspan="4" class="muted">No line items provided.</td></tr>'}
${taxRate > 0 ? `    <tr><td colspan="3">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
    <tr><td colspan="3">Tax (${esc(taxRate)}%)</td><td class="num">${money(tax)}</td></tr>` : ''}
    <tr class="total"><td colspan="3">Total ${taxRate > 0 ? '' : 'due'}</td><td class="num">${money(total)}</td></tr>
  </tbody>
</table>
${data.notes ? `<p>${esc(data.notes)}</p>` : ''}
${data.terms && !data.dueDate ? `<footer class="doc">${esc(data.terms)}</footer>` : ''}
<style>
  .parties { display: flex; gap: 2.5em; margin-bottom: .5em; }
  .party { font-size: 10pt; line-height: 1.45; }
  .party .muted { font-weight: 600; margin-bottom: .25em; }
</style>`;
  }

  /**
   * Render a stored SOP as a printable procedure sheet.
   *
   * Built here rather than asked of the model for the same reason invoices are: the steps
   * already exist as structured data, so there is nothing for a model to add except the
   * opportunity to lose a step or reword one into something that no longer matches what
   * the automation actually does.
   */
  renderSOP(sop = {}) {
    const esc = (v) => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const steps = Array.isArray(sop.steps) ? sop.steps : [];

    // Steps are stored for automation, so the readable label lives in different fields
    // depending on how the procedure was recorded.
    const describe = (st) => st.description || st.text || st.instruction ||
      [st.action && String(st.action).replace(/_/g, ' '), st.target || st.value || st.url]
        .filter(Boolean).join(' — ') || 'Step';

    // A short verb chip per step, so the sheet can be skimmed rather than read.
    const VERB = {
      navigate: 'Go to', click_text: 'Click', click_submit: 'Click', smart_click: 'Click',
      right_click: 'Right-click', hover: 'Hover', edit_field: 'Type in', type: 'Type',
      press: 'Press', select_option: 'Choose', scroll: 'Scroll', switch_tab: 'Switch tab',
      go_back: 'Go back', copy_text: 'Copy', wait: 'Wait', wait_navigation: 'Wait',
    };

    // Recorded steps carry the page URL on every one. Repeating an identical URL down 34
    // rows is noise that buries the actual instructions, so it is shown only when the page
    // changes — which is also the information the reader needs.
    let lastUrl = null;
    const stepRows = steps.map((st, i) => {
      const detail = describe(st);
      // Drop the chip when the sentence already opens with that verb, otherwise recorded
      // steps read "Click Click the 'what's on your mind'".
      const candidate = VERB[st.action] || '';
      const firstWord = detail.trim().split(/\s+/)[0] || '';
      const verb = candidate && firstWord.toLowerCase() !== candidate.split(' ')[0].toLowerCase()
        ? candidate
        : '';

      const showUrl = !!st.url && st.url !== lastUrl && !detail.includes(st.url);
      if (st.url) lastUrl = st.url;
      return `    <li class="step">
      <div class="badge">${i + 1}</div>
      <div class="body">
        ${verb ? `<span class="verb">${esc(verb)}</span>` : ''}<span class="what">${esc(detail)}</span>
        ${showUrl ? `<div class="where">${esc(st.url)}</div>` : ''}
      </div>
    </li>`;
    }).join('\n');

    const vars = Array.isArray(sop.variables) ? sop.variables : [];
    const triggers = Array.isArray(sop.triggers) ? sop.triggers : [];
    const updated = sop.updatedAt || sop.createdAt;
    const fmt = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const meta = [
      `${steps.length} step${steps.length === 1 ? '' : 's'}`,
      sop.category ? esc(String(sop.category).replace(/_/g, ' ')) : null,
      updated ? `Updated ${esc(fmt(updated))}` : null,
    ].filter(Boolean);

    return `
<div class="sheet">
  <header class="masthead">
    <div class="eyebrow">Standard Operating Procedure</div>
    <h1>${esc(sop.name || 'Procedure')}</h1>
    ${sop.description ? `<p class="summary">${esc(sop.description)}</p>` : ''}
    <div class="meta">${meta.map(m => `<span>${m}</span>`).join('<i>·</i>')}</div>
  </header>

  ${vars.length ? `<section class="callout">
    <h2>Before you start</h2>
    <p class="hint">Have these ready — they change each time you run it.</p>
    <dl>
${vars.map(v => `      <dt>${esc(v.name || v)}</dt><dd>${esc(v.description || 'provided when it runs')}${v.example ? ` <em>e.g. ${esc(v.example)}</em>` : ''}</dd>`).join('\n')}
    </dl>
  </section>` : ''}

  <section>
    <h2>The steps</h2>
    <ol class="steps">
${stepRows || '      <li class="step"><div class="body"><span class="what muted">No steps recorded.</span></div></li>'}
    </ol>
  </section>

  ${triggers.length ? `<section class="callout quiet">
    <h2>How to start it</h2>
    <p>Say any of these to Ace:</p>
    <ul class="triggers">
${triggers.map(t => `      <li>${esc(t)}</li>`).join('\n')}
    </ul>
  </section>` : ''}

  <footer class="sheet-foot">
    <span>${esc(sop.name || 'Procedure')}</span>
    <span>Printed ${esc(fmt(Date.now()))}</span>
  </footer>
</div>

<style>
  /* A single accent, a neutral ramp, and one 4px-based spacing scale. Consistency is what
     makes a printed sheet look designed rather than assembled. */
  .sheet { --ink:#14171a; --ink-2:#5b6570; --line:#dfe4e9; --accent:#0f766e; --tint:#f4f7f8; }

  .masthead { border-bottom: 3px solid var(--accent); padding-bottom: 14px; margin-bottom: 26px; }
  .eyebrow { font-size: 8.5pt; letter-spacing: .13em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 4px; }
  .masthead h1 { font-size: 23pt; line-height: 1.12; margin: 0 0 6px; letter-spacing: -0.015em; }
  .summary { font-size: 11pt; color: var(--ink-2); margin: 0 0 8px; max-width: 46em; }
  .meta { font-size: 9pt; color: var(--ink-2); }
  .meta i { font-style: normal; margin: 0 7px; color: var(--line); }

  .sheet h2 { font-size: 10pt; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-2);
              margin: 0 0 12px; font-weight: 700; }
  .sheet section { margin-bottom: 26px; }

  /* Steps as a list, not a table — a table's borders fight the numbers for attention. */
  ol.steps { list-style: none; margin: 0; padding: 0; counter-reset: none; }
  li.step { display: flex; gap: 13px; padding: 11px 0; border-top: 1px solid var(--line); align-items: baseline; }
  li.step:first-child { border-top: none; padding-top: 0; }
  .badge { flex: 0 0 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff;
           font-size: 9.5pt; font-weight: 700; text-align: center; line-height: 22px; }
  .step .body { flex: 1; }
  .verb { font-weight: 700; margin-right: .35em; }
  .what { }
  .where { font-size: 9pt; color: var(--ink-2); margin-top: 3px; word-break: break-all; }

  .callout { background: var(--tint); border-left: 3px solid var(--accent); padding: 14px 16px; border-radius: 3px; }
  .callout.quiet { border-left-color: var(--line); }
  .callout h2 { margin-bottom: 6px; }
  .hint { font-size: 9.5pt; color: var(--ink-2); margin: 0 0 8px; }
  .callout dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 10pt; }
  .callout dt { font-weight: 700; font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9.5pt; }
  .callout dd { margin: 0; color: var(--ink-2); }
  .callout dd em { color: var(--ink-2); }

  ul.triggers { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  ul.triggers li { border: 1px solid var(--line); background: #fff; border-radius: 999px;
                   padding: 3px 11px; font-size: 9.5pt; }

  .sheet-foot { display: flex; justify-content: space-between; border-top: 1px solid var(--line);
                padding-top: 9px; font-size: 8.5pt; color: var(--ink-2); }

  /* Never split a step across a page, and never strand a heading at the foot of one. */
  li.step, .callout { break-inside: avoid; page-break-inside: avoid; }
  .sheet h2 { break-after: avoid; page-break-after: avoid; }
</style>`;
  }

  async listDocuments(ownerId = null) {
    let names;
    try { names = await fs.readdir(this.docsDir); } catch { return []; }
    const docs = [];
    for (const name of names) {
      if (!name.endsWith('.pdf') && !name.endsWith('.html')) continue;
      const stat = await fs.stat(path.join(this.docsDir, name)).catch(() => null);
      if (!stat) continue;
      docs.push({ file: name, size: stat.size, createdAt: stat.mtime.toISOString() });
    }
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
