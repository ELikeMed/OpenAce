/**
 * OpenAce Embed SDK — Constants & Defaults
 */

export const VERSION = '1.0.0';

// ── License Tiers ──
export const TIERS = {
  TRIAL: 'trial',
  PRO: 'pro',
  EXPIRED: 'expired'
};

export const TRIAL_DAYS = 30;

// ── Feature Limits (Trial vs Pro) ──
// Trial is generous — users bring their own AI keys, we're not paying for usage.
// Pro value = watermark removal + cron scheduling.
export const LIMITS = {
  trial: {
    interactions: Infinity,
    forms: 3,
    seoAudits: Infinity,
    blogPosts: Infinity,
    leadSearches: Infinity,
    cron: false,
    watermark: true
  },
  pro: {
    interactions: Infinity,
    forms: Infinity,
    seoAudits: Infinity,
    blogPosts: Infinity,
    leadSearches: Infinity,
    cron: true,
    watermark: false
  }
};

// ── Tool Groups (site management focused) ──
export const TOOL_GROUPS = {
  research:   ['web_search', 'read_webpage', 'read_site_page'],
  seo:        ['analyze_seo', 'generate_blog_post', 'optimize_page_seo', 'generate_structured_data'],
  source:     ['list_source_files', 'read_source_file', 'edit_source_file'],
  leads:      ['find_leads'],
  projects:   ['create_project', 'write_project_file', 'list_project_files', 'read_project_file', 'edit_project_file', 'list_projects'],
  forms:      ['create_form', 'list_forms', 'get_form_submissions'],
  images:     ['generate_image'],
  calendar:   ['plan_content_calendar'],
  memory:     ['save_note', 'recall_notes'],
};

// ── Tool Labels (user-friendly names for the widget) ──
export const TOOL_LABELS = {
  web_search: { label: 'Searching the web', icon: 'search' },
  read_webpage: { label: 'Reading webpage', icon: 'web' },
  read_site_page: { label: 'Reading site page', icon: 'web' },
  list_source_files: { label: 'Browsing source files', icon: 'folder' },
  read_source_file: { label: 'Reading source file', icon: 'code' },
  edit_source_file: { label: 'Editing source file', icon: 'code' },
  find_leads: { label: 'Finding leads', icon: 'people' },
  create_form: { label: 'Creating form', icon: 'form' },
  list_forms: { label: 'Listing forms', icon: 'form' },
  get_form_submissions: { label: 'Getting submissions', icon: 'form' },
  create_project: { label: 'Creating project', icon: 'code' },
  write_project_file: { label: 'Writing file', icon: 'code' },
  list_project_files: { label: 'Listing files', icon: 'code' },
  list_projects: { label: 'Listing projects', icon: 'code' },
  read_project_file: { label: 'Reading file', icon: 'code' },
  edit_project_file: { label: 'Editing file', icon: 'code' },
  save_note: { label: 'Saving note', icon: 'note' },
  recall_notes: { label: 'Recalling notes', icon: 'note' },
  analyze_seo: { label: 'Analyzing SEO', icon: 'seo' },
  generate_blog_post: { label: 'Writing blog post', icon: 'blog' },
  optimize_page_seo: { label: 'Optimizing SEO', icon: 'seo' },
  generate_structured_data: { label: 'Generating schema', icon: 'code' },
  generate_image: { label: 'Generating image', icon: 'image' },
  plan_content_calendar: { label: 'Planning content', icon: 'calendar' },
};

// ── License API ──
export const LICENSE_API_URL = 'https://api.openaceai.com/v1/license';
