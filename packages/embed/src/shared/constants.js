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
export const LIMITS = {
  trial: {
    interactions: 100,
    leads: 25,
    forms: 1,
    emails: 10,
    seoAudits: 5,
    blogPosts: 3,
    workloadFiles: 3,
    cron: false,
    social: false,
    watermark: true
  },
  pro: {
    interactions: Infinity,
    leads: Infinity,
    forms: Infinity,
    emails: Infinity,
    seoAudits: Infinity,
    blogPosts: Infinity,
    workloadFiles: Infinity,
    cron: true,
    social: true,
    watermark: false
  }
};

// ── Tool Groups (embeddable only — no desktop/browser tools) ──
export const TOOL_GROUPS = {
  research:   ['web_search', 'read_webpage', 'recall_research', 'get_site_memory'],
  email:      ['send_email'],
  phone:      ['send_sms', 'make_call', 'dispatch_phone_call'],
  pipeline:   ['find_leads', 'save_leads', 'get_pipeline', 'move_lead', 'set_lead_dnc'],
  contacts:   ['manage_contacts'],
  scheduler:  ['schedule_task'],
  goals:      ['manage_goals'],
  calendar:   ['list_calendar_events', 'create_calendar_event', 'delete_calendar_event'],
  social:     ['post_social_media', 'schedule_social_post', 'create_content_plan', 'select_media_for_content'],
  forms:      ['create_form', 'list_forms', 'get_form_submissions'],
  projects:   ['create_project', 'write_project_file', 'list_project_files', 'read_project_file', 'edit_project_file'],
  memory:     ['save_note', 'recall_notes'],
  workload:   ['search_workload', 'list_workload_sources', 'list_media'],
  deploy:     ['deploy_project'],
  seo:        ['analyze_seo', 'generate_blog_post', 'optimize_page_seo', 'generate_structured_data']
};

// ── Tool Labels (user-friendly names for the widget) ──
export const TOOL_LABELS = {
  web_search: { label: 'Searching the web', icon: 'search' },
  read_webpage: { label: 'Reading webpage', icon: 'web' },
  recall_research: { label: 'Recalling research', icon: 'history' },
  get_site_memory: { label: 'Checking site memory', icon: 'memory' },
  send_email: { label: 'Sending email', icon: 'email' },
  send_sms: { label: 'Sending SMS', icon: 'sms' },
  make_call: { label: 'Making call', icon: 'phone' },
  dispatch_phone_call: { label: 'Dispatching phone agent', icon: 'phone' },
  find_leads: { label: 'Finding leads', icon: 'people' },
  save_leads: { label: 'Saving leads', icon: 'save' },
  get_pipeline: { label: 'Checking pipeline', icon: 'pipeline' },
  move_lead: { label: 'Moving lead', icon: 'move' },
  set_lead_dnc: { label: 'Updating lead', icon: 'block' },
  manage_contacts: { label: 'Managing contacts', icon: 'contacts' },
  schedule_task: { label: 'Scheduling task', icon: 'schedule' },
  manage_goals: { label: 'Managing goals', icon: 'target' },
  list_calendar_events: { label: 'Checking calendar', icon: 'calendar' },
  create_calendar_event: { label: 'Creating event', icon: 'calendar' },
  delete_calendar_event: { label: 'Removing event', icon: 'calendar' },
  post_social_media: { label: 'Posting to social', icon: 'social' },
  schedule_social_post: { label: 'Scheduling post', icon: 'social' },
  create_content_plan: { label: 'Planning content', icon: 'content' },
  select_media_for_content: { label: 'Selecting media', icon: 'media' },
  create_form: { label: 'Creating form', icon: 'form' },
  list_forms: { label: 'Listing forms', icon: 'form' },
  get_form_submissions: { label: 'Getting submissions', icon: 'form' },
  create_project: { label: 'Creating project', icon: 'code' },
  write_project_file: { label: 'Writing file', icon: 'code' },
  list_project_files: { label: 'Listing files', icon: 'code' },
  read_project_file: { label: 'Reading file', icon: 'code' },
  edit_project_file: { label: 'Editing file', icon: 'code' },
  save_note: { label: 'Saving note', icon: 'note' },
  recall_notes: { label: 'Recalling notes', icon: 'note' },
  search_workload: { label: 'Searching knowledge', icon: 'search' },
  list_workload_sources: { label: 'Listing sources', icon: 'database' },
  list_media: { label: 'Browsing media', icon: 'media' },
  deploy_project: { label: 'Deploying project', icon: 'deploy' },
  analyze_seo: { label: 'Analyzing SEO', icon: 'seo' },
  generate_blog_post: { label: 'Writing blog post', icon: 'blog' },
  optimize_page_seo: { label: 'Optimizing SEO', icon: 'seo' },
  generate_structured_data: { label: 'Generating schema', icon: 'code' }
};

// ── Desktop-Only Tools (used for upsell detection) ──
export const DESKTOP_KEYWORDS = [
  'automate my browser', 'control my browser', 'click on', 'browser automation',
  'record this process', 'teach you how', 'train you', 'create a procedure',
  'take a screenshot', 'screen', 'SOP', 'playbook', 'desktop'
];

// ── License API ──
export const LICENSE_API_URL = 'https://api.openaceai.com/v1/license';
