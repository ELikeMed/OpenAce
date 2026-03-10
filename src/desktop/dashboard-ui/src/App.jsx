import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, CssBaseline, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  Typography, ThemeProvider, Avatar, Divider, Chip, alpha, IconButton, Tooltip, CircularProgress,
  Button, Select, MenuItem, FormControl, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import TokenIcon from '@mui/icons-material/Token';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import CloseIcon from '@mui/icons-material/Close';
import FeedbackIcon from '@mui/icons-material/Feedback';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';

import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssignmentIcon from '@mui/icons-material/Assignment';

import AutoModeIcon from '@mui/icons-material/AutoMode';
import AceSpadeIcon from './components/AceSpadeIcon';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import GroupsIcon from '@mui/icons-material/Groups';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CodeIcon from '@mui/icons-material/Code';

import theme, { BRAND } from './theme';
import Chat from './Chat';

import SOPs from './components/SOPs';
import Pipeline from './components/Pipeline';
import Settings from './components/Settings';

import Automation from './components/Automation';
import Organization from './components/Organization';
import OnboardingWizard from './components/OnboardingWizard';
import Studio from './components/Studio';
import Contacts from './components/Contacts';
import Forms from './components/Forms';
import ContactsIcon from '@mui/icons-material/Contacts';
import QuizIcon from '@mui/icons-material/Quiz';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExtensionIcon from '@mui/icons-material/Extension';

import Workload from './components/Workload';
import Integrations from './components/Integrations';


const API = 'http://localhost:3333';
const drawerWidth = 280;
const collapsedWidth = 72;

const menuItems = [
  { text: 'Chat', icon: <ChatIcon />, id: 'chat' },
  { text: 'Pipeline', icon: <AccountTreeIcon />, id: 'pipeline' },
  { text: 'Contacts', icon: <ContactsIcon />, id: 'contacts' },
  { text: 'Routines', icon: <AutoModeIcon />, id: 'automation' },
  { text: 'Processes', icon: <AssignmentIcon />, id: 'sops' },
  { text: 'Forms', icon: <QuizIcon />, id: 'forms' },
  { text: 'Coder', icon: <CodeIcon />, id: 'studio' },
  { text: 'Media & Files', icon: <FolderOpenIcon />, id: 'workload' },
  { text: 'Organization', icon: <GroupsIcon />, id: 'organization' },
  { text: 'Integrations', icon: <ExtensionIcon />, id: 'integrations' },
  { text: 'Settings', icon: <SettingsIcon />, id: 'settings' },
];

function App() {
  const [selectedPage, setSelectedPage] = useState('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(null); // null = loading
  const [studioNewBadge, setStudioNewBadge] = useState(false); // pulse indicator on Studio nav item

  // Multi-business state
  const [businesses, setBusinesses] = useState([]);
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [switchingBiz, setSwitchingBiz] = useState(false);

  // Credit/billing state
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);

  // Update system state
  const [updateInfo, setUpdateInfo] = useState(null); // { updateAvailable, latestVersion, releaseUrl, releaseNotes, dismissedVersion }
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateProgress, setUpdateProgress] = useState([]); // [{ step, status, detail }]
  const [updating, setUpdating] = useState(false);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSnack, setFeedbackSnack] = useState('');

  // Global recording overlay state
  const [recordingState, setRecordingState] = useState(null); // null | { stepNum, mode, state: 'recording'|'saving'|'saved' }

  const handleRecordingDone = useCallback(async () => {
    if (!recordingState) return;
    setRecordingState(prev => prev ? { ...prev, state: 'saving' } : null);
    // The actual stop call is handled by Chat.jsx — this overlay just shows status
    // Listen for the stop event to transition to 'saved'
  }, [recordingState]);

  // Listen for recording start/stop events from Chat.jsx
  useEffect(() => {
    const onStart = (e) => {
      setRecordingState({ stepNum: e.detail.stepNum, mode: e.detail.mode, state: 'recording' });
    };
    const onStop = () => {
      setRecordingState(prev => prev ? { ...prev, state: 'saved' } : null);
      setTimeout(() => setRecordingState(null), 3000);
    };
    window.addEventListener('ace:recording-start', onStart);
    window.addEventListener('ace:recording-stop', onStop);
    return () => {
      window.removeEventListener('ace:recording-start', onStart);
      window.removeEventListener('ace:recording-stop', onStop);
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/api/onboarding-status`)
      .then(r => r.json())
      .then(res => {
        setNeedsOnboarding(res.data?.needsOnboarding ?? false);
      })
      .catch(() => setNeedsOnboarding(false)); // If API fails, skip onboarding
  }, []);

  // Check for updates on mount
  useEffect(() => {
    fetch(`${API}/api/system/update-check`)
      .then(r => r.json())
      .then(res => { if (res.success && res.data) setUpdateInfo(res.data); })
      .catch(() => {});
  }, []);

  // Start SSE update stream
  const handleStartUpdate = useCallback(() => {
    setUpdating(true);
    setUpdateProgress([]);
    setUpdateDialogOpen(true);

    const es = new EventSource(`${API}/api/system/update`);
    // POST via EventSource isn't supported — use fetch with streaming instead
    es.close();

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
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = data;
                  return updated;
                }
                return [...prev, data];
              });

              // On complete/restart — reload page after delay
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

  // Fetch credit balance on mount + poll every 60s
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

  // Fetch businesses on mount
  useEffect(() => {
    fetch(`${API}/api/businesses`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setBusinesses(res.data.businesses || []);
          const active = (res.data.businesses || []).find(b => b.id === res.data.activeId);
          setActiveBusiness(active || res.data.businesses?.[0] || null);
        }
      })
      .catch(() => {});
  }, []);

  const handleSwitchBusiness = async (id) => {
    if (id === activeBusiness?.id) return;
    setSwitchingBiz(true);
    try {
      const res = await fetch(`${API}/api/businesses/${id}/switch`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActiveBusiness(businesses.find(b => b.id === id) || null);
      }
    } catch (e) {
      console.error('Business switch failed:', e);
    } finally {
      setSwitchingBiz(false);
    }
  };

  // When CodeAgent creates a project, show a badge on Studio nav item and auto-navigate
  useEffect(() => {
    const handle = () => {
      setStudioNewBadge(true);
      setSelectedPage('studio');
    };
    window.addEventListener('ace:project-created', handle);
    return () => window.removeEventListener('ace:project-created', handle);
  }, []);

  // When Console sends an error to Ace for debugging, switch to Chat
  useEffect(() => {
    const handle = () => setSelectedPage('chat');
    window.addEventListener('ace:debug-error', handle);
    return () => window.removeEventListener('ace:debug-error', handle);
  }, []);

  // Generic navigation event (used by Integrations "Train Ace" button)
  useEffect(() => {
    const handle = (e) => {
      if (e.detail?.page) setSelectedPage(e.detail.page);
    };
    window.addEventListener('ace:navigate', handle);
    return () => window.removeEventListener('ace:navigate', handle);
  }, []);

  const currentWidth = collapsed ? collapsedWidth : drawerWidth;

  // All pages rendered but hidden — preserves state (chat messages, events, etc.)
  const pages = {
    chat: <Chat />,
    studio: <Studio />,
    organization: <Organization />,
    contacts: <Contacts />,
    forms: <Forms />,
    pipeline: <Pipeline />,
    workload: <Workload />,
    integrations: <Integrations />,
    sops: <SOPs />,
    automation: <Automation />,
    settings: <Settings />,
  };

  const currentPage = menuItems.find(i => i.id === selectedPage);

  // Loading state
  if (needsOnboarding === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <CircularProgress sx={{ color: BRAND.primary }} />
        </Box>
      </ThemeProvider>
    );
  }

  // Onboarding wizard (full-screen, no sidebar)
  if (needsOnboarding) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: currentWidth,
            flexShrink: 0,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '& .MuiDrawer-paper': {
              width: currentWidth,
              boxSizing: 'border-box',
              border: 'none',
              borderRight: `1px solid ${BRAND.border}`,
              background: `linear-gradient(180deg, ${BRAND.bgCard} 0%, ${BRAND.bg} 100%)`,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
            },
          }}
        >
          {/* Brand Header */}
          <Box sx={{
            p: collapsed ? '16px 12px' : '20px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 72,
          }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.secondary} 100%)`,
                boxShadow: `0 4px 15px ${alpha(BRAND.primary, 0.4)}`,
                flexShrink: 0,
              }}
            >
              <AceSpadeIcon sx={{ fontSize: 22 }} />
            </Avatar>
            {!collapsed && (
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="h6" sx={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${BRAND.textPrimary} 0%, ${BRAND.primaryLight} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  whiteSpace: 'nowrap',
                }}>
                  OpenAce
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FiberManualRecordIcon sx={{ fontSize: 8, color: BRAND.success }} />
                  <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.7rem' }}>
                    AI Executive Online
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          <Divider sx={{ mx: collapsed ? 1 : 2, borderColor: BRAND.border }} />

          {/* Navigation */}
          <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
            {!collapsed && (
              <Typography variant="overline" sx={{
                px: 3, py: 1.5, display: 'block',
                fontSize: '0.7rem', color: BRAND.textMuted, letterSpacing: '0.12em',
                fontWeight: 600,
              }}>
                Navigation
              </Typography>
            )}
            <List sx={{ px: 0 }}>
              {menuItems.map((item) => {
                const hasNewBadge = item.id === 'studio' && studioNewBadge;
                return (
                <ListItem key={item.id} disablePadding sx={{ px: collapsed ? 0.5 : 0 }}>
                  <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                    <ListItemButton
                      onClick={() => {
                        setSelectedPage(item.id);
                        if (item.id === 'studio') setStudioNewBadge(false);
                      }}
                      selected={selectedPage === item.id}
                      sx={{
                        minHeight: 52,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        px: collapsed ? 1.5 : 2.5,
                        gap: 0.5,
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: collapsed ? 0 : 44,
                        justifyContent: 'center',
                        color: selectedPage === item.id ? BRAND.primary : BRAND.textSecondary,
                        transition: 'color 0.2s ease',
                        position: 'relative',
                        '& .MuiSvgIcon-root': { fontSize: '1.4rem' },
                      }}>
                        {item.icon}
                        {hasNewBadge && (
                          <Box sx={{
                            position: 'absolute', top: -2, right: -2,
                            width: 10, height: 10, borderRadius: '50%',
                            background: BRAND.success,
                            boxShadow: `0 0 8px ${BRAND.success}`,
                          }} />
                        )}
                      </ListItemIcon>
                      {!collapsed && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Typography sx={{
                            fontSize: '0.95rem',
                            fontWeight: selectedPage === item.id ? 700 : 500,
                            color: selectedPage === item.id ? BRAND.textPrimary : BRAND.textSecondary,
                            letterSpacing: '0.01em',
                          }}>
                            {item.text}
                          </Typography>
                          {hasNewBadge && (
                            <Chip
                              label="NEW"
                              size="small"
                              sx={{
                                height: 18, fontSize: '0.65rem', fontWeight: 700,
                                background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                                color: '#fff',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          )}
                        </Box>
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
                );
              })}
            </List>
          </Box>

          {/* Collapse Toggle */}
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            <IconButton
              onClick={() => setCollapsed(!collapsed)}
              size="small"
              sx={{
                color: BRAND.textMuted,
                '&:hover': { color: BRAND.primary, background: alpha(BRAND.primary, 0.08) },
              }}
            >
              {collapsed ? <KeyboardArrowRightIcon /> : <KeyboardArrowLeftIcon />}
            </IconButton>
          </Box>

          {/* Status Footer */}
          {!collapsed && (
            <Box sx={{
              p: 2, mx: 2, mb: 1,
              borderRadius: 2,
              background: alpha(BRAND.primary, 0.06),
              border: `1px solid ${alpha(BRAND.primary, 0.12)}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <FiberManualRecordIcon sx={{ fontSize: 8, color: BRAND.success }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                  System Active
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.7rem' }}>
                All services running
              </Typography>
            </Box>
          )}

          {/* Founder Credit */}
          <Box sx={{
            px: collapsed ? 1 : 2, pb: 2, pt: 0.5,
            textAlign: 'center',
          }}>
            {collapsed ? (
              <Tooltip title="Created by Eric Greenstein" placement="right" arrow>
                <Avatar sx={{
                  width: 28, height: 28, mx: 'auto',
                  fontSize: '0.7rem', fontWeight: 700,
                  background: alpha(BRAND.textMuted, 0.1),
                  color: BRAND.textMuted,
                  cursor: 'default',
                }}>
                  EG
                </Avatar>
              </Tooltip>
            ) : (
              <Box>
                <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted, letterSpacing: '0.05em' }}>
                  Created by{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: BRAND.textSecondary }}>
                    Eric Greenstein
                  </Box>
                </Typography>
                <Typography
                  component="a"
                  href="mailto:openaceai@gmail.com"
                  sx={{
                    fontSize: '0.6rem', color: alpha(BRAND.primary, 0.7),
                    textDecoration: 'none', display: 'block', mt: 0.25,
                    '&:hover': { color: BRAND.primary },
                  }}
                >
                  openaceai@gmail.com
                </Typography>
              </Box>
            )}
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            overflow: 'hidden',
          }}
        >
          {/* Top Bar */}
          <Box sx={{
            px: 3, py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${BRAND.border}`,
            backdropFilter: 'blur(20px)',
            background: alpha(BRAND.bg, 0.8),
            minHeight: 64,
          }}>
            <Box>
              <Typography variant="h5" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {currentPage?.text || 'Chat'}
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* Business Switcher — dropdown when multiple, badge when one */}
              {businesses.length > 1 ? (
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <Select
                    value={activeBusiness?.id || ''}
                    onChange={(e) => handleSwitchBusiness(e.target.value)}
                    disabled={switchingBiz}
                    sx={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: BRAND.textPrimary,
                      height: 34,
                      background: alpha(BRAND.primary, 0.07),
                      border: `1px solid ${alpha(BRAND.primary, 0.18)}`,
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover': { background: alpha(BRAND.primary, 0.12) },
                    }}
                    renderValue={(val) => {
                      const biz = businesses.find(b => b.id === val);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <BusinessIcon sx={{ fontSize: 16, color: BRAND.primary }} />
                          <span>{biz?.name || 'Select Business'}</span>
                        </Box>
                      );
                    }}
                  >
                    {businesses.map(biz => (
                      <MenuItem key={biz.id} value={biz.id} sx={{ fontSize: '0.85rem' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{biz.name}</span>
                          {biz.industry && (
                            <span style={{ fontSize: '0.72rem', color: BRAND.textMuted }}>{biz.industry}</span>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : activeBusiness ? (
                <Chip
                  icon={<BusinessIcon sx={{ fontSize: '14px !important' }} />}
                  label={activeBusiness.name}
                  size="small"
                  sx={{
                    background: alpha(BRAND.primary, 0.1),
                    border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
                    color: BRAND.primary,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              ) : null}

              {/* Credit Badge */}
              {creditBalance && (
                <Chip
                  icon={<TokenIcon sx={{ fontSize: '14px !important' }} />}
                  label={
                    creditBalance.plan === 'trial' && creditBalance.trialDaysLeft > 0
                      ? `Trial: ${creditBalance.trialDaysLeft}d`
                      : creditBalance.plan === 'byo_key'
                        ? 'BYO Key'
                        : `${(creditBalance.total || 0).toLocaleString()} credits`
                  }
                  size="small"
                  onClick={() => setCreditModalOpen(true)}
                  sx={{
                    cursor: 'pointer',
                    background: alpha(
                      creditBalance.total <= 0 && creditBalance.plan !== 'trial' && creditBalance.plan !== 'byo_key'
                        ? BRAND.error
                        : creditBalance.total < 100 && creditBalance.plan === 'credits'
                          ? BRAND.warning
                          : BRAND.textMuted,
                      0.1
                    ),
                    border: `1px solid ${alpha(
                      creditBalance.total <= 0 && creditBalance.plan !== 'trial' && creditBalance.plan !== 'byo_key'
                        ? BRAND.error
                        : creditBalance.total < 100 && creditBalance.plan === 'credits'
                          ? BRAND.warning
                          : BRAND.textMuted,
                      0.2
                    )}`,
                    color: creditBalance.total <= 0 && creditBalance.plan !== 'trial' && creditBalance.plan !== 'byo_key'
                      ? BRAND.error
                      : creditBalance.total < 100 && creditBalance.plan === 'credits'
                        ? BRAND.warning
                        : BRAND.textMuted,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    '&:hover': { background: alpha(BRAND.textMuted, 0.2) },
                  }}
                />
              )}

              <Chip
                icon={<FeedbackIcon sx={{ fontSize: '14px !important' }} />}
                label="Feedback"
                size="small"
                onClick={() => setFeedbackOpen(true)}
                sx={{
                  cursor: 'pointer',
                  background: alpha(BRAND.textMuted, 0.1),
                  border: `1px solid ${alpha(BRAND.textMuted, 0.2)}`,
                  color: BRAND.textMuted,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  '&:hover': { background: alpha(BRAND.primary, 0.15), color: BRAND.primaryLight },
                }}
              />

              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important', color: `${BRAND.success} !important` }} />}
                label="Connected"
                size="small"
                sx={{
                  background: alpha(BRAND.success, 0.1),
                  border: `1px solid ${alpha(BRAND.success, 0.2)}`,
                  color: BRAND.success,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                }}
              />
            </Box>
          </Box>

          {/* Update Banner */}
          {updateInfo?.updateAvailable && !updateDismissed && updateInfo.latestVersion !== updateInfo.dismissedVersion && (
            <Box sx={{
              px: 3, py: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: alpha(BRAND.primaryLight, 0.1),
              borderBottom: `1px solid ${alpha(BRAND.primaryLight, 0.2)}`,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SystemUpdateIcon sx={{ fontSize: 18, color: BRAND.primaryLight }} />
                <Typography sx={{ fontSize: '0.82rem', color: BRAND.textSecondary }}>
                  OpenAce <strong>v{updateInfo.latestVersion}</strong> is available
                </Typography>
                <Button
                  size="small"
                  onClick={() => window.open(updateInfo.releaseUrl, '_blank')}
                  sx={{ fontSize: '0.75rem', textTransform: 'none', minWidth: 0, color: BRAND.primaryLight }}
                >
                  What's New
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleStartUpdate}
                  sx={{ fontSize: '0.75rem', textTransform: 'none', minWidth: 0, py: 0.3, px: 1.5 }}
                >
                  Update Now
                </Button>
              </Box>
              <IconButton size="small" onClick={handleDismissUpdate} sx={{ color: BRAND.textMuted }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}

          {/* Page Content — only mount active page + chat (preserves chat state).
              Mounting all pages simultaneously causes 6+ SSE connections which
              exhausts Chrome's HTTP/1.1 connection limit (6 per origin). */}
          <Box sx={{
            flexGrow: 1,
            overflow: 'auto',
            p: 3,
          }}>
            {Object.entries(pages).map(([id, component]) => {
              const alwaysMount = id === 'chat';
              if (!alwaysMount && selectedPage !== id) return null;
              return (
                <Box key={id} sx={{ display: selectedPage === id ? 'block' : 'none' }}>
                  {component}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Global Recording Overlay — floats bottom-right on all pages */}
        {recordingState && (
          <Box sx={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
            minWidth: 280, p: 2.5,
            borderRadius: '16px',
            background: recordingState.state === 'saved'
              ? alpha('#4ade80', 0.15)
              : recordingState.state === 'saving'
              ? alpha(BRAND.bgCard, 0.95)
              : alpha('#f44336', 0.12),
            border: `1px solid ${
              recordingState.state === 'saved' ? alpha('#4ade80', 0.3)
              : recordingState.state === 'saving' ? alpha(BRAND.border, 0.5)
              : alpha('#f44336', 0.3)
            }`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'overlayFadeIn 0.3s ease',
            '@keyframes overlayFadeIn': {
              from: { opacity: 0, transform: 'translateY(16px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}>
            {/* Recording state */}
            {recordingState.state === 'recording' && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FiberManualRecordIcon sx={{
                    fontSize: 14, color: '#f44336',
                    animation: 'recPulse 1s infinite',
                    '@keyframes recPulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.2 },
                    },
                  }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#f44336', fontWeight: 700 }}>
                    Recording Step {recordingState.stepNum}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 1.5 }}>
                  {recordingState.mode === 'click_through'
                    ? 'Click on each element in order'
                    : 'Show me how to do this step'}
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleRecordingDone}
                  sx={{
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                    fontSize: '0.8rem', fontWeight: 700, borderRadius: '10px',
                    textTransform: 'none', py: 1,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: '0 4px 14px rgba(34,197,94,0.4)' },
                  }}
                >
                  Done
                </Button>
              </>
            )}

            {/* Saving state */}
            {recordingState.state === 'saving' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
                <CircularProgress size={20} sx={{ color: BRAND.primaryLight }} />
                <Typography sx={{ fontSize: '0.85rem', color: BRAND.textSecondary }}>
                  Analyzing your demonstration...
                </Typography>
              </Box>
            )}

            {/* Saved state */}
            {recordingState.state === 'saved' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 22, color: '#4ade80' }} />
                <Typography sx={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 700 }}>
                  Got it! I'll use this next time.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Update Progress Dialog */}
      <Dialog
        open={updateDialogOpen}
        PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 400 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Updating OpenAce
        </DialogTitle>
        <DialogContent>
          {['backup', 'pull', 'install', 'build', 'migrate', 'restart'].map(step => {
            const entry = updateProgress.find(p => p.step === step);
            const labels = {
              backup: 'Backing up data',
              pull: 'Pulling latest code',
              install: 'Installing dependencies',
              build: 'Building dashboard',
              migrate: 'Running migrations',
              restart: 'Restarting server',
            };
            return (
              <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8 }}>
                {entry?.status === 'done' ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: BRAND.success }} />
                ) : entry?.status === 'active' ? (
                  <CircularProgress size={16} sx={{ color: BRAND.primaryLight }} />
                ) : entry?.status === 'error' ? (
                  <Box sx={{ width: 18, height: 18, borderRadius: '50%', background: BRAND.error, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CloseIcon sx={{ fontSize: 12, color: '#fff' }} />
                  </Box>
                ) : (
                  <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${BRAND.border}` }} />
                )}
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', color: entry ? BRAND.textPrimary : BRAND.textMuted }}>
                    {labels[step]}
                  </Typography>
                  {entry?.detail && (
                    <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted }}>{entry.detail}</Typography>
                  )}
                </Box>
              </Box>
            );
          })}
          {updateProgress.find(p => p.step === 'complete' && p.status === 'done') && (
            <Typography sx={{ mt: 2, fontSize: '0.85rem', color: BRAND.success, fontWeight: 600 }}>
              Update complete — reconnecting in 5 seconds...
            </Typography>
          )}
          {updateProgress.find(p => p.status === 'error') && (
            <Typography sx={{ mt: 2, fontSize: '0.85rem', color: BRAND.error }}>
              Update failed. Your data has been backed up. Try again or update manually.
            </Typography>
          )}
        </DialogContent>
        {!updating && (
          <DialogActions>
            <Button onClick={() => setUpdateDialogOpen(false)} size="small">Close</Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Send Feedback</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            {['bug', 'feature', 'general'].map(t => (
              <Chip
                key={t}
                label={t === 'bug' ? 'Bug Report' : t === 'feature' ? 'Feature Request' : 'General'}
                size="small"
                onClick={() => setFeedbackType(t)}
                sx={{
                  background: feedbackType === t ? alpha(BRAND.primary, 0.2) : alpha(BRAND.bgSurface, 0.5),
                  border: feedbackType === t ? `1px solid ${BRAND.primary}` : `1px solid ${BRAND.border}`,
                  color: feedbackType === t ? BRAND.primaryLight : BRAND.textSecondary,
                  fontWeight: feedbackType === t ? 600 : 400,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="Tell us what's on your mind..."
            value={feedbackMsg}
            onChange={(e) => setFeedbackMsg(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.9rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackOpen(false)} size="small">Cancel</Button>
          <Button onClick={handleSubmitFeedback} variant="contained" size="small" disabled={!feedbackMsg.trim()}>
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={!!feedbackSnack}
        autoHideDuration={3000}
        onClose={() => setFeedbackSnack('')}
        message={feedbackSnack}
      />

      {/* Quick Purchase Dialog */}
      <Dialog
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        PaperProps={{ sx: { background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, minWidth: 360 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {creditBalance?.plan === 'trial' ? 'Free Trial' : 'Ace Credits'}
        </DialogTitle>
        <DialogContent>
          {creditBalance?.plan === 'trial' && creditBalance.trialDaysLeft > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {creditBalance.trialDaysLeft} days remaining in your free trial. Full access to all tools.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={async () => {
                  try {
                    const res = await fetch(`${API}/api/billing/checkout`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mode: 'subscription' }),
                    });
                    const data = await res.json();
                    if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                  } catch {}
                }}
                sx={{ mb: 1 }}
              >
                Subscribe — $15/mo
              </Button>
              <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                1,500 credits/month included. Cancel anytime.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Balance: <strong>{(creditBalance?.total || 0).toLocaleString()} credits</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 2 }}>
                {creditBalance?.subscriptionCredits || 0} subscription + {creditBalance?.purchasedCredits || 0} purchased
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>Top Up</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {[5, 10, 25].map(amt => (
                  <Button
                    key={amt}
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API}/api/billing/checkout`, {
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
              {!creditBalance?.stripeSubscriptionId && (
                <Button
                  variant="contained"
                  fullWidth
                  size="small"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API}/api/billing/checkout`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: 'subscription' }),
                      });
                      const data = await res.json();
                      if (data.success && data.data?.url) window.open(data.data.url, '_blank');
                    } catch {}
                  }}
                  sx={{ mb: 1 }}
                >
                  Subscribe — $15/mo (1,500 credits)
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditModalOpen(false)} size="small">Close</Button>
          <Button onClick={() => { setCreditModalOpen(false); setSelectedPage('settings'); }} size="small">
            Billing Settings
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
