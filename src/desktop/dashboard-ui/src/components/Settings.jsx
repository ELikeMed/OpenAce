import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, alpha, Switch, Chip, Avatar, Slider,
  Button, Divider, TextField, FormControlLabel, IconButton, Snackbar,
  Select, MenuItem, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Stepper, Step, StepLabel, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';
import LanguageIcon from '@mui/icons-material/Language';
import TerminalIcon from '@mui/icons-material/Terminal';
import BuildIcon from '@mui/icons-material/Build';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RouteIcon from '@mui/icons-material/Route';
import CodeIcon from '@mui/icons-material/Code';
import ScreenSearchDesktopIcon from '@mui/icons-material/ScreenSearchDesktop';
import ScienceIcon from '@mui/icons-material/Science';
import TokenIcon from '@mui/icons-material/Token';
import PaymentIcon from '@mui/icons-material/Payment';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { BRAND } from '../theme';
import Console from './Console';

// ═══════════════════════════════════════════════
// PROVIDER INFO — Models, colors, descriptions
// ═══════════════════════════════════════════════

const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    icon: '\u2726',
    color: '#4285F4',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    visionModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    desc: 'Free tier available. Best tool calling.',
    needsKey: true,
    needsUrl: false,
  },
  openai: {
    name: 'OpenAI',
    icon: '\u25CE',
    color: '#10A37F',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    visionModels: ['gpt-4.1', 'gpt-4o'],
    desc: 'GPT-4 and beyond. Requires API key.',
    needsKey: true,
    needsUrl: false,
  },
  claude: {
    name: 'Anthropic Claude',
    icon: '\u25C8',
    color: '#D97706',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    visionModels: ['claude-opus-4-6', 'claude-sonnet-4-6'],
    desc: 'Thoughtful and capable. Requires API key.',
    needsKey: true,
    needsUrl: false,
  },
  kimi: {
    name: 'Kimi K3 (Moonshot)',
    icon: '\u263D',
    color: '#8B5CF6',
    models: ['kimi-k3', 'moonshot-v1-auto', 'moonshot-v1-128k'],
    visionModels: ['kimi-k3'],
    desc: 'Frontier model. Cheapest API ($3/$15 per M tokens).',
    needsKey: true,
    needsUrl: false,
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: '\u2B21',
    color: '#FFFFFF',
    models: ['qwen2.5:32b', 'llama3.1:70b', 'llama3.1:8b', 'mistral:7b', 'hermes3:8b', 'deepseek-r1:8b'],
    visionModels: ['llava', 'llava:13b', 'bakllava'],
    desc: 'Run locally. Free, no API key. Use qwen2.5 or llama3.1 for tool calling.',
    needsKey: false,
    needsUrl: true,
  },
};

const SETUP_INFO = {
  gemini: {
    signupUrl: 'https://aistudio.google.com/apikey',
    pricing: 'Free tier: 15 requests/min, 1M tokens/min',
    bestFor: 'Research, tool calling, vision, general tasks',
    steps: [
      'Go to Google AI Studio',
      'Click "Create API Key"',
      'Copy the key and paste it below',
    ],
  },
  openai: {
    signupUrl: 'https://platform.openai.com/api-keys',
    pricing: 'Pay-as-you-go, ~$2-10/mo typical usage',
    bestFor: 'General purpose, good at everything',
    steps: [
      'Sign up or log in to OpenAI Platform',
      'Go to API Keys section',
      'Click "Create new secret key"',
      'Copy the key and paste it below',
    ],
  },
  claude: {
    signupUrl: 'https://console.anthropic.com/settings/keys',
    pricing: 'Pay-as-you-go, ~$5-15/mo typical usage',
    bestFor: 'Code generation, analysis, careful reasoning',
    steps: [
      'Sign up or log in to Anthropic Console',
      'Go to API Keys',
      'Click "Create Key"',
      'Copy the key and paste it below',
    ],
  },
  kimi: {
    signupUrl: 'https://platform.moonshot.cn/console/api-keys',
    pricing: '$3 input / $15 output per million tokens — cheapest frontier API',
    bestFor: 'Agentic tasks, coding, research — frontier quality at 3x lower cost',
    steps: [
      'Go to platform.moonshot.cn',
      'Create an account and verify',
      'Go to API Keys section',
      'Create a key and paste it below',
    ],
  },
  ollama: {
    signupUrl: 'https://ollama.com/download',
    pricing: 'Free forever \u2014 runs on your computer',
    bestFor: 'Privacy, offline use, no API costs. Use qwen2.5 or llama3.1 for best tool calling.',
    steps: [
      'Download Ollama from ollama.com',
      'Install and run it',
      'Pull a model: ollama pull qwen2.5:32b',
      'Ollama runs at localhost:11434 by default',
    ],
  },
};

const TASK_CATEGORIES = [
  { key: 'code', label: 'Code Generation', icon: <CodeIcon sx={{ fontSize: 18 }} />, desc: 'Building apps, writing code, project files', recommended: 'claude' },
  { key: 'vision', label: 'Vision & Screen', icon: <ScreenSearchDesktopIcon sx={{ fontSize: 18 }} />, desc: 'Screenshots, click detection, UI reading', recommended: 'gemini' },
  { key: 'research', label: 'Research & Analysis', icon: <ScienceIcon sx={{ fontSize: 18 }} />, desc: 'Web search, content analysis, SOP creation', recommended: 'gemini' },
];

// ═══════════════════════════════════════════════
// PROVIDER SETUP WIZARD
// ═══════════════════════════════════════════════

function ProviderSetupWizard({ open, onClose, providerKey, onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const info = PROVIDER_INFO[providerKey] || {};
  const setup = SETUP_INFO[providerKey] || {};
  const steps = ['Introduction', 'Get API Key', 'Choose Model & Test'];

  const resetState = () => {
    setActiveStep(0);
    setApiKey('');
    setBaseUrl('http://localhost:11434/v1');
    setModel(info.models?.[0] || '');
    setTesting(false);
    setTestResult(null);
    setSaving(false);
  };

  useEffect(() => {
    if (open) {
      resetState();
      setModel(info.models?.[0] || '');
    }
  }, [open, providerKey]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save config first so the backend can initialize the provider
      await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          api_key: apiKey || undefined,
          base_url: providerKey === 'ollama' ? baseUrl : undefined,
          model: model,
          enabled: true,
        }),
      });
      // Quick test — send a simple message
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Say "connected" in one word.', provider: providerKey }),
      });
      if (r.ok) {
        setTestResult({ success: true, message: 'Connected successfully!' });
      } else {
        setTestResult({ success: false, message: 'Connection failed. Check your API key.' });
      }
    } catch (e) {
      setTestResult({ success: false, message: e.message || 'Connection failed.' });
    }
    setTesting(false);
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    try {
      await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          api_key: apiKey || undefined,
          base_url: providerKey === 'ollama' ? baseUrl : undefined,
          model: model,
          enabled: true,
        }),
      });
      if (onComplete) onComplete(providerKey);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${alpha(info.color || BRAND.primary, 0.3)}` } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, background: alpha(info.color || '#fff', 0.15), color: info.color, fontSize: '1.2rem', fontWeight: 700 }}>
            {info.icon}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Set Up {info.name}
            </Typography>
            <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
              {setup.bestFor}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ my: 2 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.8rem', color: BRAND.textSecondary } }}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Introduction */}
        {activeStep === 0 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Avatar sx={{
              width: 64, height: 64, mx: 'auto', mb: 2,
              background: alpha(info.color || '#fff', 0.15), color: info.color,
              fontSize: '2rem', fontWeight: 700,
            }}>
              {info.icon}
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{info.name}</Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 2 }}>{info.desc}</Typography>
            <Box sx={{ p: 2, borderRadius: 2, background: alpha(info.color || '#fff', 0.06), border: `1px solid ${alpha(info.color || '#fff', 0.15)}` }}>
              <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5 }}>
                <strong>Pricing:</strong> {setup.pricing}
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                <strong>Best for:</strong> {setup.bestFor}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Step 1: Get API Key */}
        {activeStep === 1 && (
          <Box sx={{ py: 1 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open(setup.signupUrl, '_blank')}
              sx={{
                mb: 2.5, py: 1.5, background: info.color,
                '&:hover': { background: alpha(info.color || '#fff', 0.8) },
                fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              Open {info.name} Console
            </Button>

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: BRAND.textPrimary }}>
              Steps:
            </Typography>
            {(setup.steps || []).map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Avatar sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: alpha(info.color || '#fff', 0.15), color: info.color }}>
                  {idx + 1}
                </Avatar>
                <Typography variant="body2" sx={{ color: BRAND.textSecondary, pt: 0.2 }}>{step}</Typography>
              </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            {info.needsKey ? (
              <TextField
                label="API Key"
                fullWidth
                size="small"
                type="password"
                placeholder="Paste your API key here..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem' } }}
              />
            ) : (
              <TextField
                label="Base URL"
                fullWidth
                size="small"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                helperText="Default: http://localhost:11434/v1"
                sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem' } }}
              />
            )}
          </Box>
        )}

        {/* Step 2: Choose Model & Test */}
        {activeStep === 2 && (
          <Box sx={{ py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: BRAND.textPrimary }}>
              Choose Model
            </Typography>
            <Select
              fullWidth
              size="small"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              sx={{ mb: 2, fontSize: '0.85rem' }}
            >
              {(info.models || []).map(m => (
                <MenuItem key={m} value={m} sx={{ fontSize: '0.85rem' }}>{m}</MenuItem>
              ))}
            </Select>

            <Button
              variant="outlined"
              fullWidth
              onClick={handleTest}
              disabled={testing}
              sx={{
                mb: 2, py: 1,
                borderColor: alpha(info.color || '#fff', 0.4),
                color: info.color,
                '&:hover': { borderColor: info.color, background: alpha(info.color || '#fff', 0.06) },
              }}
            >
              {testing ? <CircularProgress size={20} sx={{ color: info.color, mr: 1 }} /> : null}
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>

            {testResult && (
              <Box sx={{
                p: 1.5, borderRadius: 2, mb: 1,
                background: testResult.success ? alpha(BRAND.success, 0.1) : alpha(BRAND.error, 0.1),
                border: `1px solid ${testResult.success ? alpha(BRAND.success, 0.3) : alpha(BRAND.error, 0.3)}`,
              }}>
                <Typography variant="body2" sx={{ color: testResult.success ? BRAND.success : BRAND.error, fontWeight: 600 }}>
                  {testResult.success ? '\u2705 ' : '\u274C '}{testResult.message}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {activeStep > 0 && (
          <Button onClick={() => setActiveStep(s => s - 1)} sx={{ color: BRAND.textMuted }}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {activeStep < 2 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(s => s + 1)}
            disabled={activeStep === 1 && info.needsKey && !apiKey}
            sx={{ background: info.color, '&:hover': { background: alpha(info.color || '#fff', 0.8) } }}
          >
            {activeStep === 0 ? 'Get Started' : 'Next'}
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            variant="contained"
            onClick={handleSaveAndActivate}
            disabled={saving}
            sx={{ background: info.color, '&:hover': { background: alpha(info.color || '#fff', 0.8) } }}
          >
            {saving ? 'Saving...' : 'Save & Enable'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════
// SETTINGS CARD — Reusable container
// ═══════════════════════════════════════════════

function SettingsCard({ title, icon, children }) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: alpha(BRAND.primary, 0.12),
          color: BRAND.primaryLight,
        }}>
          {icon}
        </Avatar>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

// ═══════════════════════════════════════════════
// MAIN SETTINGS COMPONENT
// ═══════════════════════════════════════════════

function Settings() {
  const [permissions, setPermissions] = useState(null);
  const [toolGroups, setToolGroups] = useState(null);
  const [disabledTools, setDisabledTools] = useState(new Set());
  const [toolsSaving, setToolsSaving] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [toolSnack, setToolSnack] = useState('');

  // Provider state
  const [providers, setProviders] = useState(null);
  const [expandedProvider, setExpandedProvider] = useState(null);
  const [providerEdits, setProviderEdits] = useState({});
  const [providerSaving, setProviderSaving] = useState(null);
  const [showKeys, setShowKeys] = useState({});

  // Setup wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState(null);

  // Task routing state
  const [taskRouting, setTaskRouting] = useState({});
  const [routingSaving, setRoutingSaving] = useState(false);

  // Billing state
  const [billingCredits, setBillingCredits] = useState(null);
  const [billingUsage, setBillingUsage] = useState(null);
  const [autoReload, setAutoReload] = useState({ enabled: false, amount: '', threshold: '' });

  // Update system state
  const [versionInfo, setVersionInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const refreshProviders = async () => {
    try {
      const r = await fetch('/api/providers').then(r => r.json());
      if (r.success) setProviders(r.data);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [permRes] = await Promise.allSettled([
          fetch('/api/permissions').then(r => r.json()),
        ]);

        if (permRes.status === 'fulfilled' && permRes.value.success) setPermissions(permRes.value.data);

        fetch('/api/tools').then(r => r.json()).then(d => {
          if (d.success) {
            setToolGroups(d.data.groups);
            setDisabledTools(new Set(d.data.disabledTools || []));
          }
        }).catch(() => {});

        refreshProviders();

        fetch('/api/task-routing').then(r => r.json()).then(d => {
          if (d.success) setTaskRouting(d.data || {});
        }).catch(() => {});

        // Billing
        fetch('/api/billing/credits').then(r => r.json()).then(d => {
          if (d.success && d.data) {
            setBillingCredits(d.data);
            if (d.data.autoReload) setAutoReload(d.data.autoReload);
          }
        }).catch(() => {});
        fetch('/api/billing/usage').then(r => r.json()).then(d => {
          if (d.success) setBillingUsage(d.data);
        }).catch(() => {});

        // Version info
        fetch('/api/system/version').then(r => r.json()).then(d => {
          if (d.success && d.data) setVersionInfo(d.data);
        }).catch(() => {});
      } catch (e) { console.error(e); }
    };
    fetchAll();
  }, []);

  // Map string autonomy levels from API to slider numbers
  const autonomyToNum = { low: 1, medium: 2, high: 3, full: 4 };
  const autonomyNum = autonomyToNum[permissions?.global?.autonomy_level] || 3;

  const handleAutonomyChange = async (_, value) => {
    try {
      await fetch('/api/permissions/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: value }),
      });
      const numToAutonomy = { 1: 'low', 2: 'medium', 3: 'high', 4: 'full', 5: 'full' };
      setPermissions(prev => prev ? {
        ...prev,
        global: { ...prev.global, autonomy_level: numToAutonomy[value] || 'medium' }
      } : prev);
    } catch (e) { console.error(e); }
  };

  const handleToggleTool = (toolName) => {
    setDisabledTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  };

  const handleToggleGroup = (groupKey) => {
    if (!toolGroups?.[groupKey]) return;
    const tools = toolGroups[groupKey].tools;
    const allDisabled = tools.every(t => disabledTools.has(t));
    setDisabledTools(prev => {
      const next = new Set(prev);
      tools.forEach(t => allDisabled ? next.delete(t) : next.add(t));
      return next;
    });
  };

  const handleSaveToolPrefs = async () => {
    setToolsSaving(true);
    try {
      await fetch('/api/tools/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledTools: [...disabledTools] }),
      });
      setToolSnack('Tool preferences saved');
    } catch (e) { console.error(e); }
    finally { setToolsSaving(false); }
  };

  // ── Provider handlers ──

  const handleSelectProvider = async (name) => {
    if (!providers?.[name]?.connected) return;
    try {
      await fetch('/api/switch-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: name }),
      });
      await refreshProviders();
      setToolSnack(`Switched to ${PROVIDER_INFO[name]?.name || name}`);
    } catch (e) { console.error(e); }
  };

  const handleSaveProvider = async (name) => {
    const edits = providerEdits[name];
    if (!edits) return;
    setProviderSaving(name);
    try {
      await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: name, ...edits }),
      });
      await refreshProviders();
      setProviderEdits(prev => { const next = { ...prev }; delete next[name]; return next; });
      setToolSnack(`${PROVIDER_INFO[name]?.name || name} configuration saved`);
    } catch (e) { console.error(e); }
    finally { setProviderSaving(null); }
  };

  const updateProviderEdit = (name, field, value) => {
    setProviderEdits(prev => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [field]: value },
    }));
  };

  // ── Task routing handlers ──

  const handleRoutingChange = (taskKey, provider) => {
    setTaskRouting(prev => ({ ...prev, [taskKey]: provider || null }));
  };

  const handleSaveRouting = async () => {
    setRoutingSaving(true);
    try {
      await fetch('/api/task-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskRouting),
      });
      setToolSnack('Task routing saved');
    } catch (e) { console.error(e); }
    finally { setRoutingSaving(false); }
  };

  // Get connected provider names for routing dropdowns
  const connectedProviders = providers
    ? Object.entries(providers).filter(([, v]) => v.connected).map(([k]) => k)
    : [];

  return (
    <Box sx={{ maxWidth: 1200 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.1)} 0%, ${alpha(BRAND.secondary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.primary, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.primary, 0.3)}`,
          }}>
            <SettingsIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Settings & Configuration
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Manage Ace's permissions, autonomy level, and system settings
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ═══ BILLING & CREDITS ═══ */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {/* Plan & Balance */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SettingsCard title="Plan & Billing" icon={<TokenIcon sx={{ fontSize: 20 }} />}>
            {billingCredits ? (
              <Box>
                {/* Plan selector — switch between Credits and BYO Key */}
                {billingCredits.plan !== 'trial' && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {['credits', 'byo_key'].map(p => (
                      <Button
                        key={p}
                        size="small"
                        variant={billingCredits.plan === p ? 'contained' : 'outlined'}
                        onClick={async () => {
                          if (billingCredits.plan === p) return;
                          try {
                            const res = await fetch('/api/billing/plan', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ plan: p }),
                            });
                            const data = await res.json();
                            if (data.success) setBillingCredits(data.data);
                          } catch {}
                        }}
                        sx={{ flex: 1 }}
                      >
                        {p === 'credits' ? 'Ace Credits' : 'BYO API Key'}
                      </Button>
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip
                    label={billingCredits.plan === 'trial' ? 'Free Trial' : billingCredits.plan === 'byo_key' ? 'BYO API Key' : 'Ace Credits'}
                    size="small"
                    sx={{
                      background: alpha(BRAND.primary, 0.15),
                      color: BRAND.primaryLight,
                      fontWeight: 600,
                    }}
                  />
                  {billingCredits.plan === 'trial' && billingCredits.trialDaysLeft > 0 && (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      {billingCredits.trialDaysLeft} days remaining
                    </Typography>
                  )}
                  {billingCredits.currentPeriodEnd && (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      Renews {new Date(billingCredits.currentPeriodEnd).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>

                {/* Credit balance — only for credits plan and trial */}
                {billingCredits.plan !== 'byo_key' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: BRAND.textPrimary }}>
                      {(billingCredits.total || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      {billingCredits.subscriptionCredits || 0} subscription + {billingCredits.purchasedCredits || 0} purchased
                    </Typography>
                  </Box>
                )}

                {/* BYO Key info */}
                {billingCredits.plan === 'byo_key' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                      Using your own AI API key. No credit limits — you pay your AI provider directly.
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mt: 0.5 }}>
                      Configure your API key in the AI Provider section below.
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {!billingCredits.stripeSubscriptionId && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/billing/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mode: 'subscription' }),
                          });
                          const data = await res.json();
                          if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                        } catch {}
                      }}
                    >
                      Subscribe — $15/mo
                    </Button>
                  )}
                  {billingCredits.stripeCustomerId && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/billing/portal').then(r => r.json());
                          if (res.success && res.data?.url) window.open(res.data.url, '_blank');
                        } catch {}
                      }}
                    >
                      Manage Subscription
                    </Button>
                  )}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: BRAND.textMuted }}>Loading billing info...</Typography>
            )}
          </SettingsCard>
        </Grid>

        {/* Usage Stats — shown for ALL plans */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SettingsCard title="Usage" icon={<PaymentIcon sx={{ fontSize: 20 }} />}>
            {billingUsage ? (
              <Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  {[
                    { label: 'Today', value: billingUsage.today },
                    { label: 'This Week', value: billingUsage.thisWeek },
                    { label: 'This Month', value: billingUsage.thisMonth },
                  ].map(s => (
                    <Box key={s.label} sx={{
                      flex: 1, textAlign: 'center', p: 1.5, borderRadius: 2,
                      background: alpha(BRAND.primary, 0.06),
                      border: `1px solid ${alpha(BRAND.primary, 0.12)}`,
                    }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{s.value}</Typography>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                        {billingCredits?.plan === 'byo_key' ? 'calls' : s.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {billingUsage.recentActions?.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, mb: 0.5, display: 'block' }}>
                      Recent Actions
                    </Typography>
                    <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                      {billingUsage.recentActions.slice(0, 15).map((a, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                          <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                            {a.tool.replace(/_/g, ' ')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: BRAND.textMuted }}>Loading usage...</Typography>
            )}
          </SettingsCard>
        </Grid>

        {/* Top Up — only for credits plan */}
        {billingCredits?.plan !== 'byo_key' && (
          <Grid size={{ xs: 12, md: 6 }}>
            <SettingsCard title="Top Up Credits" icon={<PaymentIcon sx={{ fontSize: 20 }} />}>
              <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
                $1 = 100 credits. Purchased credits never expire.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {[5, 10, 25].map(amt => (
                  <Button
                    key={amt}
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/billing/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mode: 'top_up', amount: amt }),
                        });
                        const data = await res.json();
                        if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                      } catch {}
                    }}
                    sx={{ flex: 1 }}
                  >
                    ${amt} ({(amt * 100).toLocaleString()})
                  </Button>
                ))}
              </Box>
            </SettingsCard>
          </Grid>
        )}

        {/* Auto-Reload — only for credits plan */}
        {billingCredits?.plan !== 'byo_key' && (
          <Grid size={{ xs: 12, md: 6 }}>
            <SettingsCard title="Auto-Reload" icon={<TokenIcon sx={{ fontSize: 20 }} />}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoReload.enabled || false}
                    onChange={(e) => setAutoReload(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                }
                label={<Typography variant="body2">Auto-reload when low</Typography>}
                sx={{ mb: 1.5 }}
              />
              {autoReload.enabled && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
                  <TextField
                    label="Reload $"
                    size="small"
                    type="number"
                    value={autoReload.amount || ''}
                    onChange={(e) => setAutoReload(prev => ({ ...prev, amount: e.target.value }))}
                    sx={{ flex: 1 }}
                    InputProps={{ inputProps: { min: 5 } }}
                  />
                  <TextField
                    label="When below"
                    size="small"
                    type="number"
                    value={autoReload.threshold || ''}
                    onChange={(e) => setAutoReload(prev => ({ ...prev, threshold: e.target.value }))}
                    sx={{ flex: 1 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">credits</InputAdornment>,
                      inputProps: { min: 0 },
                    }}
                  />
                </Box>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  try {
                    await fetch('/api/billing/auto-reload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        enabled: autoReload.enabled,
                        amount: Number(autoReload.amount) || 0,
                        threshold: Number(autoReload.threshold) || 0,
                      }),
                    });
                  } catch {}
                }}
              >
                Save
              </Button>
            </SettingsCard>
          </Grid>
        )}
      </Grid>

      {/* ═══ EXISTING SETTINGS ═══ */}
      <Grid container spacing={2.5}>
        {/* Autonomy Level */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SettingsCard title="Autonomy Level" icon={<SecurityIcon sx={{ fontSize: 20 }} />}>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Control how independently Ace can act
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={autonomyNum}
                onChange={handleAutonomyChange}
                min={1}
                max={4}
                step={1}
                marks={[
                  { value: 1, label: 'Ask First' },
                  { value: 2, label: 'Suggest' },
                  { value: 3, label: 'Balanced' },
                  { value: 4, label: 'Proactive' },
                ]}
                sx={{
                  color: BRAND.primary,
                  '& .MuiSlider-markLabel': { fontSize: '0.7rem', color: BRAND.textMuted },
                  '& .MuiSlider-thumb': { boxShadow: `0 0 10px ${alpha(BRAND.primary, 0.4)}` },
                }}
              />
            </Box>
            <Box sx={{
              mt: 2, p: 1.5, borderRadius: 2,
              background: alpha(BRAND.primary, 0.06),
              border: `1px solid ${alpha(BRAND.primary, 0.12)}`,
            }}>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                {autonomyNum <= 1
                  ? 'Ace will ask before performing most actions.'
                  : autonomyNum === 2
                  ? 'Ace will suggest actions and wait for your approval.'
                  : autonomyNum === 3
                  ? 'Ace will act autonomously on routine tasks but ask for important decisions.'
                  : 'Ace will proactively take actions within allowed domains.'}
              </Typography>
            </Box>
          </SettingsCard>
        </Grid>

        {/* AI Provider */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SettingsCard title="AI Provider" icon={<SmartToyIcon sx={{ fontSize: 20 }} />}>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Choose which AI powers Ace. Click a provider to make it active.
            </Typography>
            {providers ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(PROVIDER_INFO).map(([key, info]) => {
                  const status = providers[key] || {};
                  const isActive = status.active;
                  const isConnected = status.connected;
                  const isExpanded = expandedProvider === key;
                  const edits = providerEdits[key] || {};
                  const currentModel = edits.model ?? status.model ?? '';
                  const currentVisionModel = edits.vision_model ?? status.visionModel ?? '';
                  const hasEdits = Object.keys(edits).length > 0;

                  return (
                    <Box key={key}>
                      {/* Provider row */}
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, borderRadius: 2,
                        background: isActive ? alpha(info.color, 0.08) : alpha(BRAND.bgElevated, 0.5),
                        border: `1px solid ${isActive ? alpha(info.color, 0.4) : alpha(BRAND.border, 0.5)}`,
                        cursor: isConnected ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        '&:hover': isConnected ? {
                          background: alpha(info.color, 0.1),
                          border: `1px solid ${alpha(info.color, 0.3)}`,
                        } : {},
                      }} onClick={() => {
                        if (!isActive && isConnected) handleSelectProvider(key);
                      }}>
                        <Avatar sx={{
                          width: 32, height: 32,
                          background: alpha(info.color, 0.15),
                          color: info.color,
                          fontSize: '1rem', fontWeight: 700,
                        }}>
                          {info.icon}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary, fontSize: '0.85rem' }}>
                            {info.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.7rem' }}>
                            {status.model || info.desc}
                          </Typography>
                        </Box>

                        {isActive && (
                          <Chip label="Active" size="small" sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 700,
                            bgcolor: alpha(BRAND.success, 0.15), color: BRAND.success,
                            border: `1px solid ${alpha(BRAND.success, 0.3)}`,
                          }} />
                        )}
                        {!isActive && isConnected && (
                          <Chip label="Ready" size="small" sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: alpha(BRAND.info, 0.1), color: BRAND.info,
                          }} />
                        )}
                        {!isConnected && (
                          <Button
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setWizardProvider(key); setWizardOpen(true); }}
                            sx={{
                              fontSize: '0.7rem', fontWeight: 600, minWidth: 60,
                              color: info.color, borderColor: alpha(info.color, 0.4),
                              '&:hover': { borderColor: info.color, background: alpha(info.color, 0.08) },
                            }}
                            variant="outlined"
                          >
                            Set Up
                          </Button>
                        )}

                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setExpandedProvider(isExpanded ? null : key); }}
                          sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.primaryLight } }}
                        >
                          {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Box>

                      {/* Expanded config */}
                      {isExpanded && (
                        <Box sx={{
                          mt: 0.5, p: 2, borderRadius: 2,
                          background: alpha(BRAND.bgElevated, 0.3),
                          border: `1px solid ${alpha(BRAND.border, 0.3)}`,
                        }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {info.needsKey && (
                              <TextField
                                label="API Key"
                                size="small"
                                fullWidth
                                type={showKeys[key] ? 'text' : 'password'}
                                placeholder={status.hasKey ? status.maskedKey : 'Enter API key...'}
                                value={edits.api_key ?? ''}
                                onChange={(e) => updateProviderEdit(key, 'api_key', e.target.value)}
                                slotProps={{
                                  input: {
                                    endAdornment: (
                                      <InputAdornment position="end">
                                        <IconButton
                                          size="small"
                                          onClick={() => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                                          sx={{ color: BRAND.textMuted }}
                                        >
                                          {showKeys[key] ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                                        </IconButton>
                                      </InputAdornment>
                                    ),
                                  },
                                }}
                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                              />
                            )}

                            {info.needsUrl && (
                              <TextField
                                label="Base URL"
                                size="small"
                                fullWidth
                                placeholder={status.baseUrl || 'http://localhost:11434/v1'}
                                value={edits.base_url ?? ''}
                                onChange={(e) => updateProviderEdit(key, 'base_url', e.target.value)}
                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                              />
                            )}

                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" sx={{ color: BRAND.textMuted, mb: 0.5, display: 'block' }}>Model</Typography>
                                <Select size="small" fullWidth value={currentModel}
                                  onChange={(e) => updateProviderEdit(key, 'model', e.target.value)}
                                  sx={{ fontSize: '0.8rem' }}
                                >
                                  {info.models.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>)}
                                </Select>
                              </Box>
                              {info.visionModels.length > 0 && (
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ color: BRAND.textMuted, mb: 0.5, display: 'block' }}>Vision Model</Typography>
                                  <Select size="small" fullWidth value={currentVisionModel} displayEmpty
                                    onChange={(e) => updateProviderEdit(key, 'vision_model', e.target.value)}
                                    sx={{ fontSize: '0.8rem' }}
                                  >
                                    <MenuItem value="" sx={{ fontSize: '0.8rem', color: BRAND.textMuted }}>Same as model</MenuItem>
                                    {info.visionModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>)}
                                  </Select>
                                </Box>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={edits.enabled ?? status.enabled ?? false}
                                    onChange={(e) => updateProviderEdit(key, 'enabled', e.target.checked)}
                                    size="small"
                                    sx={{
                                      '& .MuiSwitch-switchBase.Mui-checked': { color: info.color },
                                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: info.color },
                                    }}
                                  />
                                }
                                label={<Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Enabled</Typography>}
                              />
                              <Button
                                variant="contained"
                                size="small"
                                disabled={!hasEdits || providerSaving === key}
                                onClick={() => handleSaveProvider(key)}
                                sx={{
                                  background: info.color,
                                  '&:hover': { background: alpha(info.color, 0.8) },
                                  '&.Mui-disabled': { background: alpha(info.color, 0.2) },
                                  fontSize: '0.75rem', minWidth: 80,
                                }}
                              >
                                {providerSaving === key ? 'Saving...' : 'Save'}
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: BRAND.textMuted }}>Loading providers...</Typography>
            )}
          </SettingsCard>
        </Grid>

        {/* Task Routing */}
        <Grid size={{ xs: 12 }}>
          <SettingsCard title="Task Routing" icon={<RouteIcon sx={{ fontSize: 20 }} />}>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Assign the best AI to each task type. Different models excel at different things.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {TASK_CATEGORIES.map(cat => {
                const currentValue = taskRouting[cat.key] || '';
                const recommendedInfo = PROVIDER_INFO[cat.recommended];
                return (
                  <Box key={cat.key} sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    p: 1.5, borderRadius: 2,
                    background: alpha(BRAND.bgElevated, 0.5),
                    border: `1px solid ${alpha(BRAND.border, 0.5)}`,
                  }}>
                    <Avatar sx={{
                      width: 32, height: 32,
                      background: alpha(BRAND.primary, 0.12),
                      color: BRAND.primaryLight,
                    }}>
                      {cat.icon}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary, fontSize: '0.85rem' }}>
                        {cat.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.7rem' }}>
                        {cat.desc}
                      </Typography>
                    </Box>
                    <Select
                      size="small"
                      value={currentValue}
                      displayEmpty
                      onChange={(e) => handleRoutingChange(cat.key, e.target.value)}
                      sx={{ minWidth: 160, fontSize: '0.8rem' }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.8rem' }}>
                        <em>Default (active provider)</em>
                      </MenuItem>
                      {connectedProviders.map(p => (
                        <MenuItem key={p} value={p} sx={{ fontSize: '0.8rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span style={{ color: PROVIDER_INFO[p]?.color }}>{PROVIDER_INFO[p]?.icon}</span>
                            {PROVIDER_INFO[p]?.name || p}
                            {p === cat.recommended && (
                              <Chip label="Best" size="small" sx={{
                                height: 16, fontSize: '0.55rem', ml: 0.5,
                                bgcolor: alpha(BRAND.success, 0.15), color: BRAND.success,
                              }} />
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                );
              })}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={routingSaving}
                  onClick={handleSaveRouting}
                  sx={{ background: BRAND.primary, '&:hover': { background: BRAND.primaryDark } }}
                >
                  {routingSaving ? 'Saving...' : 'Save Routing'}
                </Button>
              </Box>
            </Box>
          </SettingsCard>
        </Grid>

        {/* Ace's Tools */}
        <Grid size={{ xs: 12 }}>
          <SettingsCard title="Ace's Tools" icon={<BuildIcon sx={{ fontSize: 20 }} />}>
            <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
              Enable or disable tool groups that Ace can use. Disabled tools won't be available in chat.
            </Typography>
            {toolGroups ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {Object.entries(toolGroups).map(([key, group]) => {
                  const enabledCount = group.tools.filter(t => !disabledTools.has(t)).length;
                  const allEnabled = enabledCount === group.tools.length;
                  const isExpanded = expandedGroup === key;
                  return (
                    <Box key={key}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, borderRadius: 2,
                        background: alpha(BRAND.bgElevated, 0.5),
                        border: `1px solid ${alpha(BRAND.border, 0.5)}`,
                        cursor: 'pointer',
                        '&:hover': { background: alpha(BRAND.primary, 0.04) },
                      }} onClick={() => setExpandedGroup(isExpanded ? null : key)}>
                        <Switch
                          checked={allEnabled}
                          disabled={group.alwaysOn}
                          onChange={(e) => { e.stopPropagation(); handleToggleGroup(key); }}
                          size="small"
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.primary }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: BRAND.primary } }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary, fontSize: '0.85rem' }}>
                            {group.name}
                            {group.alwaysOn && <Chip label="Always On" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem', bgcolor: alpha(BRAND.success, 0.1), color: BRAND.success }} />}
                          </Typography>
                          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>{group.description}</Typography>
                        </Box>
                        <Chip label={`${enabledCount}/${group.tools.length}`} size="small" sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 600,
                          bgcolor: allEnabled ? alpha(BRAND.success, 0.1) : alpha(BRAND.warning, 0.1),
                          color: allEnabled ? BRAND.success : BRAND.warning,
                        }} />
                        {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: BRAND.textMuted }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />}
                      </Box>
                      {isExpanded && (
                        <Box sx={{ pl: 6, py: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {group.tools.map(tool => (
                            <Box key={tool} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Switch
                                checked={!disabledTools.has(tool)}
                                disabled={group.alwaysOn}
                                onChange={() => handleToggleTool(tool)}
                                size="small"
                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.primaryLight }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: BRAND.primaryLight } }}
                              />
                              <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem', fontFamily: '"SF Mono", monospace' }}>
                                {tool}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={toolsSaving}
                    onClick={handleSaveToolPrefs}
                    sx={{ background: BRAND.primary, '&:hover': { background: BRAND.primaryDark } }}
                  >
                    {toolsSaving ? 'Saving...' : 'Save Tool Preferences'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: BRAND.textMuted }}>Loading tools...</Typography>
            )}
          </SettingsCard>
        </Grid>

        {/* System Updates */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SettingsCard title="System Updates" icon={<SystemUpdateIcon sx={{ fontSize: 20 }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Current Version
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: BRAND.primaryLight }}>
                  v{versionInfo?.currentVersion || '1.0.0'}
                </Typography>
              </Box>
              <Chip
                label={versionInfo?.updateAvailable ? 'Update Available' : 'Up to Date'}
                size="small"
                sx={{
                  background: alpha(versionInfo?.updateAvailable ? BRAND.warning : BRAND.success, 0.12),
                  color: versionInfo?.updateAvailable ? BRAND.warning : BRAND.success,
                  fontWeight: 600,
                }}
              />
            </Box>

            {versionInfo?.updateAvailable && (
              <Box sx={{
                p: 1.5, mb: 2, borderRadius: 2,
                background: alpha(BRAND.primaryLight, 0.08),
                border: `1px solid ${alpha(BRAND.primaryLight, 0.15)}`,
              }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
                  v{versionInfo.latestVersion} available
                </Typography>
                {versionInfo.releaseNotes && (
                  <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, whiteSpace: 'pre-line', maxHeight: 80, overflow: 'auto' }}>
                    {versionInfo.releaseNotes.slice(0, 300)}{versionInfo.releaseNotes.length > 300 ? '...' : ''}
                  </Typography>
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                disabled={checkingUpdate}
                onClick={async () => {
                  setCheckingUpdate(true);
                  try {
                    const res = await fetch('/api/system/update-check').then(r => r.json());
                    if (res.success && res.data) {
                      setVersionInfo(prev => ({ ...prev, ...res.data }));
                    }
                  } catch {}
                  setCheckingUpdate(false);
                }}
                sx={{ textTransform: 'none', fontSize: '0.8rem' }}
              >
                {checkingUpdate ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                Check for Updates
              </Button>
              {versionInfo?.releaseUrl && versionInfo?.updateAvailable && (
                <Button
                  size="small"
                  onClick={() => window.open(versionInfo.releaseUrl, '_blank')}
                  sx={{ textTransform: 'none', fontSize: '0.8rem', color: BRAND.primaryLight }}
                >
                  Release Notes
                </Button>
              )}
            </Box>

            {versionInfo?.lastChecked && (
              <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mt: 1.5 }}>
                Last checked: {new Date(versionInfo.lastChecked).toLocaleString()}
              </Typography>
            )}
          </SettingsCard>
        </Grid>

        {/* System Administration */}
        <Grid size={{ xs: 12 }}>
          <SystemAdmin />
        </Grid>

        {/* Console */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Avatar sx={{
                width: 36, height: 36,
                background: alpha(BRAND.primary, 0.12),
                color: BRAND.primaryLight,
              }}>
                <TerminalIcon sx={{ fontSize: 20 }} />
              </Avatar>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                Console
              </Typography>
            </Box>
            <Console />
          </Paper>
        </Grid>
      </Grid>

      {/* Setup Wizard Dialog */}
      <ProviderSetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        providerKey={wizardProvider}
        onComplete={async () => {
          await refreshProviders();
          setToolSnack(`${PROVIDER_INFO[wizardProvider]?.name || wizardProvider} is now connected!`);
        }}
      />

      <Snackbar
        open={!!toolSnack}
        autoHideDuration={3000}
        onClose={() => setToolSnack('')}
        message={toolSnack}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════
// SYSTEM ADMIN — Install, Restart, Deploy Commands
// ═══════════════════════════════════════════════

function CommandBlock({ label, command, description }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ mb: 2 }}>
      {description && (
        <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5, fontSize: '0.8rem' }}>
          {description}
        </Typography>
      )}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        p: 1.5, borderRadius: 2,
        background: alpha(BRAND.bg, 0.8),
        border: `1px solid ${BRAND.border}`,
        fontFamily: 'monospace',
      }}>
        <Typography variant="body2" sx={{
          flex: 1, fontFamily: '"SF Mono", "Fira Code", monospace',
          fontSize: '0.8rem', color: BRAND.secondaryLight,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: BRAND.textMuted }}>$ </span>{command}
        </Typography>
        <IconButton size="small" onClick={handleCopy} sx={{
          color: copied ? BRAND.success : BRAND.textMuted,
          '&:hover': { color: BRAND.primary },
        }}>
          {copied ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

function SystemAdmin() {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: alpha(BRAND.accent, 0.12),
          color: BRAND.accent,
        }}>
          <TerminalIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            System Administration
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
            Commands for running, restarting, and maintaining OpenAce
          </Typography>
        </Box>
      </Box>

      <Box sx={{
        p: 2.5, mb: 3, borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(BRAND.success, 0.12)} 0%, ${alpha(BRAND.success, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.success, 0.3)}`,
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BRAND.success, mb: 0.5 }}>
          Start / Restart OpenAce
        </Typography>
        <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: 'block', mb: 1.5 }}>
          This is the only command you need for day-to-day use.
          To restart: press <strong>Ctrl+C</strong> in the terminal to stop, then run this again.
        </Typography>
        <CommandBlock command="npm start" />
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.primaryLight, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TerminalIcon sx={{ fontSize: 16 }} /> Other Run Modes
          </Typography>
          <CommandBlock description="Force restart (if port 3333 is stuck)" command="kill $(lsof -ti:3333); npm start" />
          <CommandBlock description="Start Telegram bot (separate process)" command="npm run telegram" />
          <CommandBlock description="Run with PM2 (keeps running after terminal closes)" command="pm2 start ecosystem.config.cjs" />
          <CommandBlock description="Restart with PM2" command="pm2 restart openace-dashboard" />
          <CommandBlock description="View PM2 logs" command="pm2 logs openace-dashboard" />
          <CommandBlock description="Stop PM2" command="pm2 stop all" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.warning, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BuildIcon sx={{ fontSize: 16 }} /> Setup & Integrations
          </Typography>
          <CommandBlock description="Install all dependencies (first time only)" command="npm install" />
          <CommandBlock description="Run first-time setup wizard" command="npm run setup" />
          <CommandBlock description="Re-connect Google (Gmail, Calendar, Drive)" command="npm run setup-google" />
          <CommandBlock description="Setup Zoom integration" command="npm run setup-zoom" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.accent, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BuildIcon sx={{ fontSize: 16 }} /> Dashboard Development
          </Typography>
          <CommandBlock description="Rebuild the dashboard UI after code changes" command="cd src/desktop/dashboard-ui && npm run build" />
          <CommandBlock description="Rebuild dashboard then restart server" command="cd src/desktop/dashboard-ui && npm run build && cd ../../.. && npm start" />
          <CommandBlock description="Dev mode with hot reload (dashboard only)" command="cd src/desktop/dashboard-ui && npm run dev" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.info, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StorageIcon sx={{ fontSize: 16 }} /> Maintenance
          </Typography>
          <CommandBlock description="Check server is running" command="curl http://localhost:3333/api/health" />
          <CommandBlock description="Update dependencies" command="npm install" />
          <CommandBlock description="View server logs" command="cat logs/openace.log" />
          <CommandBlock description="Clear activity data" command="rm data/activity/activity.json" />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.secondary, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LanguageIcon sx={{ fontSize: 16 }} /> URLs & Endpoints
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {[
              { label: 'Dashboard', url: 'http://localhost:3333' },
              { label: 'Health Check', url: 'http://localhost:3333/api/health' },
              { label: 'System Info', url: 'http://localhost:3333/api/system-info' },
              { label: 'Event Stream', url: 'http://localhost:3333/api/events/stream' },
              { label: 'Event Status', url: 'http://localhost:3333/api/events/status' },
              { label: 'Ace Studio', url: 'http://localhost:3333/studio' },
            ].map(item => (
              <Chip
                key={item.label}
                label={`${item.label}: ${item.url}`}
                size="small"
                onClick={() => window.open(item.url, '_blank')}
                sx={{
                  cursor: 'pointer',
                  background: alpha(BRAND.secondary, 0.08),
                  color: BRAND.secondaryLight,
                  border: `1px solid ${alpha(BRAND.secondary, 0.15)}`,
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  '&:hover': {
                    background: alpha(BRAND.secondary, 0.15),
                    border: `1px solid ${alpha(BRAND.secondary, 0.3)}`,
                  },
                }}
              />
            ))}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default Settings;
