import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, alpha, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Tabs, Tab, Tooltip, Grid, Switch, FormControlLabel, Snackbar, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import BarChartIcon from '@mui/icons-material/BarChart';
import QuizIcon from '@mui/icons-material/Quiz';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import CircularProgress from '@mui/material/CircularProgress';
import { BRAND } from '../theme';

const STATUS_COLORS = {
  published: BRAND.success,
  draft: BRAND.textMuted,
};

const TYPE_LABELS = {
  quiz: 'Quiz',
  form: 'Form',
  survey: 'Survey',
};

const STEP_TYPES = [
  { value: 'single_select', label: 'Single Choice' },
  { value: 'multi_select', label: 'Multiple Choice' },
  { value: 'text_input', label: 'Short Text' },
  { value: 'email_input', label: 'Email' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'rating', label: 'Rating' },
];

const TEMPLATES = [
  {
    name: 'Onboarding Quiz',
    type: 'quiz',
    description: 'Qualify new users with a multi-step quiz',
    steps: [
      { id: 'step-1', title: "What's your experience level with AI?", type: 'single_select', required: true, options: [
        { label: 'Brand new', emoji: '🌱', value: 'brand_new' },
        { label: 'Tried ChatGPT', emoji: '🧪', value: 'tried_chatgpt' },
        { label: 'Use AI daily', emoji: '🚀', value: 'daily_user' },
        { label: 'Building with AI', emoji: '🔧', value: 'builder' },
      ]},
      { id: 'step-2', title: 'What are you most interested in?', type: 'multi_select', required: true, options: [
        { label: 'Build apps with AI', emoji: '💻', value: 'build_apps' },
        { label: 'Automate my workflow', emoji: '⚡', value: 'automation' },
        { label: 'Research & analysis', emoji: '🔍', value: 'research' },
        { label: 'Content creation', emoji: '✍️', value: 'content' },
      ]},
      { id: 'step-3', title: 'How big is your team?', type: 'single_select', required: true, options: [
        { label: 'Just me', emoji: '🧑', value: 'solo' },
        { label: '2-5 people', emoji: '👥', value: 'small' },
        { label: '6-20 people', emoji: '🏢', value: 'medium' },
        { label: '20+ people', emoji: '🏙️', value: 'large' },
      ]},
    ],
    settings: { collect_contact: true, contact_fields: ['name', 'email'], submit_button_text: 'Get My Results', add_to_pipeline: true },
    results: {
      enabled: true,
      outcomes: [
        { title: 'Vibe Coder', description: 'You\'re ready to build apps using plain English. Start with a simple project and iterate.', match_tags: ['build_apps', 'builder'], cta_text: 'Start Building' },
        { title: 'Automation Pro', description: 'You\'re looking to streamline your workflow. Let\'s set up your first automation.', match_tags: ['automation', 'daily_user'], cta_text: 'Automate Now' },
        { title: 'Research Explorer', description: 'AI-powered research will save you hours. Let\'s dive in.', match_tags: ['research', 'tried_chatgpt'], cta_text: 'Start Researching' },
      ],
      default_outcome: { title: 'Welcome Aboard!', description: 'We\'ll customize your experience based on your interests.', cta_text: 'Get Started' }
    }
  },
  {
    name: 'Contact Form',
    type: 'form',
    description: 'Simple contact form with name, email, and message',
    steps: [
      { id: 'step-1', title: 'How can we help you?', subtitle: 'Select the best option', type: 'single_select', required: true, options: [
        { label: 'General inquiry', emoji: '💬', value: 'general' },
        { label: 'Partnership', emoji: '🤝', value: 'partnership' },
        { label: 'Support', emoji: '🛠️', value: 'support' },
        { label: 'Feedback', emoji: '⭐', value: 'feedback' },
      ]},
      { id: 'step-2', title: 'Tell us more', subtitle: 'Share the details', type: 'textarea', required: true, placeholder: 'What would you like to discuss?' },
    ],
    settings: { collect_contact: true, contact_fields: ['name', 'email', 'phone'], submit_button_text: 'Send Message', add_to_pipeline: true },
    results: { enabled: false }
  },
  {
    name: 'Feedback Survey',
    type: 'survey',
    description: 'Collect customer satisfaction and feedback',
    steps: [
      { id: 'step-1', title: 'How would you rate your experience?', type: 'rating', required: true, max: 5 },
      { id: 'step-2', title: 'What did you enjoy most?', type: 'multi_select', required: false, options: [
        { label: 'Ease of use', emoji: '✨', value: 'ease' },
        { label: 'Speed', emoji: '⚡', value: 'speed' },
        { label: 'Features', emoji: '🎯', value: 'features' },
        { label: 'Support', emoji: '💬', value: 'support' },
      ]},
      { id: 'step-3', title: 'Any suggestions for improvement?', type: 'textarea', required: false, placeholder: 'We\'d love to hear your thoughts...' },
    ],
    settings: { collect_contact: true, contact_fields: ['name', 'email'], submit_button_text: 'Submit Feedback', add_to_pipeline: false },
    results: { enabled: false }
  },
  {
    name: 'Lead Qualifier',
    type: 'quiz',
    description: 'Qualify inbound leads with targeted questions',
    steps: [
      { id: 'step-1', title: 'What best describes your role?', type: 'single_select', required: true, options: [
        { label: 'Founder / CEO', emoji: '👔', value: 'founder' },
        { label: 'Manager', emoji: '📋', value: 'manager' },
        { label: 'Developer', emoji: '💻', value: 'developer' },
        { label: 'Marketing', emoji: '📣', value: 'marketing' },
      ]},
      { id: 'step-2', title: 'What\'s your timeline?', type: 'single_select', required: true, options: [
        { label: 'This week', emoji: '🔥', value: 'urgent' },
        { label: 'This month', emoji: '📅', value: 'soon' },
        { label: 'This quarter', emoji: '🗓️', value: 'quarter' },
        { label: 'Just exploring', emoji: '🔭', value: 'exploring' },
      ]},
      { id: 'step-3', title: 'What\'s your budget range?', type: 'single_select', required: true, options: [
        { label: 'Under $1K', emoji: '💵', value: 'under_1k' },
        { label: '$1K - $5K', emoji: '💰', value: '1k_5k' },
        { label: '$5K - $20K', emoji: '💎', value: '5k_20k' },
        { label: '$20K+', emoji: '🏆', value: 'over_20k' },
      ]},
    ],
    settings: { collect_contact: true, contact_fields: ['name', 'email', 'phone'], submit_button_text: 'Get Started', add_to_pipeline: true },
    results: {
      enabled: true,
      outcomes: [
        { title: 'Hot Lead', description: 'You\'re ready to go! We\'ll reach out within 24 hours.', match_tags: ['urgent', 'founder', 'over_20k'], cta_text: 'Book a Call' },
        { title: 'Great Fit', description: 'Looks like we can help. Let\'s schedule a demo.', match_tags: ['soon', 'manager', '5k_20k'], cta_text: 'Schedule Demo' },
      ],
      default_outcome: { title: 'Thanks for your interest!', description: 'We\'ll be in touch with more information.', cta_text: 'Done' }
    }
  },
];

const emptyStep = () => ({
  id: `step-${Date.now()}`,
  title: '',
  subtitle: '',
  type: 'single_select',
  required: true,
  options: [
    { label: 'Option 1', emoji: '', value: 'option_1' },
    { label: 'Option 2', emoji: '', value: 'option_2' },
  ],
});

export default function Forms() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [subsOpen, setSubsOpen] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [snack, setSnack] = useState(null);
  const [deployForm, setDeployForm] = useState(null);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch('/api/forms');
      const data = await res.json();
      if (data.success) setForms(data.data || []);
    } catch (e) {
      console.error('Failed to fetch forms:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  // SSE auto-refresh
  useEffect(() => {
    let es;
    try {
      es = new EventSource('/api/events/stream');
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.event?.startsWith('form:')) fetchForms();
        } catch {}
      };
    } catch {}
    return () => es?.close();
  }, [fetchForms]);

  const filtered = forms.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = async (formData) => {
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSnack({ msg: `Form "${data.data.name}" created!`, severity: 'success' });
        fetchForms();
      } else {
        setSnack({ msg: data.error || 'Failed to create form', severity: 'error' });
      }
    } catch (e) {
      console.error('Form creation error:', e);
      setSnack({ msg: 'Failed to create form — is the server running?', severity: 'error' });
    }
    setCreateOpen(false);
  };

  const handleUpdate = async (formId, updates) => {
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setSnack({ msg: 'Form updated!', severity: 'success' });
        fetchForms();
      }
    } catch (e) {
      setSnack({ msg: 'Failed to update form', severity: 'error' });
    }
    setEditForm(null);
  };

  const handleDelete = async (formId, formName) => {
    if (!window.confirm(`Delete "${formName}"? This also deletes all submissions.`)) return;
    try {
      await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
      setSnack({ msg: `Form "${formName}" deleted`, severity: 'info' });
      fetchForms();
    } catch {}
  };

  const handlePublish = async (formId, publish) => {
    try {
      await fetch(`/api/forms/${formId}/${publish ? 'publish' : 'unpublish'}`, { method: 'POST' });
      fetchForms();
    } catch {}
  };

  const handleViewSubmissions = async (form) => {
    setSubsOpen(form);
    try {
      const res = await fetch(`/api/forms/${form.id}/submissions`);
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data.submissions || []);
        setSubsTotal(data.data.total || 0);
      }
    } catch {}
  };

  const copyUrl = (slug) => {
    const url = `${window.location.origin}/forms/${slug}`;
    navigator.clipboard.writeText(url);
    setSnack({ msg: 'URL copied!', severity: 'success' });
  };

  const formatDate = (d) => {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Box sx={{ p: 0 }}>
      {/* Header */}
      <Paper sx={{
        p: 2.5, mb: 2.5, borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.accent, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.accent, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.accent, 0.3)}`,
          }}>
            <QuizIcon sx={{ fontSize: 24, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: BRAND.textPrimary }}>Forms & Quizzes</Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              {forms.length} form{forms.length !== 1 ? 's' : ''} &middot; {forms.filter(f => f.status === 'published').length} published
            </Typography>
          </Box>
          <IconButton onClick={fetchForms} sx={{ color: BRAND.textMuted, mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
              textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 3,
              '&:hover': { boxShadow: `0 4px 15px ${alpha(BRAND.accent, 0.4)}` },
            }}
          >
            Create Form
          </Button>
        </Box>
      </Paper>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
          {filtered.length} form{filtered.length !== 1 ? 's' : ''}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {['all', 'published', 'draft'].map(s => (
          <Chip
            key={s}
            label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            size="small"
            onClick={() => setStatusFilter(s)}
            sx={{
              fontWeight: 600, fontSize: '0.75rem',
              background: statusFilter === s ? alpha(BRAND.primary, 0.15) : 'transparent',
              color: statusFilter === s ? BRAND.primary : BRAND.textMuted,
              border: `1px solid ${statusFilter === s ? alpha(BRAND.primary, 0.3) : BRAND.border}`,
              '&:hover': { background: alpha(BRAND.primary, 0.1) },
            }}
          />
        ))}
      </Box>

      {/* Form Cards */}
      {loading ? (
        <Typography sx={{ color: BRAND.textMuted, textAlign: 'center', py: 4 }}>Loading forms...</Typography>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', background: BRAND.bgCard, borderRadius: 3 }}>
          <QuizIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 2 }} />
          <Typography variant="h6" sx={{ color: BRAND.textSecondary, mb: 1 }}>
            {forms.length === 0 ? 'No forms yet' : 'No forms match your filters'}
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
            {forms.length === 0 ? 'Create your first form or quiz to collect responses.' : 'Try adjusting your search or filters.'}
          </Typography>
          {forms.length === 0 && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
              sx={{ textTransform: 'none', borderColor: BRAND.primary, color: BRAND.primary }}>
              Create Form
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filtered.map(form => (
            <Grid item xs={12} sm={6} md={4} key={form.id}>
              <Paper sx={{
                p: 2.5, borderRadius: 2.5, background: BRAND.bgCard,
                border: `1px solid ${BRAND.border}`,
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: alpha(BRAND.primary, 0.3), transform: 'translateY(-2px)' },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: BRAND.textPrimary, mb: 0.25 }}>
                      {form.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <Chip label={TYPE_LABELS[form.type] || form.type} size="small" sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        background: alpha(BRAND.primary, 0.1), color: BRAND.primaryLight,
                      }} />
                      <Chip label={form.status} size="small" sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        background: alpha(STATUS_COLORS[form.status] || BRAND.textMuted, 0.1),
                        color: STATUS_COLORS[form.status] || BRAND.textMuted,
                      }} />
                    </Box>
                  </Box>
                </Box>

                {form.description && (
                  <Typography variant="caption" sx={{
                    color: BRAND.textMuted, display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1.5,
                  }}>
                    {form.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Steps</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>{form.steps?.length || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Responses</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>{form.submission_count || 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Created</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary, fontSize: '0.75rem' }}>{formatDate(form.created_at)}</Typography>
                  </Box>
                </Box>

                {form.status === 'published' && (
                  <Box sx={{
                    p: 1, mb: 1.5, borderRadius: 1,
                    background: alpha(BRAND.success, 0.05), border: `1px solid ${alpha(BRAND.success, 0.15)}`,
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}>
                    <Typography variant="caption" sx={{ color: BRAND.success, flex: 1, fontWeight: 500 }}>
                      /forms/{form.slug}
                    </Typography>
                    <Tooltip title="Copy URL">
                      <IconButton size="small" onClick={() => copyUrl(form.slug)} sx={{ p: 0.25, color: BRAND.success }}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Open">
                      <IconButton size="small" onClick={() => window.open(`/forms/${form.slug}`, '_blank')}
                        sx={{ p: 0.25, color: BRAND.success }}>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Tooltip title="Preview">
                    <IconButton size="small" onClick={() => window.open(`/api/forms/${form.id}/preview`, '_blank')}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.info } }}>
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditForm(form)}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.primary } }}>
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Responses">
                    <IconButton size="small" onClick={() => handleViewSubmissions(form)}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.secondary } }}>
                      <BarChartIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Deploy to web">
                    <IconButton size="small" onClick={() => setDeployForm(form)}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.accent } }}>
                      <RocketLaunchIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={form.status === 'published' ? 'Unpublish' : 'Publish'}>
                    <IconButton size="small" onClick={() => handlePublish(form.id, form.status !== 'published')}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: form.status === 'published' ? BRAND.warning : BRAND.success } }}>
                      {form.status === 'published' ? <UnpublishedIcon sx={{ fontSize: 18 }} /> : <PublishIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(form.id, form.name)}
                      sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Dialog */}
      <CreateFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

      {/* Edit Dialog */}
      {editForm && (
        <EditFormDialog form={editForm} onClose={() => setEditForm(null)} onSave={(updates) => handleUpdate(editForm.id, updates)} />
      )}

      {/* Submissions Dialog */}
      {subsOpen && (
        <SubmissionsDialog
          form={subsOpen}
          submissions={submissions}
          total={subsTotal}
          onClose={() => { setSubsOpen(null); setSubmissions([]); }}
          onRefresh={() => handleViewSubmissions(subsOpen)}
        />
      )}

      {/* Deploy Dialog */}
      {deployForm && (
        <DeployFormDialog
          form={deployForm}
          onClose={() => setDeployForm(null)}
          onDeployed={(url) => {
            setSnack({ msg: `Deployed! ${url}`, severity: 'success' });
            setDeployForm(null);
          }}
        />
      )}

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.msg}</Alert>}
      </Snackbar>
    </Box>
  );
}

// ── Create Form Dialog ──

function CreateFormDialog({ open, onClose, onCreate }) {
  const [step, setStep] = useState('template'); // 'template' | 'custom'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('form');
  const [formSteps, setFormSteps] = useState([emptyStep()]);
  const [collectContact, setCollectContact] = useState(true);
  const [addToPipeline, setAddToPipeline] = useState(true);

  const handleTemplate = (template) => {
    onCreate({
      name: template.name,
      description: template.description,
      type: template.type,
      status: 'published',
      steps: template.steps,
      settings: template.settings,
      results: template.results,
    });
  };

  const handleCustom = () => {
    onCreate({
      name: name || 'Untitled Form',
      description,
      type,
      status: 'draft',
      steps: formSteps.filter(s => s.title.trim()),
      settings: {
        collect_contact: collectContact,
        contact_fields: ['name', 'email'],
        add_to_pipeline: addToPipeline,
      },
    });
  };

  const resetState = () => {
    setStep('template');
    setName('');
    setDescription('');
    setType('form');
    setFormSteps([emptyStep()]);
  };

  return (
    <Dialog open={open} onClose={() => { onClose(); resetState(); }} maxWidth="md" fullWidth
      PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3, border: `1px solid ${BRAND.border}` } }}>
      <DialogTitle sx={{ color: BRAND.textPrimary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <QuizIcon sx={{ color: BRAND.accent }} />
        Create Form
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => { onClose(); resetState(); }} sx={{ color: BRAND.textMuted }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {step === 'template' ? (
          <Box>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Start from a template or build from scratch.
            </Typography>
            <Grid container spacing={2}>
              {TEMPLATES.map((t, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Paper
                    onClick={() => handleTemplate(t)}
                    sx={{
                      p: 2, borderRadius: 2, cursor: 'pointer',
                      background: BRAND.bgSurface, border: `1px solid ${BRAND.border}`,
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: BRAND.primary, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BRAND.textPrimary, mb: 0.5 }}>
                      {t.name}
                    </Typography>
                    <Chip label={TYPE_LABELS[t.type]} size="small" sx={{
                      height: 18, fontSize: '0.6rem', fontWeight: 600, mb: 1,
                      background: alpha(BRAND.primary, 0.1), color: BRAND.primaryLight,
                    }} />
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block' }}>
                      {t.description}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      {t.steps.length} steps
                    </Typography>
                  </Paper>
                </Grid>
              ))}
              <Grid item xs={12} sm={6}>
                <Paper
                  onClick={() => setStep('custom')}
                  sx={{
                    p: 2, borderRadius: 2, cursor: 'pointer',
                    background: BRAND.bgSurface, border: `2px dashed ${BRAND.border}`,
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 100, flexDirection: 'column',
                    '&:hover': { borderColor: BRAND.accent },
                  }}
                >
                  <AddIcon sx={{ fontSize: 28, color: BRAND.textMuted, mb: 0.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.textSecondary }}>
                    Build from Scratch
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField fullWidth label="Form Name" value={name} onChange={e => setName(e.target.value)} size="small" />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select value={type} onChange={e => setType(e.target.value)} label="Type">
                  <MenuItem value="form">Form</MenuItem>
                  <MenuItem value="quiz">Quiz</MenuItem>
                  <MenuItem value="survey">Survey</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <TextField fullWidth label="Description" value={description} onChange={e => setDescription(e.target.value)} size="small" sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ color: BRAND.textSecondary, mb: 1, fontWeight: 600 }}>Steps</Typography>
            {formSteps.map((s, idx) => (
              <StepEditor key={s.id} step={s} index={idx}
                onChange={(updated) => {
                  const copy = [...formSteps];
                  copy[idx] = updated;
                  setFormSteps(copy);
                }}
                onDelete={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}
              />
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setFormSteps([...formSteps, emptyStep()])}
              sx={{ textTransform: 'none', color: BRAND.primary, mb: 2 }}>
              Add Step
            </Button>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel control={<Switch checked={collectContact} onChange={e => setCollectContact(e.target.checked)} size="small" />}
                label={<Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Collect contact info</Typography>} />
              <FormControlLabel control={<Switch checked={addToPipeline} onChange={e => setAddToPipeline(e.target.checked)} size="small" />}
                label={<Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Add to Pipeline</Typography>} />
            </Box>
          </Box>
        )}
      </DialogContent>
      {step === 'custom' && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStep('template')} sx={{ textTransform: 'none', color: BRAND.textMuted }}>Back</Button>
          <Button variant="contained" onClick={handleCustom}
            sx={{ textTransform: 'none', background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})` }}>
            Create Form
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

// ── Step Editor ──

function StepEditor({ step, index, onChange, onDelete }) {
  const updateField = (field, value) => onChange({ ...step, [field]: value });
  const isSelectType = step.type === 'single_select' || step.type === 'multi_select';

  return (
    <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2, background: BRAND.bgSurface, border: `1px solid ${BRAND.border}` }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <DragIndicatorIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
        <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600 }}>Step {index + 1}</Typography>
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select value={step.type} onChange={e => updateField('type', e.target.value)} size="small" sx={{ fontSize: '0.75rem' }}>
            {STEP_TYPES.map(t => <MenuItem key={t.value} value={t.value} sx={{ fontSize: '0.75rem' }}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
        <IconButton size="small" onClick={onDelete} sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <TextField fullWidth size="small" placeholder="Question title" value={step.title}
        onChange={e => updateField('title', e.target.value)} sx={{ mb: 1 }} />

      {isSelectType && (
        <Box sx={{ pl: 2 }}>
          {(step.options || []).map((opt, oi) => (
            <Box key={oi} sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'center' }}>
              <TextField size="small" placeholder="Emoji" value={opt.emoji || ''}
                onChange={e => {
                  const opts = [...(step.options || [])];
                  opts[oi] = { ...opts[oi], emoji: e.target.value };
                  updateField('options', opts);
                }}
                sx={{ width: 60 }}
              />
              <TextField size="small" placeholder="Label" value={opt.label} sx={{ flex: 1 }}
                onChange={e => {
                  const opts = [...(step.options || [])];
                  opts[oi] = { ...opts[oi], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                  updateField('options', opts);
                }}
              />
              <IconButton size="small" onClick={() => {
                const opts = (step.options || []).filter((_, i) => i !== oi);
                updateField('options', opts);
              }} sx={{ color: BRAND.textMuted }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          <Button size="small" onClick={() => {
            const opts = [...(step.options || []), { label: '', emoji: '', value: '' }];
            updateField('options', opts);
          }} sx={{ textTransform: 'none', color: BRAND.primary, fontSize: '0.7rem' }}>
            + Add Option
          </Button>
        </Box>
      )}
    </Paper>
  );
}

// ── Edit Form Dialog ──

function EditFormDialog({ form, onClose, onSave }) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description || '');
  const [type, setType] = useState(form.type);
  const [steps, setSteps] = useState(form.steps || []);
  const [collectContact, setCollectContact] = useState(form.settings?.collect_contact !== false);
  const [addToPipeline, setAddToPipeline] = useState(form.settings?.add_to_pipeline !== false);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3, border: `1px solid ${BRAND.border}` } }}>
      <DialogTitle sx={{ color: BRAND.textPrimary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon sx={{ color: BRAND.primary }} />
        Edit: {form.name}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} sx={{ color: BRAND.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
          <TextField fullWidth label="Form Name" value={name} onChange={e => setName(e.target.value)} size="small" />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select value={type} onChange={e => setType(e.target.value)} label="Type">
              <MenuItem value="form">Form</MenuItem>
              <MenuItem value="quiz">Quiz</MenuItem>
              <MenuItem value="survey">Survey</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <TextField fullWidth label="Description" value={description} onChange={e => setDescription(e.target.value)} size="small" sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ color: BRAND.textSecondary, mb: 1, fontWeight: 600 }}>Steps</Typography>
        {steps.map((s, idx) => (
          <StepEditor key={s.id} step={s} index={idx}
            onChange={(updated) => {
              const copy = [...steps];
              copy[idx] = updated;
              setSteps(copy);
            }}
            onDelete={() => setSteps(steps.filter((_, i) => i !== idx))}
          />
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setSteps([...steps, emptyStep()])}
          sx={{ textTransform: 'none', color: BRAND.primary, mb: 2 }}>
          Add Step
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel control={<Switch checked={collectContact} onChange={e => setCollectContact(e.target.checked)} size="small" />}
            label={<Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Collect contact info</Typography>} />
          <FormControlLabel control={<Switch checked={addToPipeline} onChange={e => setAddToPipeline(e.target.checked)} size="small" />}
            label={<Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Add to Pipeline</Typography>} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: BRAND.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave({ name, description, type, steps, settings: { collect_contact: collectContact, add_to_pipeline: addToPipeline, contact_fields: ['name', 'email'] } })}
          sx={{ textTransform: 'none', background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})` }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Submissions Dialog ──

function SubmissionsDialog({ form, submissions, total, onClose, onRefresh }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/forms/${form.id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ msg: `Synced ${data.data.synced} new submission${data.data.synced !== 1 ? 's' : ''}`, severity: 'success' });
        if (data.data.synced > 0 && onRefresh) onRefresh();
      } else {
        setSyncResult({ msg: data.error || 'Sync failed', severity: 'error' });
      }
    } catch (e) {
      setSyncResult({ msg: e.message, severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3, border: `1px solid ${BRAND.border}` } }}>
      <DialogTitle sx={{ color: BRAND.textPrimary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BarChartIcon sx={{ color: BRAND.secondary }} />
        Responses: {form.name}
        <Chip label={`${total} total`} size="small" sx={{
          ml: 1, height: 22, fontWeight: 600, fontSize: '0.7rem',
          background: alpha(BRAND.secondary, 0.1), color: BRAND.secondary,
        }} />
        {form.settings?.firebase?.projectId && (
          <Tooltip title="Pull new submissions from Firebase">
            <Button size="small" onClick={handleSync} disabled={syncing}
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              sx={{ ml: 1, textTransform: 'none', fontSize: '0.7rem', color: BRAND.warning,
                border: `1px solid ${alpha(BRAND.warning, 0.3)}`, borderRadius: 2, px: 1.5,
                '&:hover': { background: alpha(BRAND.warning, 0.08) }
              }}>
              {syncing ? 'Syncing...' : 'Sync Firebase'}
            </Button>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} sx={{ color: BRAND.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      {syncResult && (
        <Alert severity={syncResult.severity} sx={{ mx: 3, mb: 1 }} onClose={() => setSyncResult(null)}>
          {syncResult.msg}
        </Alert>
      )}
      <DialogContent>
        {submissions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <BarChartIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
            <Typography variant="body2" sx={{ color: BRAND.textMuted }}>No submissions yet.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ background: BRAND.bgSurface, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderBottom: `1px solid ${BRAND.border}`, color: BRAND.textSecondary, fontWeight: 600, fontSize: '0.75rem' } }}>
                  <TableCell>Contact</TableCell>
                  <TableCell>Answers</TableCell>
                  {form.results?.enabled && <TableCell>Outcome</TableCell>}
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {submissions.map(sub => (
                  <TableRow key={sub.id} sx={{ '& td': { borderBottom: `1px solid ${alpha(BRAND.border, 0.5)}`, py: 1.5 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                        {sub.contact?.name || '--'}
                      </Typography>
                      {sub.contact?.email && (
                        <Typography variant="caption" sx={{ color: BRAND.info }}>{sub.contact.email}</Typography>
                      )}
                      {sub.contact?.phone && (
                        <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block' }}>{sub.contact.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(sub.answers || {}).map(([key, val]) => (
                          <Chip key={key} label={Array.isArray(val) ? val.join(', ') : String(val)}
                            size="small" sx={{
                              height: 20, fontSize: '0.6rem',
                              background: alpha(BRAND.primary, 0.08), color: BRAND.textSecondary,
                            }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    {form.results?.enabled && (
                      <TableCell>
                        <Typography variant="caption" sx={{ color: BRAND.accent, fontWeight: 600 }}>
                          {sub.outcome || '--'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '--'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Deploy Form Dialog ──

function DeployFormDialog({ form, onClose, onDeployed }) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [firebaseConfig, setFirebaseConfig] = useState(form.settings?.firebase || null);
  const [firebaseConfigText, setFirebaseConfigText] = useState(
    form.settings?.firebase ? JSON.stringify(form.settings.firebase, null, 2) : ''
  );
  const [showFirebaseInput, setShowFirebaseInput] = useState(false);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    fetch('/api/deploy/targets')
      .then(r => r.json())
      .then(data => {
        if (data.success !== false) {
          const t = data.targets || data.data || [];
          setTargets(t);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDeploy = async (target) => {
    // For Firebase: require config for Firestore submissions
    if (target.name === 'firebase' && !firebaseConfig) {
      setShowFirebaseInput(true);
      setSelectedTarget(target.name);
      return;
    }

    setDeploying(true);
    setSelectedTarget(target.name);
    setResult(null);
    try {
      const options = {};
      if (target.name === 'firebase' && firebaseConfig) {
        options.firebaseConfig = firebaseConfig;
      }
      const res = await fetch(`/api/forms/${form.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.name, options })
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setResult({ success: true, url: data.data.url });
      } else if (data.success && data.data?.studioUrl) {
        setResult({ success: true, url: data.data.studioUrl, local: true });
      } else {
        setResult({ success: false, error: data.error || data.data?.logs?.slice(-1)[0] || 'Deploy failed' });
      }
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setDeploying(false);
    }
  };

  const TARGET_ICONS = {
    netlify: { color: '#00C7B7', label: 'Netlify' },
    firebase: { color: '#FFCA28', label: 'Firebase' },
    sftp: { color: '#74B9FF', label: 'SFTP' },
    local: { color: BRAND.textMuted, label: 'Local Preview' },
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3, border: `1px solid ${BRAND.border}` } }}>
      <DialogTitle sx={{ color: BRAND.textPrimary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <RocketLaunchIcon sx={{ color: BRAND.accent }} />
        Deploy: {form.name}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} sx={{ color: BRAND.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        {result?.success ? (
          <Box sx={{ py: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: BRAND.success, mb: 1 }} />
              <Typography variant="h6" sx={{ color: BRAND.textPrimary, mb: 1, fontWeight: 700 }}>
                Deployed!
              </Typography>
              <Box sx={{
                p: 1.5, borderRadius: 2, mb: 2,
                background: alpha(BRAND.success, 0.05), border: `1px solid ${alpha(BRAND.success, 0.2)}`,
              }}>
                <Typography
                  variant="body2"
                  component="a"
                  href={result.url}
                  target="_blank"
                  rel="noopener"
                  sx={{ color: BRAND.success, fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {result.url}
                </Typography>
              </Box>
              <Button size="small" onClick={() => {
                navigator.clipboard.writeText(result.url);
              }} sx={{ textTransform: 'none', color: BRAND.primary }}>
                Copy URL
              </Button>
              <Button size="small" onClick={() => window.open(result.url, '_blank')}
                sx={{ textTransform: 'none', color: BRAND.secondary, ml: 1 }}>
                Open
              </Button>
            </Box>
            {selectedTarget === 'firebase' && (
              <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: alpha(BRAND.warning, 0.05), border: `1px solid ${alpha(BRAND.warning, 0.15)}` }}>
                <Typography variant="subtitle2" sx={{ color: BRAND.warning, fontWeight: 700, mb: 1 }}>
                  Enable Firestore to receive submissions
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1.5 }}>
                  1. Go to Firebase Console &rarr; Cloud Firestore &rarr; Create database (production mode)<br/>
                  2. Go to Rules tab and paste these security rules:
                </Typography>
                <Box sx={{ position: 'relative' }}>
                  <pre style={{
                    fontSize: 11, color: BRAND.textSecondary, background: alpha(BRAND.bgSurface, 0.8),
                    padding: 12, borderRadius: 8, overflow: 'auto', margin: 0, lineHeight: 1.5,
                    border: `1px solid ${BRAND.border}`
                  }}>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /form_submissions/{formId}/entries/{entryId} {
      allow create: if true;
      allow read: if true;
      allow update, delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`}
                  </pre>
                  <Button size="small" onClick={() => {
                    navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /form_submissions/{formId}/entries/{entryId} {\n      allow create: if true;\n      allow read: if true;\n      allow update, delete: if false;\n    }\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}`);
                  }} sx={{ position: 'absolute', top: 4, right: 4, textTransform: 'none', fontSize: '0.65rem', color: BRAND.primary, minWidth: 0 }}>
                    Copy
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        ) : result?.success === false ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body1" sx={{ color: BRAND.error, mb: 1, fontWeight: 600 }}>Deploy Failed</Typography>
            <Typography variant="body2" sx={{ color: BRAND.textMuted }}>{result.error}</Typography>
            <Button size="small" onClick={() => setResult(null)} sx={{ mt: 2, textTransform: 'none', color: BRAND.primary }}>
              Try Again
            </Button>
          </Box>
        ) : deploying ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: BRAND.accent, mb: 2 }} />
            <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
              Deploying to {selectedTarget}...
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Choose a deploy target to make this form available at a public URL.
            </Typography>
            {loading ? (
              <Typography sx={{ color: BRAND.textMuted, textAlign: 'center', py: 2 }}>Loading targets...</Typography>
            ) : targets.length === 0 ? (
              <Typography sx={{ color: BRAND.textMuted, textAlign: 'center', py: 2 }}>
                No deploy targets found. Configure Netlify, Firebase, or SFTP in Settings.
              </Typography>
            ) : (
              <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {targets.map(t => {
                  const info = TARGET_ICONS[t.name] || { color: BRAND.textMuted, label: t.name };
                  return (
                    <Paper key={t.name}
                      onClick={() => t.configured && handleDeploy(t)}
                      sx={{
                        p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2,
                        background: BRAND.bgSurface, border: `1px solid ${BRAND.border}`,
                        cursor: t.configured ? 'pointer' : 'default',
                        opacity: t.configured ? 1 : 0.5,
                        transition: 'all 0.2s',
                        '&:hover': t.configured ? { borderColor: info.color, transform: 'translateY(-1px)' } : {},
                      }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: alpha(info.color, 0.15),
                      }}>
                        <RocketLaunchIcon sx={{ fontSize: 18, color: info.color }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                          {info.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: t.configured ? BRAND.success : BRAND.textMuted }}>
                          {t.configured ? (t.details || 'Ready') : (t.details || 'Not configured')}
                        </Typography>
                      </Box>
                      {t.configured && (
                        <Chip label={t.name === 'firebase' && firebaseConfig ? 'Deploy' : t.name === 'firebase' ? 'Configure' : 'Deploy'} size="small" sx={{
                          fontWeight: 600, fontSize: '0.7rem',
                          background: alpha(info.color, 0.15), color: info.color,
                        }} />
                      )}
                    </Paper>
                  );
                })}
              </Box>
              {showFirebaseInput && !firebaseConfig && (
                <Box sx={{ mt: 2, p: 2, borderRadius: 2, background: alpha('#FFCA28', 0.05), border: `1px solid ${alpha('#FFCA28', 0.2)}` }}>
                  <Typography variant="subtitle2" sx={{ color: '#FFCA28', fontWeight: 700, mb: 0.5 }}>
                    Firebase Web Config
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1.5 }}>
                    Paste your Firebase web config from the Firebase Console (Project Settings &rarr; Your apps &rarr; Web app &rarr; Config).
                    This enables form submissions to be stored in Firestore.
                  </Typography>
                  <TextField
                    multiline rows={5} fullWidth size="small"
                    placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "appId": "..."\n}'}
                    value={firebaseConfigText}
                    onChange={e => {
                      setFirebaseConfigText(e.target.value);
                      setConfigError(null);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        if (parsed.apiKey && parsed.projectId) {
                          setFirebaseConfig(parsed);
                          setConfigError(null);
                        } else {
                          setConfigError('Missing apiKey or projectId');
                          setFirebaseConfig(null);
                        }
                      } catch {
                        setFirebaseConfig(null);
                      }
                    }}
                    sx={{
                      '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.75rem', color: BRAND.textPrimary, background: BRAND.bgSurface },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
                    }}
                  />
                  {configError && (
                    <Typography variant="caption" sx={{ color: BRAND.error, mt: 0.5, display: 'block' }}>{configError}</Typography>
                  )}
                  <Button size="small" variant="contained" disabled={!firebaseConfig}
                    onClick={() => {
                      const target = targets.find(t => t.name === 'firebase');
                      if (target) handleDeploy(target);
                    }}
                    sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, background: '#FFCA28', color: '#000',
                      '&:hover': { background: '#FFD54F' }, '&.Mui-disabled': { background: alpha('#FFCA28', 0.3), color: alpha('#000', 0.3) }
                    }}>
                    Deploy to Firebase
                  </Button>
                </Box>
              )}
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
