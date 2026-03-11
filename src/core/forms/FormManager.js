/**
 * FormManager — CRUD + submissions for forms/quizzes
 * Follows PipelineManager pattern: constructor → async init → JSON persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { eventBus, EVENTS } from '../events/EventBus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FormManager {
  constructor(options = {}) {
    this.formsPath = options.formsPath || path.join(__dirname, '../../../data/forms/forms.json');
    this.submissionsDir = options.submissionsDir || path.join(__dirname, '../../../data/forms/submissions');
    this.pipelineManager = options.pipelineManager || null;
    this.forms = [];
  }

  async initialize() {
    await this.loadForms();
    console.log(`[FormManager] Initialized with ${this.forms.length} forms`);
    return this;
  }

  // ── Persistence ──

  async loadForms() {
    try {
      const data = await fs.readFile(this.formsPath, 'utf-8');
      this.forms = JSON.parse(data);
    } catch (e) {
      this.forms = [];
      await this.saveForms();
    }
  }

  async saveForms() {
    await fs.mkdir(path.dirname(this.formsPath), { recursive: true });
    await fs.writeFile(this.formsPath, JSON.stringify(this.forms, null, 2));
  }

  async loadSubmissions(formId) {
    try {
      const filePath = path.join(this.submissionsDir, `${formId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveSubmissions(formId, submissions) {
    await fs.mkdir(this.submissionsDir, { recursive: true });
    const filePath = path.join(this.submissionsDir, `${formId}.json`);
    await fs.writeFile(filePath, JSON.stringify(submissions, null, 2));
  }

  // ── Slug generation ──

  _generateSlug(name) {
    let slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    // Ensure unique
    const existing = this.forms.filter(f => f.slug === slug || f.slug.startsWith(slug + '-'));
    if (existing.length > 0) {
      slug = `${slug}-${existing.length + 1}`;
    }
    return slug;
  }

  // ── CRUD ──

  async createForm(formData) {
    const id = `form-${Date.now()}`;
    const slug = formData.slug || this._generateSlug(formData.name || 'untitled');

    const form = {
      id,
      slug,
      name: formData.name || 'Untitled Form',
      description: formData.description || '',
      type: formData.type || 'form', // form, quiz, survey
      status: formData.status || 'draft',
      settings: {
        collect_contact: true,
        contact_fields: ['name', 'email'],
        multi_step: true,
        show_progress: true,
        add_to_pipeline: true,
        protect_from_outreach: false,
        submit_button_text: 'Submit',
        ...formData.settings
      },
      style: {
        theme: 'dark',
        primary_color: '#6C5CE7',
        secondary_color: '#00CEC9',
        accent_color: '#FD79A8',
        background: '#0F0F1A',
        card_background: '#1A1A2E',
        text_color: '#F2F2FA',
        ...formData.style
      },
      steps: formData.steps || [],
      results: formData.results || { enabled: false, outcomes: [], default_outcome: null },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.forms.push(form);
    await this.saveForms();
    eventBus.emit(EVENTS.FORM_CREATED, { form });
    return form;
  }

  async updateForm(formId, updates) {
    const idx = this.forms.findIndex(f => f.id === formId);
    if (idx === -1) throw new Error(`Form not found: ${formId}`);

    // Merge updates (shallow for top-level, deep for settings/style)
    const form = this.forms[idx];
    if (updates.settings) updates.settings = { ...form.settings, ...updates.settings };
    if (updates.style) updates.style = { ...form.style, ...updates.style };
    if (updates.results) updates.results = { ...form.results, ...updates.results };

    Object.assign(form, updates, { updated_at: new Date().toISOString() });
    // Don't allow changing id
    form.id = formId;

    await this.saveForms();
    eventBus.emit(EVENTS.FORM_UPDATED, { form });
    return form;
  }

  async deleteForm(formId) {
    const idx = this.forms.findIndex(f => f.id === formId);
    if (idx === -1) throw new Error(`Form not found: ${formId}`);

    const form = this.forms.splice(idx, 1)[0];
    await this.saveForms();

    // Delete submissions file
    try {
      await fs.unlink(path.join(this.submissionsDir, `${formId}.json`));
    } catch { /* no submissions file */ }

    eventBus.emit(EVENTS.FORM_DELETED, { formId, name: form.name });
    return form;
  }

  getForm(id) {
    return this.forms.find(f => f.id === id) || null;
  }

  getFormBySlug(slug) {
    return this.forms.find(f => f.slug === slug && f.status === 'published') || null;
  }

  getForms(filter = {}) {
    let result = [...this.forms];
    if (filter.status) result = result.filter(f => f.status === filter.status);
    if (filter.type) result = result.filter(f => f.type === filter.type);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }
    return result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  // ── Publish / Unpublish ──

  async publishForm(formId) {
    return this.updateForm(formId, { status: 'published' });
  }

  async unpublishForm(formId) {
    return this.updateForm(formId, { status: 'draft' });
  }

  // ── Submissions ──

  async addSubmission(formId, data) {
    const form = this.getForm(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);

    const submission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      form_id: formId,
      answers: data.answers || {},
      contact: data.contact || {},
      outcome: data.outcome || null,
      submitted_at: new Date().toISOString()
    };

    const submissions = await this.loadSubmissions(formId);
    submissions.push(submission);
    await this.saveSubmissions(formId, submissions);

    // Auto-add to pipeline as lead
    if (form.settings.add_to_pipeline && this.pipelineManager && data.contact) {
      try {
        const contact = data.contact;
        await this.pipelineManager.addLead({
          company: contact.name || 'Form Submission',
          contact_name: contact.name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          source: `form:${form.name}`,
          form_id: formId,
          submission_id: submission.id,
          do_not_contact: !!form.settings.protect_from_outreach,
          notes: [`Submitted "${form.name}" on ${new Date().toLocaleDateString()}`],
          tags: ['form-submission', form.type]
        });
      } catch (e) {
        console.error('[FormManager] Failed to add lead from submission:', e.message);
      }
    }

    eventBus.emit(EVENTS.FORM_SUBMISSION, { formId, submission, formName: form.name });
    return submission;
  }

  async getSubmissions(formId, options = {}) {
    const submissions = await this.loadSubmissions(formId);
    const { offset = 0, limit = 50 } = options;
    return {
      total: submissions.length,
      submissions: submissions.slice(-limit - offset, submissions.length - offset || undefined).reverse()
    };
  }

  async getSubmissionStats(formId) {
    const form = this.getForm(formId);
    if (!form) return null;

    const submissions = await this.loadSubmissions(formId);
    const stats = {
      total: submissions.length,
      by_step: {},
      by_outcome: {}
    };

    // Count answer distributions per step
    for (const sub of submissions) {
      for (const [stepId, answer] of Object.entries(sub.answers || {})) {
        if (!stats.by_step[stepId]) stats.by_step[stepId] = {};
        const values = Array.isArray(answer) ? answer : [answer];
        for (const v of values) {
          stats.by_step[stepId][v] = (stats.by_step[stepId][v] || 0) + 1;
        }
      }
      if (sub.outcome) {
        stats.by_outcome[sub.outcome] = (stats.by_outcome[sub.outcome] || 0) + 1;
      }
    }

    return stats;
  }

  async deleteSubmission(formId, submissionId) {
    const submissions = await this.loadSubmissions(formId);
    const idx = submissions.findIndex(s => s.id === submissionId);
    if (idx === -1) throw new Error(`Submission not found: ${submissionId}`);
    submissions.splice(idx, 1);
    await this.saveSubmissions(formId, submissions);
    return true;
  }

  // ── Firestore Sync ──

  async syncFromFirestore(formId) {
    const form = this.getForm(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);

    const fbConfig = form.settings?.firebase;
    if (!fbConfig?.projectId) {
      throw new Error('No Firebase config on this form. Deploy to Firebase first or add Firebase config in form settings.');
    }

    const projectId = fbConfig.projectId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/form_submissions/${formId}/entries?pageSize=300`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore API error (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const remoteEntries = (data.documents || []).map(doc => this._firestoreDocToPlain(doc));

    // Load existing local submissions
    const localSubmissions = await this.loadSubmissions(formId);
    const localSyncedIds = new Set(
      localSubmissions.filter(s => s.firestore_doc_id).map(s => s.firestore_doc_id)
    );

    let newCount = 0;
    for (const entry of remoteEntries) {
      // Skip if we already synced this Firestore document
      if (localSyncedIds.has(entry._docId)) continue;

      // Check for duplicate by timestamp + email
      const existing = localSubmissions.find(s =>
        s.submitted_at === entry.submitted_at &&
        s.contact?.email === entry.contact?.email &&
        s.contact?.email
      );
      if (existing) continue;

      const submission = {
        id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        form_id: formId,
        answers: entry.answers || {},
        contact: entry.contact || {},
        outcome: entry.outcome || null,
        submitted_at: entry.submitted_at || new Date().toISOString(),
        source: 'firebase_sync',
        firestore_doc_id: entry._docId
      };

      localSubmissions.push(submission);
      newCount++;

      // Auto-add to pipeline as lead
      if (form.settings.add_to_pipeline && this.pipelineManager && entry.contact) {
        try {
          const contact = entry.contact;
          await this.pipelineManager.addLead({
            company: contact.name || 'Form Submission',
            contact_name: contact.name || '',
            email: contact.email || '',
            phone: contact.phone || '',
            source: `form:${form.name}`,
            form_id: formId,
            submission_id: submission.id,
            do_not_contact: !!form.settings.protect_from_outreach,
            notes: [`Submitted "${form.name}" (synced from Firebase) on ${new Date(entry.submitted_at).toLocaleDateString()}`],
            tags: ['form-submission', 'firebase-sync', form.type]
          });
        } catch (e) {
          console.error('[FormManager] Failed to add lead from synced submission:', e.message);
        }
      }
    }

    if (newCount > 0) {
      await this.saveSubmissions(formId, localSubmissions);
      eventBus.emit(EVENTS.FORM_SUBMISSION, {
        formId,
        formName: form.name,
        synced: newCount,
        source: 'firebase_sync'
      });
    }

    console.log(`[FormManager] Synced ${newCount} new submissions from Firestore for ${formId}`);
    return { synced: newCount, total: localSubmissions.length };
  }

  _firestoreDocToPlain(doc) {
    const docId = doc.name?.split('/').pop() || '';
    const fields = doc.fields || {};
    const result = { _docId: docId };
    for (const [key, typedValue] of Object.entries(fields)) {
      result[key] = this._firestoreValueToPlain(typedValue);
    }
    return result;
  }

  _firestoreValueToPlain(typedValue) {
    if (!typedValue) return null;
    if (typedValue.stringValue !== undefined) return typedValue.stringValue;
    if (typedValue.integerValue !== undefined) return parseInt(typedValue.integerValue);
    if (typedValue.doubleValue !== undefined) return typedValue.doubleValue;
    if (typedValue.booleanValue !== undefined) return typedValue.booleanValue;
    if (typedValue.nullValue !== undefined) return null;
    if (typedValue.timestampValue !== undefined) return typedValue.timestampValue;
    if (typedValue.arrayValue) {
      return (typedValue.arrayValue.values || []).map(v => this._firestoreValueToPlain(v));
    }
    if (typedValue.mapValue) {
      const obj = {};
      for (const [k, v] of Object.entries(typedValue.mapValue.fields || {})) {
        obj[k] = this._firestoreValueToPlain(v);
      }
      return obj;
    }
    return null;
  }
}

export { FormManager };
export default FormManager;
