import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Switch, alpha, Avatar, Chip,
  Card, CardContent, Grid, LinearProgress, Fade, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Radio, RadioGroup
} from '@mui/material';
import AceSpadeIcon from './AceSpadeIcon';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import WebIcon from '@mui/icons-material/Web';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import MouseIcon from '@mui/icons-material/Mouse';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import StorageIcon from '@mui/icons-material/Storage';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GavelIcon from '@mui/icons-material/Gavel';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { BRAND } from '../theme';

const API = 'http://localhost:3333';
const TOTAL_STEPS = 8;

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Real Estate',
  'E-Commerce', 'Marketing & Advertising', 'Consulting', 'Manufacturing',
  'Food & Beverage', 'Entertainment', 'Non-Profit', 'Other'
];

const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini (Recommended)',
    desc: 'Gemini 2.5 Flash — fast, capable, free tier available',
    icon: '✨',
    needsKey: true,
    keyPlaceholder: 'AIza...',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    color: '#4285f4',
    helpText: 'Get a free API key from Google AI Studio',
    helpLink: 'https://aistudio.google.com/apikey',
  },
  openai: {
    name: 'OpenAI',
    desc: 'GPT-4.1 — powerful reasoning and coding',
    icon: '🤖',
    needsKey: true,
    keyPlaceholder: 'sk-...',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    color: '#74B9FF',
    helpText: 'Get an API key from the OpenAI dashboard',
    helpLink: 'https://platform.openai.com/api-keys',
  },
  claude: {
    name: 'Anthropic (Claude)',
    desc: 'Claude Sonnet 4.6 — excellent for analysis and writing',
    icon: '🧠',
    needsKey: true,
    keyPlaceholder: 'sk-ant-...',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    color: '#D4A574',
    helpText: 'Get an API key from the Anthropic console',
    helpLink: 'https://console.anthropic.com/settings/keys',
  },
  ollama: {
    name: 'Ollama (Local & Free)',
    desc: 'Run AI models locally on your machine — free, private, no API key needed',
    icon: '🦙',
    needsKey: false,
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'gemma2'],
    color: '#10b981',
    helpText: 'Download and run Ollama on your machine — no API key needed',
    helpLink: 'https://ollama.com/download',
  },
};

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // System setup state
  const [setupStatus, setSetupStatus] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');

  // Form state
  const [ownerName, setOwnerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [mission, setMission] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [offerings, setOfferings] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [desktopControl, setDesktopControl] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Telegram state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState(null);

  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  // Fetch system status when entering step 1
  useEffect(() => {
    if (step === 2 && !setupStatus) {
      fetchSetupStatus();
    }
  }, [step]);

  const fetchSetupStatus = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch(`${API}/api/setup/status`);
      const data = await res.json();
      if (data.success) {
        setSetupStatus(data.data);
        // Pre-select active provider if already configured
        if (data.data.activeProvider && data.data.activeProvider !== 'none') {
          setSelectedProvider(data.data.activeProvider);
        }
        // Pre-select model
        if (data.data.providers?.[data.data.activeProvider]?.model) {
          setSelectedModel(data.data.providers[data.data.activeProvider].model);
        }
      }
    } catch (e) {
      console.error('Failed to fetch setup status:', e);
    }
    setSetupLoading(false);
  };

  const testProvider = async () => {
    setProviderTesting(true);
    setProviderTestResult(null);
    try {
      const res = await fetch(`${API}/api/setup/test-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, apiKey }),
      });
      const data = await res.json();
      setProviderTestResult(data.success ? 'success' : `failed: ${data.error || 'Connection failed'}`);
    } catch (e) {
      setProviderTestResult('failed: Network error');
    }
    setProviderTesting(false);
  };

  const saveAiProvider = async () => {
    try {
      await fetch(`${API}/api/setup/ai-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: AI_PROVIDERS[selectedProvider]?.needsKey ? apiKey : undefined,
          model: selectedModel || AI_PROVIDERS[selectedProvider]?.models[0],
        }),
      });
    } catch (e) {
      console.error('Failed to save AI provider:', e);
    }
  };

  const saveBusinessProfile = async () => {
    try {
      await fetch(`${API}/api/business-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName, name: companyName, industry, mission,
          targetAudience,
          offerings: offerings.split(',').map(s => s.trim()).filter(Boolean),
          location, website,
        }),
      });
    } catch (e) {
      console.error('Failed to save business profile:', e);
    }
  };

  const saveDesktopAutonomy = async () => {
    try {
      await fetch(`${API}/api/desktop-autonomy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: desktopControl, enabled: desktopControl }),
      });
    } catch (e) {
      console.error('Failed to save desktop autonomy:', e);
    }
  };

  const handleNext = async () => {
    if (step === 2) {
      // Save AI provider config
      setSaving(true);
      await saveAiProvider();
      setSaving(false);
    }
    if (step === 4) {
      // Business step complete
      setSaving(true);
      await saveBusinessProfile();
      setSaving(false);
    }
    if (step === 5 && telegramToken.trim()) {
      // Save Telegram config (optional — only if token provided)
      setSaving(true);
      try {
        await fetch(`${API}/api/setup/telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_token: telegramToken, enabled: true }),
        });
      } catch (e) {
        console.error('Failed to save Telegram config:', e);
      }
      setSaving(false);
    }
    if (step === 6) {
      // Desktop control decided
      setSaving(true);
      await saveDesktopAutonomy();
      await saveBusinessProfile();
      setSaving(false);
    }
    goNext();
  };

  const canProceed = () => {
    if (step === 1) return termsAccepted;
    if (step === 2) {
      // Need a provider selected; if it needs a key, must have one
      if (AI_PROVIDERS[selectedProvider]?.needsKey && apiKey.trim().length < 5) return false;
      return true;
    }
    if (step === 3) return ownerName.trim().length > 0 && companyName.trim().length > 0;
    if (step === 4) return industry.trim().length > 0;
    return true;
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: `linear-gradient(135deg, ${BRAND.bg} 0%, #0A0A1A 50%, #0D1025 100%)`,
    }}>
      {/* Progress Bar */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 4,
            background: alpha(BRAND.primary, 0.1),
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`,
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }}
        />
      </Box>

      {/* Step Indicator */}
      <Box sx={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        pt: 4, pb: 1, gap: 1,
      }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <Box key={i} sx={{
            width: i === step ? 32 : 10, height: 10, borderRadius: 5,
            background: i <= step
              ? `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`
              : alpha(BRAND.textMuted, 0.2),
            transition: 'all 0.4s ease',
          }} />
        ))}
        <Typography variant="caption" sx={{ ml: 2, color: BRAND.textMuted }}>
          Step {step + 1} of {TOTAL_STEPS}
        </Typography>
      </Box>

      {/* Content Area */}
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 3, py: 2,
      }}>
        <Box sx={{ maxWidth: 660, width: '100%' }}>

          {/* ═══════ Step 0: Welcome ═══════ */}
          {step === 0 && (
            <Fade in timeout={500}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar sx={{
                  width: 80, height: 80, mx: 'auto', mb: 3,
                  background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.secondary} 100%)`,
                  boxShadow: `0 8px 32px ${alpha(BRAND.primary, 0.4)}`,
                }}>
                  <AceSpadeIcon sx={{ fontSize: 44 }} />
                </Avatar>
                <Typography variant="h4" sx={{
                  fontWeight: 800, mb: 1.5,
                  background: `linear-gradient(135deg, ${BRAND.textPrimary} 0%, ${BRAND.primaryLight} 100%)`,
                  backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  👋 Welcome to OpenAce
                </Typography>
                <Typography variant="h6" sx={{ color: BRAND.textSecondary, fontWeight: 400, mb: 3 }}>
                  Your AI Executive Assistant
                </Typography>
                <Typography variant="body1" sx={{ color: BRAND.textSecondary, mb: 1, maxWidth: 480, mx: 'auto', lineHeight: 1.7 }}>
                  Ace manages your business like a team of AI executives — handling strategy, marketing,
                  research, code, scheduling, and web browsing autonomously.
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 4 }}>
                  Let's set up your assistant. This takes about 2 minutes.
                </Typography>
                <Button
                  variant="contained" size="large"
                  endIcon={<RocketLaunchIcon />}
                  onClick={goNext}
                  sx={{
                    px: 5, py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: '1rem',
                    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`,
                    boxShadow: `0 4px 20px ${alpha(BRAND.primary, 0.4)}`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${BRAND.primaryLight}, ${BRAND.primary})`,
                      boxShadow: `0 6px 28px ${alpha(BRAND.primary, 0.5)}`,
                    },
                  }}
                >
                  Get Started
                </Button>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 1: Terms & Consent ═══════ */}
          {step === 1 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <GavelIcon sx={{ color: BRAND.primaryLight }} />
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>Before We Begin</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 2.5, lineHeight: 1.6 }}>
                  OpenAce is an autonomous AI assistant that can take real actions on your computer and on the internet. Please read and accept the following before continuing.
                </Typography>

                {/* Scrollable terms box */}
                <Box sx={{
                  maxHeight: 280, overflowY: 'auto', mb: 2.5, p: 2.5,
                  borderRadius: '12px',
                  border: `1px solid ${alpha(BRAND.border, 0.5)}`,
                  background: alpha(BRAND.bgCard, 0.5),
                  fontSize: '0.78rem', color: BRAND.textSecondary, lineHeight: 1.7,
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-thumb': { background: BRAND.border, borderRadius: 3 },
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    What OpenAce Can Do
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.7 }}>
                    OpenAce can browse the web, send emails, manage your sales pipeline, control your desktop (click, type, scroll), interact with third-party websites and services, read and modify files, and take other autonomous actions on your behalf. These actions are performed by artificial intelligence and may produce unintended, inaccurate, or incorrect results.
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    Use at Your Own Risk
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.7 }}>
                    This software is provided "as is" and "as available" without warranties of any kind, whether express, implied, or statutory, including but not limited to warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. You are solely responsible for reviewing and verifying all actions taken by the AI. Do not rely on OpenAce outputs as a sole source of truth or as a substitute for professional advice.
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    Assumption of Risk
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.7 }}>
                    By using OpenAce, you acknowledge and accept all risks associated with autonomous AI software, including but not limited to: data loss or corruption, unintended emails or communications sent on your behalf, incorrect information presented as fact, unintended interactions with websites and services, desktop actions that may modify files or settings, and financial or business consequences of AI-initiated actions.
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    Limitation of Liability
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.7 }}>
                    In no event shall the developers, contributors, or maintainers of OpenAce be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from or related to your use of the software, including but not limited to data loss, unauthorized actions, financial loss, system damage, or unintended communications sent on your behalf, even if advised of the possibility of such damages. Our aggregate liability shall not exceed $100.
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    Indemnification
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.7 }}>
                    You agree to indemnify, defend, and hold harmless the developers and contributors of OpenAce from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising from your use of the software, any actions taken by the AI on your behalf, or your violation of these terms.
                  </Typography>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: BRAND.textPrimary, mb: 1 }}>
                    Experimental Software
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, lineHeight: 1.7 }}>
                    OpenAce is experimental software under active development. Features may change, break, or behave unexpectedly. You can configure approval settings and disable autonomous capabilities at any time in Settings. You remain responsible for all actions taken by the AI while using this software.
                  </Typography>
                </Box>

                {/* Accept checkbox */}
                <Box
                  onClick={() => setTermsAccepted(!termsAccepted)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 2,
                    borderRadius: '12px', cursor: 'pointer',
                    border: `1px solid ${alpha(termsAccepted ? BRAND.success : BRAND.border, 0.4)}`,
                    background: alpha(termsAccepted ? BRAND.success : BRAND.bgCard, 0.06),
                    transition: 'all 0.2s ease',
                    '&:hover': { background: alpha(BRAND.primary, 0.06) },
                  }}
                >
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '6px', flexShrink: 0,
                    border: `2px solid ${termsAccepted ? BRAND.success : BRAND.textMuted}`,
                    background: termsAccepted ? BRAND.success : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}>
                    {termsAccepted && <CheckCircleIcon sx={{ fontSize: 16, color: '#fff' }} />}
                  </Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: BRAND.textPrimary }}>
                    I understand that OpenAce is an autonomous AI that takes real actions, and I accept the risks and terms above.
                  </Typography>
                </Box>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 2: System Setup & AI Provider ═══════ */}
          {step === 2 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Avatar sx={{
                    width: 56, height: 56, mx: 'auto', mb: 2,
                    background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.primary})`,
                  }}>
                    <BuildIcon sx={{ fontSize: 30 }} />
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>System Setup</Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                    Let's make sure everything is ready and connect your AI brain
                  </Typography>
                </Box>

                {/* System checks */}
                {setupLoading ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: BRAND.primary }} />
                    <Typography variant="body2" sx={{ mt: 2, color: BRAND.textSecondary }}>Checking system...</Typography>
                  </Box>
                ) : setupStatus && (
                  <Box>
                    {/* Health checks */}
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <StatusChip ok={setupStatus.nodeOk} label={`Node.js ${setupStatus.nodeVersion}`} />
                      <StatusChip ok={setupStatus.depsInstalled} label="Dependencies" />
                      <StatusChip ok={setupStatus.serverRunning} label="Server Running" />
                      <StatusChip ok={setupStatus.ollamaReachable} label="Ollama (Local AI)" warn={!setupStatus.ollamaReachable} />
                    </Box>

                    {/* AI Provider Selection */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center' }}>
                      Choose Your AI Provider
                    </Typography>

                    <RadioGroup value={selectedProvider} onChange={e => {
                      setSelectedProvider(e.target.value);
                      setApiKey('');
                      setProviderTestResult(null);
                      setSelectedModel(AI_PROVIDERS[e.target.value]?.models[0] || '');
                    }}>
                      <Grid container spacing={1.5}>
                        {Object.entries(AI_PROVIDERS).map(([id, prov]) => {
                          const isSelected = selectedProvider === id;
                          const isOllamaUnavailable = id === 'ollama' && !setupStatus.ollamaReachable;
                          return (
                            <Grid item xs={12} sm={6} key={id}>
                              <Card
                                onClick={() => {
                                  setSelectedProvider(id);
                                  setApiKey('');
                                  setProviderTestResult(null);
                                  setSelectedModel(prov.models[0] || '');
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  border: `1px solid ${alpha(prov.color, isSelected ? 0.5 : 0.15)}`,
                                  background: isSelected
                                    ? `linear-gradient(135deg, ${alpha(prov.color, 0.12)} 0%, ${alpha(prov.color, 0.03)} 100%)`
                                    : alpha('#fff', 0.02),
                                  transition: 'all 0.25s ease',
                                  '&:hover': { borderColor: alpha(prov.color, 0.5) },
                                  opacity: isOllamaUnavailable ? 0.5 : 1,
                                }}
                              >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Radio value={id} size="small" sx={{
                                      color: alpha(prov.color, 0.5),
                                      '&.Mui-checked': { color: prov.color },
                                      p: 0.5,
                                    }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                        {prov.icon} {prov.name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: BRAND.textSecondary, fontSize: '0.7rem' }}>
                                        {prov.desc}
                                      </Typography>
                                    </Box>
                                  </Box>
                                  {isOllamaUnavailable && (
                                    <Typography variant="caption" sx={{ color: BRAND.warning, fontSize: '0.65rem', display: 'block', mt: 0.5, ml: 4 }}>
                                      ⚠️ Ollama not detected — install from ollama.com
                                    </Typography>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </RadioGroup>

                    {/* Ollama help link (no API key needed) */}
                    {selectedProvider === 'ollama' && (
                      <Typography variant="caption" sx={{ color: BRAND.textSecondary, mt: 1.5, display: 'block', textAlign: 'center' }}>
                        {AI_PROVIDERS.ollama.helpText}.{' '}
                        <Box component="a" href={AI_PROVIDERS.ollama.helpLink} target="_blank" rel="noopener noreferrer"
                          sx={{ color: BRAND.primaryLight, textDecoration: 'underline', cursor: 'pointer' }}>
                          Download Ollama &rarr;
                        </Box>
                      </Typography>
                    )}

                    {/* API Key Input (if needed) */}
                    {AI_PROVIDERS[selectedProvider]?.needsKey && (
                      <Fade in>
                        <Box sx={{ mt: 2.5 }}>
                          <TextField
                            label={`${AI_PROVIDERS[selectedProvider].name} API Key`}
                            value={apiKey}
                            onChange={e => { setApiKey(e.target.value); setProviderTestResult(null); }}
                            fullWidth
                            type={showApiKey ? 'text' : 'password'}
                            placeholder={AI_PROVIDERS[selectedProvider].keyPlaceholder}
                            InputProps={{
                              endAdornment: (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Button size="small" onClick={() => setShowApiKey(!showApiKey)} sx={{ minWidth: 0, p: 0.5 }}>
                                    {showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                  </Button>
                                </Box>
                              ),
                            }}
                            sx={inputSx}
                          />
                          <Typography variant="caption" sx={{ color: BRAND.textSecondary, mt: 0.8, display: 'block' }}>
                            {AI_PROVIDERS[selectedProvider]?.helpText}{' '}
                            <Box component="a" href={AI_PROVIDERS[selectedProvider]?.helpLink} target="_blank" rel="noopener noreferrer"
                              sx={{ color: BRAND.primaryLight, textDecoration: 'underline', cursor: 'pointer' }}>
                              Get your key here &rarr;
                            </Box>
                          </Typography>
                        </Box>
                      </Fade>
                    )}

                    {/* Model Selection */}
                    <Box sx={{ mt: 2 }}>
                      <FormControl fullWidth size="small" sx={inputSx}>
                        <InputLabel>Model</InputLabel>
                        <Select
                          value={selectedModel || AI_PROVIDERS[selectedProvider]?.models[0] || ''}
                          label="Model"
                          onChange={e => setSelectedModel(e.target.value)}
                        >
                          {(AI_PROVIDERS[selectedProvider]?.models || []).map(m => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Test Connection Button */}
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={testProvider}
                        disabled={providerTesting || (AI_PROVIDERS[selectedProvider]?.needsKey && apiKey.trim().length < 5)}
                        sx={{
                          borderColor: alpha(BRAND.secondary, 0.3),
                          color: BRAND.secondary,
                          '&:hover': { borderColor: BRAND.secondary, background: alpha(BRAND.secondary, 0.08) },
                        }}
                      >
                        {providerTesting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                        {providerTesting ? 'Testing...' : '🔌 Test Connection'}
                      </Button>
                      {providerTestResult === 'success' && (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                          label="Connected!"
                          size="small"
                          sx={{ background: alpha(BRAND.success, 0.15), color: BRAND.success, fontWeight: 600 }}
                        />
                      )}
                      {providerTestResult && providerTestResult !== 'success' && (
                        <Chip
                          icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />}
                          label={providerTestResult}
                          size="small"
                          sx={{ background: alpha(BRAND.error, 0.15), color: BRAND.error, fontWeight: 600, maxWidth: 260 }}
                        />
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 3: About You ═══════ */}
          {step === 3 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Avatar sx={{
                    width: 56, height: 56, mx: 'auto', mb: 2,
                    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                  }}>
                    <PersonIcon sx={{ fontSize: 30 }} />
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>About You</Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                    Ace needs to know who it's working for
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480, mx: 'auto' }}>
                  <TextField
                    label="What's your name?"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    fullWidth
                    placeholder="e.g. John Smith"
                    autoFocus
                    sx={inputSx}
                  />
                  <TextField
                    label="What's your company called?"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    fullWidth
                    placeholder="e.g. Acme Corp"
                    sx={inputSx}
                  />
                </Box>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 4: Your Business ═══════ */}
          {step === 4 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Avatar sx={{
                    width: 56, height: 56, mx: 'auto', mb: 2,
                    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                  }}>
                    <BusinessIcon sx={{ fontSize: 30 }} />
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Your Business</Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                    Help Ace understand what you do
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 480, mx: 'auto' }}>
                  <FormControl fullWidth sx={inputSx}>
                    <InputLabel>What industry are you in?</InputLabel>
                    <Select
                      value={INDUSTRIES.includes(industry) ? industry : (industry ? 'Other' : '')}
                      label="What industry are you in?"
                      onChange={e => setIndustry(e.target.value)}
                    >
                      {INDUSTRIES.map(ind => (
                        <MenuItem key={ind} value={ind}>{ind}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {industry === 'Other' && (
                    <TextField
                      label="Specify your industry"
                      value={INDUSTRIES.includes(industry) ? '' : industry}
                      onChange={e => setIndustry(e.target.value)}
                      fullWidth sx={inputSx}
                    />
                  )}
                  <TextField
                    label="What does your company do?"
                    value={mission}
                    onChange={e => setMission(e.target.value)}
                    fullWidth multiline rows={2}
                    placeholder="e.g. We help small businesses automate their marketing..."
                    sx={inputSx}
                  />
                  <TextField
                    label="Who is your target audience?"
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    fullWidth
                    placeholder="e.g. Small business owners, SaaS founders"
                    sx={inputSx}
                  />
                  <TextField
                    label="Key offerings (comma-separated)"
                    value={offerings}
                    onChange={e => setOfferings(e.target.value)}
                    fullWidth
                    placeholder="e.g. Web Design, SEO, Social Media Management"
                    sx={inputSx}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Location"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      fullWidth
                      placeholder="e.g. Miami, FL"
                      sx={inputSx}
                    />
                    <TextField
                      label="Website"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      fullWidth
                      placeholder="e.g. https://acme.com"
                      sx={inputSx}
                    />
                  </Box>
                </Box>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 5: Telegram Setup (Optional) ═══════ */}
          {step === 5 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Avatar sx={{
                    width: 56, height: 56, mx: 'auto', mb: 2,
                    background: 'linear-gradient(135deg, #0088cc, #29b6f6)',
                  }}>
                    <SmartphoneIcon sx={{ fontSize: 30 }} />
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Telegram Access
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                    Talk to Ace from your phone via Telegram (optional)
                  </Typography>
                </Box>

                <Box sx={{ maxWidth: 480, mx: 'auto' }}>
                  <Card sx={{
                    mb: 2,
                    border: `1px solid ${alpha('#0088cc', 0.2)}`,
                    background: alpha('#0088cc', 0.04),
                  }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        How to get a Telegram bot token:
                      </Typography>
                      <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { fontSize: '0.82rem', color: BRAND.textSecondary, mb: 0.5, lineHeight: 1.5 } }}>
                        <li>Open Telegram and search for <strong>@BotFather</strong></li>
                        <li>Send <code>/newbot</code> and follow the prompts</li>
                        <li>Copy the bot token BotFather gives you</li>
                        <li>Paste it below</li>
                      </Box>
                    </CardContent>
                  </Card>

                  <TextField
                    label="Bot Token"
                    value={telegramToken}
                    onChange={e => { setTelegramToken(e.target.value); setTelegramTestResult(null); }}
                    fullWidth
                    placeholder="1234567890:ABCdefGhIjKlmNoPqRsTuVwXyZ"
                    sx={inputSx}
                  />

                  {telegramToken.trim().length > 10 && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                      <Button
                        variant="outlined" size="small"
                        onClick={async () => {
                          setTelegramTesting(true);
                          setTelegramTestResult(null);
                          try {
                            const res = await fetch(`${API}/api/setup/test-telegram`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ bot_token: telegramToken }),
                            });
                            const data = await res.json();
                            setTelegramTestResult(data.success ? 'success' : `failed: ${data.error || 'Invalid token'}`);
                          } catch (e) {
                            setTelegramTestResult('failed: Network error');
                          }
                          setTelegramTesting(false);
                        }}
                        disabled={telegramTesting}
                        sx={{
                          borderColor: alpha('#0088cc', 0.3), color: '#0088cc',
                          '&:hover': { borderColor: '#0088cc', background: alpha('#0088cc', 0.08) },
                        }}
                      >
                        {telegramTesting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                        {telegramTesting ? 'Testing...' : 'Test Token'}
                      </Button>
                      {telegramTestResult === 'success' && (
                        <Chip icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} label="Valid!" size="small"
                          sx={{ background: alpha(BRAND.success, 0.15), color: BRAND.success, fontWeight: 600 }} />
                      )}
                      {telegramTestResult && telegramTestResult !== 'success' && (
                        <Chip icon={<ErrorOutlineIcon sx={{ fontSize: 16 }} />} label={telegramTestResult} size="small"
                          sx={{ background: alpha(BRAND.error, 0.15), color: BRAND.error, fontWeight: 600, maxWidth: 260 }} />
                      )}
                    </Box>
                  )}

                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: BRAND.textMuted }}>
                    Skip this if you don't use Telegram — you can set it up later in Settings
                  </Typography>
                </Box>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 6: Desktop Control ═══════ */}
          {step === 6 && (
            <Fade in timeout={500}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Avatar sx={{
                    width: 56, height: 56, mx: 'auto', mb: 2,
                    background: desktopControl
                      ? `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondary})`
                      : `linear-gradient(135deg, ${BRAND.textMuted}, ${alpha(BRAND.textMuted, 0.5)})`,
                    transition: 'all 0.3s ease',
                  }}>
                    <DesktopWindowsIcon sx={{ fontSize: 30 }} />
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    🖥️ Full Computer Control
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary, maxWidth: 480, mx: 'auto' }}>
                    Ace can control your mouse and keyboard to browse the web, open apps,
                    and manage files — just like a human assistant at your desk.
                  </Typography>
                </Box>

                <Box sx={{ maxWidth: 480, mx: 'auto' }}>
                  <Card sx={{
                    mb: 3,
                    border: `1px solid ${alpha(desktopControl ? BRAND.success : BRAND.textMuted, 0.3)}`,
                    background: desktopControl
                      ? `linear-gradient(135deg, ${alpha(BRAND.success, 0.1)} 0%, ${alpha(BRAND.success, 0.02)} 100%)`
                      : alpha('#fff', 0.02),
                    transition: 'all 0.3s ease',
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Enable Desktop Control
                          </Typography>
                          <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem' }}>
                            Allow Ace to operate your computer autonomously
                          </Typography>
                        </Box>
                        <Switch
                          checked={desktopControl}
                          onChange={e => setDesktopControl(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.success },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: BRAND.success },
                          }}
                        />
                      </Box>

                      {desktopControl && (
                        <Fade in>
                          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {[
                              { icon: <MouseIcon sx={{ fontSize: 16 }} />, label: 'Mouse Control' },
                              { icon: <KeyboardIcon sx={{ fontSize: 16 }} />, label: 'Keyboard' },
                              { icon: <WebIcon sx={{ fontSize: 16 }} />, label: 'Browser' },
                            ].map(item => (
                              <Chip key={item.label} icon={item.icon} label={item.label} size="small" sx={{
                                background: alpha(BRAND.success, 0.1),
                                color: BRAND.success,
                                border: `1px solid ${alpha(BRAND.success, 0.2)}`,
                              }} />
                            ))}
                          </Box>
                        </Fade>
                      )}
                    </CardContent>
                  </Card>

                  {desktopControl && (
                    <Fade in>
                      <Card sx={{
                        border: `1px solid ${alpha(BRAND.warning, 0.3)}`,
                        background: alpha(BRAND.warning, 0.05),
                      }}>
                        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                          <WarningAmberIcon sx={{ color: BRAND.warning, mt: 0.3 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BRAND.warning, mb: 0.5 }}>
                              ⚠️ Risk Warning
                            </Typography>
                            <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem', lineHeight: 1.6 }}>
                              Desktop control gives Ace the ability to move your mouse, type on your keyboard,
                              and interact with applications. While safeguards are in place, unintended actions
                              may occur. System apps (Terminal, System Preferences) are blocked by default.
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Fade>
                  )}

                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: BRAND.textMuted }}>
                    You can always change this later in Settings → Organization
                  </Typography>
                </Box>
              </Box>
            </Fade>
          )}

          {/* ═══════ Step 7: All Set! ═══════ */}
          {step === 7 && (
            <Fade in timeout={500}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar sx={{
                  width: 80, height: 80, mx: 'auto', mb: 3,
                  background: `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondary})`,
                  boxShadow: `0 8px 32px ${alpha(BRAND.success, 0.4)}`,
                }}>
                  <CheckCircleIcon sx={{ fontSize: 44 }} />
                </Avatar>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                  ✅ You're all set, {ownerName || 'there'}!
                </Typography>
                <Typography variant="body1" sx={{ color: BRAND.textSecondary, mb: 4, maxWidth: 480, mx: 'auto' }}>
                  Ace is ready to help you with {companyName || 'your business'}. Here's what's been configured:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480, mx: 'auto', mb: 4 }}>
                  {/* AI Provider summary */}
                  <Card sx={{
                    border: `1px solid ${alpha(AI_PROVIDERS[selectedProvider]?.color || BRAND.primary, 0.2)}`,
                    background: alpha(AI_PROVIDERS[selectedProvider]?.color || BRAND.primary, 0.05),
                  }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <StorageIcon sx={{ color: AI_PROVIDERS[selectedProvider]?.color || BRAND.primary }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>AI Provider</Typography>
                        <Typography variant="caption" sx={{ color: AI_PROVIDERS[selectedProvider]?.color || BRAND.textSecondary }}>
                          {AI_PROVIDERS[selectedProvider]?.icon} {AI_PROVIDERS[selectedProvider]?.name || selectedProvider}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Desktop control summary */}
                  <Card sx={{
                    border: `1px solid ${alpha(desktopControl ? BRAND.success : BRAND.textMuted, 0.2)}`,
                    background: alpha(desktopControl ? BRAND.success : BRAND.textMuted, 0.05),
                  }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <DesktopWindowsIcon sx={{ color: desktopControl ? BRAND.success : BRAND.textMuted }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Desktop Control</Typography>
                        <Typography variant="caption" sx={{ color: desktopControl ? BRAND.success : BRAND.textMuted }}>
                          {desktopControl ? '✅ Enabled' : '❌ Disabled'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Telegram summary (only if token provided) */}
                  {telegramToken.trim() && (
                    <Card sx={{
                      border: `1px solid ${alpha('#0088cc', 0.2)}`,
                      background: alpha('#0088cc', 0.05),
                    }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <SmartphoneIcon sx={{ color: '#0088cc' }} />
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Telegram</Typography>
                          <Typography variant="caption" sx={{ color: '#0088cc' }}>
                            Connected
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Box>

                <Button
                  variant="contained" size="large"
                  endIcon={<ArrowForwardIcon />}
                  onClick={onComplete}
                  sx={{
                    px: 5, py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: '1rem',
                    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`,
                    boxShadow: `0 4px 20px ${alpha(BRAND.primary, 0.4)}`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${BRAND.primaryLight}, ${BRAND.primary})`,
                      boxShadow: `0 6px 28px ${alpha(BRAND.primary, 0.5)}`,
                    },
                  }}
                >
                  Go to Dashboard
                </Button>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {/* Navigation Buttons */}
      {step > 0 && step < 7 && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 4, py: 3, maxWidth: 660, mx: 'auto', width: '100%',
        }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={goBack}
            sx={{ color: BRAND.textSecondary, '&:hover': { color: BRAND.textPrimary } }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            endIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
            onClick={handleNext}
            disabled={!canProceed() || saving}
            sx={{
              px: 4, py: 1, borderRadius: 3, fontWeight: 600,
              background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`,
              '&:hover': {
                background: `linear-gradient(135deg, ${BRAND.primaryLight}, ${BRAND.primary})`,
              },
              '&.Mui-disabled': { opacity: 0.4 },
            }}
          >
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

/* ─── Helper Components ─── */

function StatusChip({ ok, label, warn }) {
  const color = ok ? BRAND.success : (warn ? BRAND.warning : BRAND.error);
  return (
    <Chip
      icon={ok ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ErrorOutlineIcon sx={{ fontSize: 16 }} />}
      label={label}
      size="small"
      sx={{
        background: alpha(color, 0.12),
        color: color,
        border: `1px solid ${alpha(color, 0.25)}`,
        fontWeight: 600,
        fontSize: '0.75rem',
      }}
    />
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    '& fieldset': { borderColor: alpha(BRAND.border, 0.8) },
    '&:hover fieldset': { borderColor: BRAND.primary },
    '&.Mui-focused fieldset': { borderColor: BRAND.primary },
  },
};
