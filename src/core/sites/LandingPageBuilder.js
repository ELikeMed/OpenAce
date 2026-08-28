/**
 * LandingPageBuilder — produces a complete, designed landing page from structured content.
 *
 * The model writes the words; this writes the page. Asked to author a site directly, the
 * local 7B either emitted an empty `files` array (falling through to a generic scaffold whose
 * headline was the project name) or created the project and never made the follow-up file
 * calls. Neither produces something a business could publish.
 *
 * So the split is the same one used for invoices: structured content in, designed markup out.
 * The layout, responsive behaviour, accessibility and print-quality typography are fixed here
 * and cannot be degraded by a weak generation.
 */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Split a newline- or pipe-separated list into trimmed entries.
const lines = (v) => String(v || '')
  .split(/\r?\n/).flatMap(l => l.includes('|') ? l.split('|') : [l])
  .map(s => s.trim()).filter(Boolean);

// "Heading :: body" or "Heading - body" splits into a titled benefit; otherwise it is body only.
function splitBenefit(entry) {
  const m = entry.match(/^(.{3,60}?)\s*(?:::|—|–|\s-\s)\s*(.+)$/);
  return m ? { title: m[1].trim(), body: m[2].trim() } : { title: null, body: entry };
}

export class LandingPageBuilder {
  /**
   * @param {object} c content
   * @param {string} c.business        business name, used in nav and footer
   * @param {string} c.headline        the h1
   * @param {string} c.subheadline     supporting sentence
   * @param {string} c.benefits        one per line, optionally "Title :: description"
   * @param {string} c.testimonial     quote text
   * @param {string} c.testimonialBy   attribution
   * @param {string} c.ctaText         primary button label
   * @param {string} c.ctaNote         reassurance under the form
   * @param {string} c.email           contact email the form posts to (mailto fallback)
   * @param {string} c.phone           displayed in the footer if given
   * @param {string} c.accent          hex accent colour
   * @param {string} c.about           optional paragraph for the about section
   */
  static build(c = {}) {
    const business = c.business || 'Our Company';
    const headline = c.headline || business;
    const accent = /^#[0-9a-f]{6}$/i.test(c.accent || '') ? c.accent : '#1d4ed8';
    const benefits = lines(c.benefits).slice(0, 6).map(splitBenefit);
    const email = c.email || '';

    const nav = [
      benefits.length ? ['#benefits', 'Benefits'] : null,
      c.about ? ['#about', 'About'] : null,
      c.testimonial ? ['#testimonial', 'Results'] : null,
      ['#contact', 'Contact'],
    ].filter(Boolean);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(headline)} | ${esc(business)}</title>
<meta name="description" content="${esc(c.subheadline || headline)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(headline)}">
<meta property="og:description" content="${esc(c.subheadline || headline)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":${JSON.stringify(business)}${email ? `,"email":${JSON.stringify(email)}` : ''}${c.phone ? `,"telephone":${JSON.stringify(c.phone)}` : ''}}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site">
  <div class="wrap bar">
    <a class="brand" href="#">${esc(business)}</a>
    <nav aria-label="Main">
      ${nav.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('\n      ')}
    </nav>
    <a class="btn btn-primary btn-sm" href="#contact">${esc(c.ctaText || 'Get in touch')}</a>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="wrap">
      <h1>${esc(headline)}</h1>
      ${c.subheadline ? `<p class="lede">${esc(c.subheadline)}</p>` : ''}
      <div class="actions">
        <a class="btn btn-primary" href="#contact">${esc(c.ctaText || 'Get in touch')}</a>
        ${benefits.length ? '<a class="btn btn-ghost" href="#benefits">See how it works</a>' : ''}
      </div>
    </div>
  </section>

${benefits.length ? `  <section id="benefits" class="section">
    <div class="wrap">
      <h2>What you get</h2>
      <div class="grid">
${benefits.map((b, i) => `        <article class="card">
          <div class="num" aria-hidden="true">${i + 1}</div>
          ${b.title ? `<h3>${esc(b.title)}</h3>` : ''}
          <p>${esc(b.body)}</p>
        </article>`).join('\n')}
      </div>
    </div>
  </section>` : ''}

${c.about ? `  <section id="about" class="section alt">
    <div class="wrap narrow">
      <h2>About ${esc(business)}</h2>
      <p>${esc(c.about)}</p>
    </div>
  </section>` : ''}

${c.testimonial ? `  <section id="testimonial" class="section">
    <div class="wrap narrow">
      <figure class="quote">
        <blockquote>${esc(c.testimonial)}</blockquote>
        ${c.testimonialBy ? `<figcaption>— ${esc(c.testimonialBy)}</figcaption>` : ''}
      </figure>
    </div>
  </section>` : ''}

  <section id="contact" class="section alt">
    <div class="wrap narrow">
      <h2>Get in touch</h2>
      <p class="lede">${esc(c.ctaNote || 'Tell us what you need and we will come back to you.')}</p>
      <form class="form" ${email ? `action="mailto:${esc(email)}" method="post" enctype="text/plain"` : ''} novalidate>
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" name="name" type="text" autocomplete="name" required>
          <p class="err" data-for="name" hidden>Please enter your name.</p>
        </div>
        <div class="field">
          <label for="email">Email address</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
          <p class="err" data-for="email" hidden>Please enter a valid email address.</p>
        </div>
        <div class="field">
          <label for="message">How can we help?</label>
          <textarea id="message" name="message" rows="4"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">${esc(c.ctaText || 'Send enquiry')}</button>
        <p class="ok" id="sent" hidden>Thanks — we will be in touch shortly.</p>
      </form>
    </div>
  </section>
</main>

<footer class="site-foot">
  <div class="wrap bar">
    <span>&copy; <span id="year"></span> ${esc(business)}</span>
    <span>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ''}${c.phone ? ` &middot; <a href="tel:${esc(String(c.phone).replace(/[^0-9+]/g, ''))}">${esc(c.phone)}</a>` : ''}</span>
  </div>
</footer>

<script src="script.js"></script>
</body>
</html>`;
  }

  static styles(c = {}) {
    const accent = /^#[0-9a-f]{6}$/i.test(c.accent || '') ? c.accent : '#1d4ed8';
    return `/* Design tokens. One accent, a neutral ramp, and an 8px spacing scale — the
   consistency is what makes it read as designed rather than assembled. */
:root {
  --accent: ${accent};
  --accent-ink: #ffffff;
  --ink: #14171a;
  --ink-2: #4a5560;
  --line: #e2e6ea;
  --bg: #ffffff;
  --bg-alt: #f6f8fa;
  --sp-1: 8px; --sp-2: 16px; --sp-3: 24px; --sp-4: 32px; --sp-6: 48px; --sp-8: 64px;
  --radius: 10px;
  --wrap: 1080px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { line-height: 1.15; margin: 0 0 var(--sp-2); letter-spacing: -0.02em; }
h1 { font-size: clamp(2.1rem, 5vw, 3.4rem); }
h2 { font-size: clamp(1.5rem, 3vw, 2.1rem); margin-bottom: var(--sp-4); }
h3 { font-size: 1.12rem; }
p { margin: 0 0 var(--sp-2); }
a { color: var(--accent); }

.wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 var(--sp-3); }
/* Body copy is capped near 65 characters — full-width text is measurably harder to read. */
.narrow { max-width: 680px; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }

.skip { position: absolute; left: -9999px; }
.skip:focus { left: var(--sp-2); top: var(--sp-2); background: var(--bg); padding: var(--sp-1) var(--sp-2); z-index: 10; }

.site { position: sticky; top: 0; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); z-index: 5; }
.site .bar { padding: var(--sp-2) 0; }
.brand { font-weight: 700; color: var(--ink); text-decoration: none; font-size: 1.05rem; }
.site nav { display: flex; gap: var(--sp-3); }
.site nav a { color: var(--ink-2); text-decoration: none; font-size: .95rem; }
.site nav a:hover { color: var(--ink); }

.btn {
  display: inline-block; border: 1px solid transparent; border-radius: var(--radius);
  padding: 13px 22px; font-weight: 600; font-size: 1rem; text-decoration: none;
  cursor: pointer; transition: transform .08s ease, opacity .15s ease;
}
.btn:active { transform: translateY(1px); }
.btn-sm { padding: 9px 16px; font-size: .92rem; }
.btn-primary { background: var(--accent); color: var(--accent-ink); }
.btn-primary:hover { opacity: .9; }
.btn-ghost { background: transparent; color: var(--accent); border-color: var(--line); }

.hero { padding: var(--sp-8) 0 var(--sp-6); }
.hero .wrap { max-width: 760px; margin-inline: 0; padding-left: max(var(--sp-3), calc((100vw - var(--wrap)) / 2 + var(--sp-3))); }
.lede { font-size: 1.15rem; color: var(--ink-2); }
.actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }

.section { padding: var(--sp-8) 0; }
.section.alt { background: var(--bg-alt); border-block: 1px solid var(--line); }

.grid { display: grid; gap: var(--sp-3); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.card { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--sp-3); }
.card p { color: var(--ink-2); margin: 0; }
.num {
  width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: var(--accent-ink);
  display: grid; place-items: center; font-size: .85rem; font-weight: 700; margin-bottom: var(--sp-2);
}

.quote { margin: 0; }
.quote blockquote { margin: 0; font-size: 1.3rem; line-height: 1.5; border-left: 3px solid var(--accent); padding-left: var(--sp-3); }
.quote figcaption { margin-top: var(--sp-2); color: var(--ink-2); }

.form { display: grid; gap: var(--sp-3); margin-top: var(--sp-3); }
.field { display: grid; gap: 6px; }
/* Label above the field, always visible — a placeholder disappears the moment someone types. */
label { font-weight: 600; font-size: .95rem; }
input, textarea {
  font: inherit; padding: 12px 14px; border: 1px solid var(--line);
  border-radius: var(--radius); background: var(--bg); color: var(--ink); width: 100%;
}
input:focus-visible, textarea:focus-visible, a:focus-visible, button:focus-visible {
  outline: 3px solid var(--accent); outline-offset: 2px;
}
.err { color: #b42318; font-size: .9rem; margin: 0; }
.ok { color: #067647; font-weight: 600; margin: 0; }
input[aria-invalid="true"] { border-color: #b42318; }

.site-foot { border-top: 1px solid var(--line); padding: var(--sp-4) 0; color: var(--ink-2); font-size: .93rem; }
.site-foot .bar { flex-wrap: wrap; gap: var(--sp-2); }

@media (max-width: 720px) {
  .site nav { display: none; }
  .hero { padding: var(--sp-6) 0 var(--sp-4); }
  .hero .wrap { padding-inline: var(--sp-3); }
  .section { padding: var(--sp-6) 0; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .btn { transition: none; }
}`;
  }

  static script() {
    return `// Progressive enhancement only — the page works with JavaScript disabled.
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.querySelector('.form');
if (form) {
  const showError = (input, show) => {
    const msg = form.querySelector('.err[data-for="' + input.id + '"]');
    if (msg) msg.hidden = !show;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
  };

  // Validate on blur rather than on every keystroke, so the user is not told they are
  // wrong while they are still typing.
  form.querySelectorAll('input[required]').forEach((input) => {
    input.addEventListener('blur', () => showError(input, !input.checkValidity()));
    input.addEventListener('input', () => { if (input.checkValidity()) showError(input, false); });
  });

  form.addEventListener('submit', (e) => {
    let firstInvalid = null;
    form.querySelectorAll('input[required]').forEach((input) => {
      const bad = !input.checkValidity();
      showError(input, bad);
      if (bad && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      e.preventDefault();
      firstInvalid.focus();
      return;
    }
    if (!form.getAttribute('action')) {
      // No delivery address configured, so acknowledge rather than silently doing nothing.
      e.preventDefault();
      document.getElementById('sent').hidden = false;
      form.reset();
    }
  });
}`;
  }
}
