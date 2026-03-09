/**
 * FormRenderer — Generates complete self-contained HTML from form JSON definitions
 * No React, no build step. Pure HTML/CSS/JS output.
 */

class FormRenderer {
  /**
   * Render a complete HTML page for a form
   * @param {Object} form - Form definition JSON
   * @param {Object} options - { submitUrl, embedded }
   * @returns {string} Complete HTML string
   */
  static render(form, options = {}) {
    const submitUrl = options.submitUrl || `/api/forms/${form.id}/submit`;
    const firebaseConfig = options.firebaseConfig || null;
    const s = form.style || {};
    const settings = form.settings || {};

    const primaryColor = FormRenderer._escAttr(s.primary_color || '#6C5CE7');
    const secondaryColor = FormRenderer._escAttr(s.secondary_color || '#00CEC9');
    const accentColor = FormRenderer._escAttr(s.accent_color || '#FD79A8');
    const bgColor = FormRenderer._escAttr(s.background || '#0F0F1A');
    const cardBg = FormRenderer._escAttr(s.card_background || '#1A1A2E');
    const textColor = FormRenderer._escAttr(s.text_color || '#F2F2FA');

    // Build steps array — include contact step if configured
    const steps = [...(form.steps || [])];
    if (settings.collect_contact) {
      steps.push({
        id: '__contact__',
        title: 'Almost done! How can we reach you?',
        subtitle: 'We\'ll send your results here',
        type: 'contact_info',
        required: true,
        fields: settings.contact_fields || ['name', 'email']
      });
    }

    const stepsJson = JSON.stringify(steps.map(step => ({
      ...step,
      title: step.title || '',
      subtitle: step.subtitle || '',
      options: (step.options || []).map(o => ({
        ...o,
        label: o.label || '',
        emoji: o.emoji || '',
        value: o.value || o.label || ''
      }))
    })));

    const resultsJson = JSON.stringify(form.results || { enabled: false });
    const formName = FormRenderer._esc(form.name || 'Form');
    const submitText = FormRenderer._esc(settings.submit_button_text || 'Submit');
    const showProgress = settings.multi_step !== false;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${formName}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary: ${primaryColor};
    --secondary: ${secondaryColor};
    --accent: ${accentColor};
    --bg: ${bgColor};
    --card-bg: ${cardBg};
    --text: ${textColor};
    --text-muted: ${textColor}99;
    --border: ${textColor}22;
    --radius: 14px;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 20px;
  }

  .form-container {
    width: 100%;
    max-width: 640px;
    animation: fadeUp 0.5s ease;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .form-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .form-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .form-header p {
    color: var(--text-muted);
    font-size: 15px;
  }

  /* Progress bar */
  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    margin-bottom: 32px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .step-counter {
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  /* Step card */
  .step-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px;
    animation: fadeUp 0.3s ease;
  }

  .step-card.hidden { display: none; }

  .step-title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .step-subtitle {
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: 24px;
  }

  /* Option cards */
  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .options-grid { grid-template-columns: 1fr; }
  }

  .option-card {
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    user-select: none;
  }

  .option-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
  }

  .option-card.selected {
    border-color: var(--primary);
    background: ${primaryColor}15;
    box-shadow: 0 0 20px ${primaryColor}20;
  }

  .option-emoji {
    font-size: 24px;
    flex-shrink: 0;
  }

  .option-label {
    font-size: 15px;
    font-weight: 500;
  }

  .option-check {
    margin-left: auto;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .option-card.selected .option-check {
    background: var(--primary);
    border-color: var(--primary);
  }

  .option-card.selected .option-check::after {
    content: '\\2713';
    color: white;
    font-size: 13px;
    font-weight: 700;
  }

  /* Text inputs */
  .input-group { margin-bottom: 16px; }

  .input-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-group input,
  .input-group textarea {
    width: 100%;
    padding: 14px 16px;
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    font-size: 16px;
    font-family: inherit;
    transition: border-color 0.2s ease;
    outline: none;
  }

  .input-group input:focus,
  .input-group textarea:focus {
    border-color: var(--primary);
  }

  .input-group textarea {
    min-height: 120px;
    resize: vertical;
  }

  .input-group .error {
    border-color: var(--accent);
  }

  .input-error {
    color: var(--accent);
    font-size: 12px;
    margin-top: 4px;
  }

  /* Rating */
  .rating-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .rating-star {
    font-size: 36px;
    cursor: pointer;
    transition: transform 0.15s ease;
    opacity: 0.3;
  }

  .rating-star:hover { transform: scale(1.2); }
  .rating-star.active { opacity: 1; }

  /* Navigation */
  .nav-row {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
    gap: 12px;
  }

  .btn {
    padding: 14px 32px;
    border-radius: 10px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: white;
    flex: 1;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px ${primaryColor}40;
  }

  .btn-secondary {
    background: var(--border);
    color: var(--text);
  }

  .btn-secondary:hover { background: var(--text)22; }

  /* Results page */
  .results-card {
    text-align: center;
    padding: 48px 32px;
  }

  .results-card h2 {
    font-size: 32px;
    margin-bottom: 12px;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .results-card p {
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 24px;
  }

  .results-card .btn { min-width: 200px; }

  /* Thank you page */
  .thank-you h2 {
    font-size: 36px;
    margin-bottom: 8px;
  }

  /* Spinner */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 20px auto;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
${firebaseConfig ? `<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>` : ''}
</head>
<body>
<div class="form-container" id="app">
  <div class="form-header">
    <h1>${formName}</h1>
    ${form.description ? `<p>${FormRenderer._esc(form.description)}</p>` : ''}
  </div>

  ${showProgress ? '<div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>' : ''}
  ${showProgress ? '<div class="step-counter" id="stepCounter"></div>' : ''}

  <div id="stepsContainer"></div>
  <div id="resultsContainer" class="step-card hidden"></div>
</div>

<script>
(function() {
  const STEPS = ${stepsJson};
  const RESULTS = ${resultsJson};
  const SUBMIT_URL = ${JSON.stringify(submitUrl)};
  const SUBMIT_TEXT = ${JSON.stringify(submitText)};
  const TOTAL_STEPS = STEPS.length;
  const FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};

  let firestoreDb = null;
  if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      firestoreDb = firebase.firestore();
    } catch (e) {
      console.warn('Firebase init failed:', e.message);
    }
  }

  let currentStep = 0;
  const answers = {};

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderStep(idx) {
    const step = STEPS[idx];
    if (!step) return;

    const container = document.getElementById('stepsContainer');
    container.innerHTML = '';

    // Progress
    const pf = document.getElementById('progressFill');
    const sc = document.getElementById('stepCounter');
    if (pf) pf.style.width = ((idx + 1) / TOTAL_STEPS * 100) + '%';
    if (sc) sc.textContent = 'Step ' + (idx + 1) + ' of ' + TOTAL_STEPS;

    const card = document.createElement('div');
    card.className = 'step-card';

    let html = '<h2 class="step-title">' + esc(step.title) + '</h2>';
    if (step.subtitle) html += '<p class="step-subtitle">' + esc(step.subtitle) + '</p>';

    // Render by type
    switch (step.type) {
      case 'multi_select':
      case 'single_select':
        html += renderOptions(step);
        break;
      case 'text_input':
        html += renderTextInput(step);
        break;
      case 'email_input':
        html += renderEmailInput(step);
        break;
      case 'textarea':
        html += renderTextarea(step);
        break;
      case 'rating':
        html += renderRating(step);
        break;
      case 'contact_info':
        html += renderContactInfo(step);
        break;
      default:
        html += renderOptions(step);
    }

    // Navigation
    const isLast = idx === TOTAL_STEPS - 1;
    html += '<div class="nav-row">';
    if (idx > 0) html += '<button class="btn btn-secondary" onclick="window._formPrev()">Back</button>';
    html += '<button class="btn btn-primary" id="nextBtn" onclick="window._formNext()">' + (isLast ? esc(SUBMIT_TEXT) : 'Continue') + '</button>';
    html += '</div>';

    card.innerHTML = html;
    container.appendChild(card);

    // Restore selections
    restoreSelections(step, idx);
  }

  function renderOptions(step) {
    const opts = step.options || [];
    let html = '<div class="options-grid">';
    for (const opt of opts) {
      html += '<div class="option-card" data-value="' + esc(opt.value) + '" onclick="window._formToggle(this, \\'' + esc(step.type) + '\\')">';
      if (opt.emoji) html += '<span class="option-emoji">' + esc(opt.emoji) + '</span>';
      html += '<span class="option-label">' + esc(opt.label) + '</span>';
      html += '<span class="option-check"></span>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderTextInput(step) {
    return '<div class="input-group"><input type="text" id="input_' + step.id + '" placeholder="' + esc(step.placeholder || 'Type your answer...') + '" /></div>';
  }

  function renderEmailInput(step) {
    return '<div class="input-group"><input type="email" id="input_' + step.id + '" placeholder="' + esc(step.placeholder || 'your@email.com') + '" /></div>';
  }

  function renderTextarea(step) {
    return '<div class="input-group"><textarea id="input_' + step.id + '" placeholder="' + esc(step.placeholder || 'Type your answer...') + '"></textarea></div>';
  }

  function renderRating(step) {
    const max = step.max || 5;
    let html = '<div class="rating-row">';
    for (let i = 1; i <= max; i++) {
      html += '<span class="rating-star" data-value="' + i + '" onclick="window._formRate(this, ' + i + ')">&#9733;</span>';
    }
    html += '</div>';
    return html;
  }

  function renderContactInfo(step) {
    const fields = step.fields || ['name', 'email'];
    let html = '';
    if (fields.includes('name')) {
      html += '<div class="input-group"><label>Name</label><input type="text" id="contact_name" placeholder="Your name" /></div>';
    }
    if (fields.includes('email')) {
      html += '<div class="input-group"><label>Email</label><input type="email" id="contact_email" placeholder="your@email.com" /></div>';
    }
    if (fields.includes('phone')) {
      html += '<div class="input-group"><label>Phone</label><input type="tel" id="contact_phone" placeholder="(555) 123-4567" /></div>';
    }
    return html;
  }

  function restoreSelections(step, idx) {
    const saved = answers[step.id];
    if (!saved) return;

    if (step.type === 'multi_select' || step.type === 'single_select') {
      const vals = Array.isArray(saved) ? saved : [saved];
      document.querySelectorAll('.option-card').forEach(c => {
        if (vals.includes(c.dataset.value)) c.classList.add('selected');
      });
    } else if (step.type === 'rating') {
      document.querySelectorAll('.rating-star').forEach(s => {
        if (parseInt(s.dataset.value) <= saved) s.classList.add('active');
      });
    } else if (step.type === 'contact_info') {
      if (saved.name) { const el = document.getElementById('contact_name'); if (el) el.value = saved.name; }
      if (saved.email) { const el = document.getElementById('contact_email'); if (el) el.value = saved.email; }
      if (saved.phone) { const el = document.getElementById('contact_phone'); if (el) el.value = saved.phone; }
    } else {
      const el = document.getElementById('input_' + step.id);
      if (el) el.value = saved;
    }
  }

  // Global handlers
  window._formToggle = function(el, type) {
    const step = STEPS[currentStep];
    if (type === 'single_select') {
      document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      answers[step.id] = el.dataset.value;
    } else {
      el.classList.toggle('selected');
      const selected = Array.from(document.querySelectorAll('.option-card.selected')).map(c => c.dataset.value);
      answers[step.id] = selected;
    }
  };

  window._formRate = function(el, value) {
    const step = STEPS[currentStep];
    answers[step.id] = value;
    document.querySelectorAll('.rating-star').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value) <= value);
    });
  };

  window._formPrev = function() {
    if (currentStep > 0) {
      currentStep--;
      renderStep(currentStep);
    }
  };

  window._formNext = function() {
    const step = STEPS[currentStep];

    // Collect current answers
    if (step.type === 'contact_info') {
      const contact = {};
      const nameEl = document.getElementById('contact_name');
      const emailEl = document.getElementById('contact_email');
      const phoneEl = document.getElementById('contact_phone');
      if (nameEl) contact.name = nameEl.value.trim();
      if (emailEl) contact.email = emailEl.value.trim();
      if (phoneEl) contact.phone = phoneEl.value.trim();
      answers[step.id] = contact;

      // Validate email
      if (emailEl && (!contact.email || !contact.email.includes('@'))) {
        emailEl.classList.add('error');
        let err = emailEl.parentNode.querySelector('.input-error');
        if (!err) {
          err = document.createElement('div');
          err.className = 'input-error';
          emailEl.parentNode.appendChild(err);
        }
        err.textContent = 'Please enter a valid email';
        return;
      }
    } else if (['text_input', 'email_input', 'textarea'].includes(step.type)) {
      const el = document.getElementById('input_' + step.id);
      if (el) answers[step.id] = el.value.trim();

      if (step.required && (!answers[step.id] || answers[step.id].length === 0)) {
        el.classList.add('error');
        return;
      }
    }

    // Check required
    if (step.required && !answers[step.id]) return;
    if (step.required && Array.isArray(answers[step.id]) && answers[step.id].length === 0) return;

    // Next or submit
    if (currentStep < TOTAL_STEPS - 1) {
      currentStep++;
      renderStep(currentStep);
    } else {
      submitForm();
    }
  };

  function submitForm() {
    const container = document.getElementById('stepsContainer');
    container.innerHTML = '<div class="step-card" style="text-align:center"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Submitting...</p></div>';

    // Separate contact info from answers
    const contact = answers['__contact__'] || {};
    const formAnswers = { ...answers };
    delete formAnswers['__contact__'];

    // Calculate outcome
    let outcome = null;
    if (RESULTS.enabled && RESULTS.outcomes) {
      const allValues = [];
      for (const v of Object.values(formAnswers)) {
        if (Array.isArray(v)) allValues.push(...v);
        else if (typeof v === 'string') allValues.push(v);
      }

      let bestMatch = null;
      let bestScore = 0;
      for (const o of RESULTS.outcomes) {
        const score = (o.match_tags || []).filter(t => allValues.includes(t)).length;
        if (score > bestScore) { bestScore = score; bestMatch = o; }
      }
      outcome = bestMatch || RESULTS.default_outcome;
    }

    const payload = { answers: formAnswers, contact, outcome: outcome ? outcome.title : null };
    const showResults = function() { if (outcome) showResult(outcome); else showThankYou(); };
    let submitted = false;

    // Path 1: POST to OpenAce server (works when served locally)
    fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function() { if (!submitted) { submitted = true; showResults(); } })
    .catch(function() {});

    // Path 2: Write to Firestore (works when deployed externally)
    if (firestoreDb) {
      var formIdMatch = SUBMIT_URL.match(/forms\\/([^\\/]+)\\/submit/);
      var FORM_ID = formIdMatch ? formIdMatch[1] : 'unknown';
      firestoreDb.collection('form_submissions').doc(FORM_ID)
        .collection('entries').add({
          answers: formAnswers,
          contact: contact,
          outcome: outcome ? outcome.title : null,
          form_id: FORM_ID,
          submitted_at: new Date().toISOString(),
          source: 'firebase'
        })
        .then(function() { if (!submitted) { submitted = true; showResults(); } })
        .catch(function(err) {
          console.error('Firestore write failed:', err);
          if (!submitted) { submitted = true; showResults(); }
        });
    }

    // Fallback: if neither resolves in 5s, show results anyway
    setTimeout(function() { if (!submitted) { submitted = true; showResults(); } }, 5000);
  }

  function showResult(outcome) {
    const container = document.getElementById('stepsContainer');
    container.innerHTML = '';

    const rc = document.getElementById('resultsContainer');
    rc.className = 'step-card results-card';
    rc.innerHTML = '<h2>' + esc(outcome.title) + '</h2>' +
      '<p>' + esc(outcome.description || '') + '</p>' +
      (outcome.cta_text ? '<button class="btn btn-primary" onclick="window._formCta()">' + esc(outcome.cta_text) + '</button>' : '');

    // Hide progress
    const pf = document.getElementById('progressFill');
    const sc = document.getElementById('stepCounter');
    if (pf) pf.style.width = '100%';
    if (sc) sc.textContent = 'Complete!';
  }

  function showThankYou() {
    const container = document.getElementById('stepsContainer');
    container.innerHTML = '';

    const rc = document.getElementById('resultsContainer');
    rc.className = 'step-card results-card thank-you';
    rc.innerHTML = '<h2>Thank you!</h2><p>Your response has been recorded.</p>';

    const pf = document.getElementById('progressFill');
    const sc = document.getElementById('stepCounter');
    if (pf) pf.style.width = '100%';
    if (sc) sc.textContent = 'Complete!';
  }

  window._formCta = function() {
    // CTA click — could redirect or close
    window.close();
  };

  // Start
  renderStep(0);
})();
</script>
</body>
</html>`;
  }

  /**
   * Generate project files for deploying a form as a standalone project
   * @param {Object} form - Form definition
   * @returns {Array<{path: string, content: string}>}
   */
  static renderProjectFiles(form, options = {}) {
    const serverUrl = options.serverUrl || '';
    const submitUrl = `${serverUrl}/api/forms/${form.id}/submit`;
    const firebaseConfig = form.settings?.firebase || options.firebaseConfig || null;
    const html = FormRenderer.render(form, { submitUrl, firebaseConfig });
    return [
      { path: 'index.html', content: html },
      {
        path: 'project.json',
        content: JSON.stringify({
          name: form.slug || form.id,
          type: 'form',
          description: form.description || `Form: ${form.name}`,
          created: form.created_at,
          updated: new Date().toISOString(),
          framework: 'vanilla',
          entryPoint: 'index.html',
          status: 'active'
        }, null, 2)
      }
    ];
  }

  // ── Escaping ──

  static _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  static _escAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export { FormRenderer };
export default FormRenderer;
