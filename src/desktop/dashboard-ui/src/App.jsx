import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, CssBaseline, Typography, ThemeProvider, alpha, IconButton, CircularProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Chip, TextField, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import Snackbar from '@mui/material/Snackbar';

import { darkTheme, lightTheme, BRAND } from './theme';
import Chat from './Chat';
import Sidebar from './components/Sidebar';
import OnboardingWizard from './components/OnboardingWizard';

import SOPs from './components/SOPs';
import Pipeline from './components/Pipeline';
import Settings from './components/Settings';
import Automation from './components/Automation';
import Organization from './components/Organization';
import Studio from './components/Studio';
import Contacts from './components/Contacts';
import Forms from './components/Forms';
import Workload from './components/Workload';
import Books from './components/Books';
import Integrations from './components/Integrations';
import GuidedTour from './components/GuidedTour';

const API = 'http://localhost:3333';

// Tool IDs that open chat actions instead of separate pages
const CHAT_TOOLS = new Set(['research', 'social']);

function App() {
  const [selectedTool, setSelectedTool] = useState(null); // null = chat view
  const [collapsed, setCollapsed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(null);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('ace_theme') || 'dark');

  // Conversations for sidebar
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // Credit/billing state
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);

  // Update system state
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateProgress, setUpdateProgress] = useState([]);
  const [updating, setUpdating] = useState(false);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSnack, setFeedbackSnack] = useState('');

  // Setup service modal
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  // Guided tour
  const [tourActive, setTourActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Recording overlay
  const [recordingState, setRecordingState] = useState(null);

  const handleRecordingDone = useCallback(() => {
    if (!recordingState) return;
    setRecordingState(prev => prev ? { ...prev, state: 'saving' } : null);
  }, [recordingState]);

  // ═══ EFFECTS ═══

  useEffect(() => {
    const onStart = (e) => setRecordingState({ stepNum: e.detail.stepNum, mode: e.detail.mode, state: 'recording' });
    const onStop = () => {
      setRecordingState(prev => prev ? { ...prev, state: 'saved' } : null);
      setTimeout(() => setRecordingState(null), 3000);
    };
    window.addEventListener('ace:recording-start', onStart);
    window.addEventListener('ace:recording-stop', onStop);
    return () => { window.removeEventListener('ace:recording-start', onStart); window.removeEventListener('ace:recording-stop', onStop); };
  }, []);

  useEffect(() => {
    fetch(`${API}/api/onboarding-status`)
      .then(r => r.json())
      .then(res => setNeedsOnboarding(res.data?.needsOnboarding ?? false))
      .catch(() => setNeedsOnboarding(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/system/update-check`)
      .then(r => r.json())
      .then(res => { if (res.success && res.data) setUpdateInfo(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchCredits = () => {
      fetch(`${API}/api/billing/credits`)
        .then(r => r.json())
        .then(res => { if (res.success && res.data) setCreditBalance(res.data); })
        .catch(() => {});
    };
    fetchCredits();
    const interval = setInterval(fetchCredits, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch conversations for sidebar
  useEffect(() => {
    const fetchConversations = () => {
      fetch(`${API}/api/conversations`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            setConversations(res.data);
          }
        })
        .catch(() => {});
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen for conversation updates from Chat.jsx
  useEffect(() => {
    const handle = (e) => {
      if (e.detail?.conversations) setConversations(e.detail.conversations);
      if (e.detail?.activeId) setActiveConversationId(e.detail.activeId);
    };
    window.addEventListener('ace:conversations-updated', handle);
    return () => window.removeEventListener('ace:conversations-updated', handle);
  }, []);

  // Navigation events
  useEffect(() => {
    const handle = (e) => { if (e.detail?.page) setSelectedTool(e.detail.page === 'chat' ? null : e.detail.page); };
    window.addEventListener('ace:navigate', handle);
    return () => window.removeEventListener('ace:navigate', handle);
  }, []);

  useEffect(() => {
    const handle = () => setTourActive(true);
    window.addEventListener('ace:start-tour', handle);
    return () => window.removeEventListener('ace:start-tour', handle);
  }, []);

  // ═══ HANDLERS ═══

  const handleStartUpdate = useCallback(() => {
    setUpdating(true);
    setUpdateProgress([]);
    setUpdateDialogOpen(true);
    fetch(`${API}/api/system/update`, { method: 'POST' }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setUpdateProgress(prev => {
                const existing = prev.findIndex(p => p.step === data.step);
                if (existing >= 0) { const updated = [...prev]; updated[existing] = data; return updated; }
                return [...prev, data];
              });
              if (data.step === 'restart' || (data.step === 'complete' && data.status === 'done')) {
                setTimeout(() => window.location.reload(), 5000);
              }
            } catch {}
          }
        }
      }
    }).catch(() => {
      setUpdateProgress(prev => [...prev, { step: 'error', status: 'error', detail: 'Connection lost' }]);
    }).finally(() => setUpdating(false));
  }, []);

  const handleDismissUpdate = useCallback(async () => {
    setUpdateDismissed(true);
    if (updateInfo?.latestVersion) {
      try {
        await fetch(`${API}/api/system/dismiss-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: updateInfo.latestVersion }),
        });
      } catch {}
    }
  }, [updateInfo]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackMsg.trim()) return;
    try {
      const res = await fetch(`${API}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: feedbackType, message: feedbackMsg }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackSnack('Thanks! Your feedback has been sent.');
        setFeedbackMsg('');
        setFeedbackType('general');
        setFeedbackOpen(false);
      }
    } catch {
      setFeedbackSnack('Failed to send feedback. Try again.');
    }
  }, [feedbackMsg, feedbackType]);

  const handleSelectTool = (toolId) => {
    if (CHAT_TOOLS.has(toolId)) {
      // Research and Social → switch to chat with a prefilled action
      setSelectedTool(null);
      const prefix = toolId === 'research' ? '[WEB SEARCH] ' : '[SOCIAL MEDIA] ';
      window.dispatchEvent(new CustomEvent('ace:prefill-chat', { detail: { text: prefix } }));
    } else {
      setSelectedTool(toolId);
    }
  };

  const handleToggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ace_theme', next);
      return next;
    });
  }, []);

  const activeTheme = themeMode === 'light' ? lightTheme : darkTheme;

  const handleNewChat = () => {
    setSelectedTool(null);
    setActiveConversationId(null);
    window.dispatchEvent(new CustomEvent('ace:new-chat'));
  };

  const handleSelectConversation = (id) => {
    setSelectedTool(null);
    setActiveConversationId(id);
    window.dispatchEvent(new CustomEvent('ace:select-conversation', { detail: { id } }));
  };

  const handleDeleteConversation = (id) => {
    fetch(`${API}/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      window.dispatchEvent(new CustomEvent('ace:new-chat'));
    }
  };

  const creditCount = creditBalance?.plan === 'trial' ? null
    : creditBalance?.plan === 'byo_key' ? null
    : creditBalance?.total ?? null;

  // ═══ RENDER ═══

  // Loading
  if (needsOnboarding === null) {
    return (
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <CircularProgress sx={{ color: BRAND.primary }} />
        </Box>
      </ThemeProvider>
    );
  }

  // Onboarding
  if (needsOnboarding) {
    return (
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <OnboardingWizard onComplete={() => {
          setNeedsOnboarding(false);
          if (!localStorage.getItem('ace_tour_completed')) {
            setTimeout(() => setTourActive(true), 500);
          }
        }} />
      </ThemeProvider>
    );
  }

  // Tool page components
  const toolPages = {
    pipeline: <Pipeline />,
    contacts: <Contacts />,
    sops: <SOPs />,
    forms: <Forms />,
    studio: <Studio />,
    books: <Books />,
    automation: <Automation />,
    workload: <Workload />,
    organization: <Organization />,
    integrations: <Integrations />,
    settings: <Settings />,
  };

  const showChat = selectedTool === null;

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          selectedTool={selectedTool}
          onSelectTool={handleSelectTool}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          credits={creditCount}
          onOpenSettings={() => setSelectedTool('settings')}
          onOpenCredits={() => setCreditModalOpen(true)}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
          {/* Update Banner */}
          {updateInfo?.updateAvailable && !updateDismissed && updateInfo.latestVersion !== updateInfo.dismissedVersion && (
            <Box sx={{
              px: 3, py: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: alpha(BRAND.primaryLight, 0.08),
              borderBottom: `1px solid ${alpha(BRAND.primaryLight, 0.15)}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SystemUpdateIcon sx={{ fontSize: 16, color: BRAND.primaryLight }} />
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary }}>
                  OpenAce <strong>v{updateInfo.latestVersion}</strong> available
                </Typography>
                <Button size="small" onClick={() => window.open(updateInfo.releaseUrl, '_blank')}
                  sx={{ fontSize: '0.72rem', textTransform: 'none', minWidth: 0, color: BRAND.primaryLight }}>
                  What's New
                </Button>
                <Button size="small" variant="contained" onClick={handleStartUpdate}
                  sx={{ fontSize: '0.72rem', textTransform: 'none', minWidth: 0, py: 0.2, px: 1.5 }}>
                  Update
                </Button>
              </Box>
              <IconButton size="small" onClick={handleDismissUpdate} sx={{ color: BRAND.textMuted }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}

          {/* Chat — always mounted, hidden when tool page is active */}
          <Box sx={{ flex: 1, display: showChat ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
            <Chat hideSidebar />
          </Box>

          {/* Tool Pages — mount only when selected */}
          {selectedTool && toolPages[selectedTool] && (
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {toolPages[selectedTool]}
            </Box>
          )}
        </Box>

        {/* Recording Overlay */}
        {recordingState && (
          <Box sx={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
            minWidth: 280, p: 2.5, borderRadius: '16px',
            background: recordingState.state === 'saved' ? alpha('#4ade80', 0.15)
              : recordingState.state === 'saving' ? alpha(BRAND.bgCard, 0.95)
              : alpha('#f44336', 0.12),
            border: `1px solid ${recordingState.state === 'saved' ? alpha('#4ade80', 0.3)
              : recordingState.state === 'saving' ? alpha(BRAND.border, 0.5)
              : alpha('#f44336', 0.3)}`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            {recordingState.state === 'recording' && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FiberManualRecordIcon sx={{
                    fontSize: 14, color: '#f44336',
                    animation: 'recPulse 1s infinite',
                    '@keyframes recPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
                  }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#f44336', fontWeight: 700 }}>
                    Recording Step {recordingState.stepNum}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 1.5 }}>
                  {recordingState.mode === 'click_through' ? 'Click on each element in order' : 'Show me how to do this step'}
                </Typography>
                <Button variant="contained" fullWidth onClick={handleRecordingDone}
                  sx={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)', fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px', textTransform: 'none', py: 1, boxShadow: 'none' }}>
                  Done
                </Button>
              </>
            )}
            {recordingState.state === 'saving' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
                <CircularProgress size={20} sx={{ color: BRAND.primaryLight }} />
                <Typography sx={{ fontSize: '0.85rem', color: BRAND.textSecondary }}>Analyzing your demonstration...</Typography>
              </Box>
            )}
            {recordingState.state === 'saved' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 22, color: '#4ade80' }} />
                <Typography sx={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 700 }}>Got it! I'll use this next time.</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Guided Tour */}
        <GuidedTour
          active={tourActive}
          onClose={() => setTourActive(false)}
          onNavigate={(tabId) => setSelectedTool(tabId === 'chat' ? null : tabId)}
          currentPage={selectedTool || 'chat'}
          helpOpen={helpOpen}
          onHelpToggle={() => setHelpOpen(!helpOpen)}
        />

        {/* ═══ MODALS ═══ */}

        {/* Update Progress */}
        <Dialog open={updateDialogOpen}
          PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 400 } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>Updating OpenAce</DialogTitle>
          <DialogContent>
            {['backup', 'pull', 'install', 'build', 'migrate', 'restart'].map(step => {
              const entry = updateProgress.find(p => p.step === step);
              const labels = { backup: 'Backing up data', pull: 'Pulling latest code', install: 'Installing dependencies', build: 'Building dashboard', migrate: 'Running migrations', restart: 'Restarting server' };
              return (
                <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8 }}>
                  {entry?.status === 'done' ? <CheckCircleIcon sx={{ fontSize: 18, color: BRAND.success }} />
                    : entry?.status === 'active' ? <CircularProgress size={16} sx={{ color: BRAND.primaryLight }} />
                    : entry?.status === 'error' ? <Box sx={{ width: 18, height: 18, borderRadius: '50%', background: BRAND.error, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CloseIcon sx={{ fontSize: 12, color: '#fff' }} /></Box>
                    : <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${BRAND.border}` }} />}
                  <Box>
                    <Typography sx={{ fontSize: '0.85rem', color: entry ? BRAND.textPrimary : BRAND.textMuted }}>{labels[step]}</Typography>
                    {entry?.detail && <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted }}>{entry.detail}</Typography>}
                  </Box>
                </Box>
              );
            })}
            {updateProgress.find(p => p.step === 'complete' && p.status === 'done') && (
              <Typography sx={{ mt: 2, fontSize: '0.85rem', color: BRAND.success, fontWeight: 600 }}>Update complete — reconnecting in 5 seconds...</Typography>
            )}
            {updateProgress.find(p => p.status === 'error') && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: '0.85rem', color: BRAND.error, fontWeight: 600 }}>
                  Update failed: {updateProgress.find(p => p.status === 'error')?.detail || 'Unknown error'}
                </Typography>
                <Button variant="contained" size="small" sx={{ mt: 1.5, mb: 1, textTransform: 'none', fontWeight: 600 }}
                  onClick={() => {
                    setUpdateProgress([]);
                    setUpdating(true);
                    fetch(`${API}/api/system/update-fix`, { method: 'POST' }).then(async (response) => {
                      const reader = response.body.getReader();
                      const decoder = new TextDecoder();
                      let buffer = '';
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                          if (line.startsWith('data: ')) {
                            try {
                              const data = JSON.parse(line.slice(6));
                              setUpdateProgress(prev => {
                                const existing = prev.findIndex(p => p.step === data.step);
                                if (existing >= 0) { const next = [...prev]; next[existing] = data; return next; }
                                return [...prev, data];
                              });
                            } catch {}
                          }
                        }
                      }
                    }).catch(() => {
                      setUpdateProgress(prev => [...prev, { step: 'error', status: 'error', detail: 'Connection lost' }]);
                    }).finally(() => setUpdating(false));
                  }}>
                  Fix & Retry Update
                </Button>
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.textMuted, mt: 1 }}>Or run manually:</Typography>
                <Box sx={{ mt: 0.5, p: 1.5, background: 'rgba(0,0,0,0.3)', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', color: BRAND.textPrimary, userSelect: 'all' }}>
                  git checkout -- src/desktop/dashboard-ui/dist/ && git pull origin main && npm install && npm start
                </Box>
              </Box>
            )}
          </DialogContent>
          {!updating && <DialogActions><Button onClick={() => setUpdateDialogOpen(false)} size="small">Close</Button></DialogActions>}
        </Dialog>

        {/* Feedback */}
        <Dialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)}
          PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 380 } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>Send Feedback</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
              {['bug', 'feature', 'general'].map(t => (
                <Chip key={t}
                  label={t === 'bug' ? 'Bug Report' : t === 'feature' ? 'Feature Request' : 'General'}
                  size="small" onClick={() => setFeedbackType(t)}
                  sx={{
                    background: feedbackType === t ? alpha(BRAND.primary, 0.2) : alpha(BRAND.bgSurface, 0.5),
                    border: feedbackType === t ? `1px solid ${BRAND.primary}` : `1px solid ${BRAND.border}`,
                    color: feedbackType === t ? BRAND.primaryLight : BRAND.textSecondary,
                    fontWeight: feedbackType === t ? 600 : 400, cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
            <TextField multiline rows={4} fullWidth placeholder="Tell us what's on your mind..."
              value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.9rem' } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFeedbackOpen(false)} size="small">Cancel</Button>
            <Button onClick={handleSubmitFeedback} variant="contained" size="small" disabled={!feedbackMsg.trim()}>Send</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!feedbackSnack} autoHideDuration={3000} onClose={() => setFeedbackSnack('')} message={feedbackSnack} />

        {/* Credits */}
        <Dialog open={creditModalOpen} onClose={() => setCreditModalOpen(false)}
          PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 360 } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>{creditBalance?.plan === 'trial' ? 'Free Trial' : 'Ace Credits'}</DialogTitle>
          <DialogContent>
            {creditBalance?.plan === 'trial' && creditBalance.trialDaysLeft > 0 ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }}>{creditBalance.trialDaysLeft} days remaining in your free trial.</Typography>
                <Button variant="contained" fullWidth onClick={async () => {
                  try {
                    const res = await fetch(`${API}/api/billing/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'subscription' }) });
                    const data = await res.json();
                    if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                  } catch {}
                }} sx={{ mb: 1 }}>Subscribe — $15/mo</Button>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>Balance: <strong>{(creditBalance?.total || 0).toLocaleString()} credits</strong></Typography>
                <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>Top Up</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  {[5, 10, 25].map(amt => (
                    <Button key={amt} variant="outlined" size="small" sx={{ flex: 1 }}
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API}/api/billing/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'top_up', amount: amt }) });
                          const data = await res.json();
                          if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                        } catch {}
                      }}>
                      ${amt} ({(amt * 100).toLocaleString()})
                    </Button>
                  ))}
                </Box>
                {!creditBalance?.stripeSubscriptionId && (
                  <Button variant="contained" fullWidth size="small" onClick={async () => {
                    try {
                      const res = await fetch(`${API}/api/billing/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'subscription' }) });
                      const data = await res.json();
                      if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                    } catch {}
                  }} sx={{ mb: 1 }}>Subscribe — $15/mo (1,500 credits)</Button>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreditModalOpen(false)} size="small">Close</Button>
            <Button onClick={() => { setCreditModalOpen(false); setSelectedTool('settings'); }} size="small">Billing Settings</Button>
          </DialogActions>
        </Dialog>

        {/* Setup Service */}
        <Dialog open={setupModalOpen} onClose={() => setSetupModalOpen(false)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: '16px', border: `1px solid ${alpha(BRAND.primary, 0.15)}` } }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Setup Service</Typography>
            <IconButton size="small" onClick={() => setSetupModalOpen(false)} sx={{ color: BRAND.textMuted }}><CloseIcon fontSize="small" /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Typography sx={{ fontSize: '0.88rem', color: BRAND.textSecondary, mb: 2.5, lineHeight: 1.6 }}>
              A real teammate will set up OpenAce for your business — so Ace is ready to hit the ground running.
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: BRAND.textMuted, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What's included</Typography>
            {['Install & configure OpenAce on your computer', 'Learn your sales process and build custom SOPs', 'Set up daily routines (lead research, follow-ups, pipeline)', 'Import your existing contacts and leads', 'Live walkthrough so you know how everything works'].map((item, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: BRAND.secondary, mt: 0.25, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.82rem', color: BRAND.textPrimary, lineHeight: 1.4 }}>{item}</Typography>
              </Box>
            ))}
            <Box sx={{ mt: 2.5, p: 2, borderRadius: '12px', background: alpha(BRAND.primary, 0.04), border: `1px solid ${alpha(BRAND.primary, 0.1)}` }}>
              <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: BRAND.textPrimary, lineHeight: 1 }}>
                  $150<Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 500, color: BRAND.textMuted }}> / hour</Typography>
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: BRAND.textSecondary, mt: 0.5 }}>Most setups take 3–6 hours</Typography>
              </Box>
              <Divider sx={{ borderColor: alpha(BRAND.border, 0.3), my: 1.5 }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: BRAND.textPrimary }}>Starts with a free 15-minute discovery call</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
            <Button onClick={() => setSetupModalOpen(false)} sx={{ color: BRAND.textMuted, fontSize: '0.82rem' }}>Maybe later</Button>
            <Button variant="contained" onClick={() => window.open('https://calendly.com/likemindedpro/45min', '_blank')}
              sx={{ background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.primary})`, fontWeight: 700, fontSize: '0.82rem', borderRadius: '10px', px: 3, textTransform: 'none' }}>
              Book Free Discovery Call
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;
