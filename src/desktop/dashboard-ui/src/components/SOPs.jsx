import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, Button, Grid, alpha, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, TextField,
  CircularProgress, Divider, Select, MenuItem, FormControl, InputLabel,
  Collapse, Tooltip, Tabs, Tab, LinearProgress
} from '@mui/material';
import Training from './Training';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import LanguageIcon from '@mui/icons-material/Language';
import MouseIcon from '@mui/icons-material/Mouse';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import TimerIcon from '@mui/icons-material/Timer';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LoginIcon from '@mui/icons-material/Login';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BugReportIcon from '@mui/icons-material/BugReport';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TagIcon from '@mui/icons-material/Tag';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { BRAND } from '../theme';

const STEP_ICONS = {
  navigate: <LanguageIcon sx={{ fontSize: 16 }} />,
  click_text: <MouseIcon sx={{ fontSize: 16 }} />,
  click: <MouseIcon sx={{ fontSize: 16 }} />,
  click_submit: <MouseIcon sx={{ fontSize: 16 }} />,
  type: <KeyboardIcon sx={{ fontSize: 16 }} />,
  wait: <TimerIcon sx={{ fontSize: 16 }} />,
  wait_navigation: <TimerIcon sx={{ fontSize: 16 }} />,
  screenshot: <CameraAltIcon sx={{ fontSize: 16 }} />,
  fill_credentials: <LoginIcon sx={{ fontSize: 16 }} />,
  explore_page: <SearchIcon sx={{ fontSize: 16 }} />,
  copy: <ContentCopyIcon sx={{ fontSize: 16 }} />,
  extract: <ContentCopyIcon sx={{ fontSize: 16 }} />,
  scroll: <NavigateNextIcon sx={{ fontSize: 16, transform: 'rotate(90deg)' }} />,
  edit_field: <EditIcon sx={{ fontSize: 16 }} />,
  set_date: <TimerIcon sx={{ fontSize: 16 }} />,
  smart_click: <MouseIcon sx={{ fontSize: 16 }} />,
  smart_fill: <KeyboardIcon sx={{ fontSize: 16 }} />,
  decide: <AutoAwesomeIcon sx={{ fontSize: 16 }} />,
  extract_text: <ContentCopyIcon sx={{ fontSize: 16 }} />,
  search_google: <SearchIcon sx={{ fontSize: 16 }} />,
  goto: <LanguageIcon sx={{ fontSize: 16 }} />,
};

const STEP_COLORS = {
  navigate: BRAND.info,
  click_text: BRAND.accent,
  click: BRAND.accent,
  click_submit: BRAND.accent,
  type: BRAND.success,
  wait: BRAND.warning,
  wait_navigation: BRAND.warning,
  screenshot: BRAND.secondary,
  fill_credentials: BRAND.error,
  explore_page: BRAND.primaryLight,
  copy: BRAND.secondary,
  extract: BRAND.secondary,
  scroll: BRAND.textSecondary,
  edit_field: BRAND.success,
  set_date: BRAND.warning,
  smart_click: BRAND.accent,
  smart_fill: BRAND.success,
  decide: BRAND.primaryLight,
  extract_text: BRAND.secondary,
  search_google: BRAND.info,
  goto: BRAND.info,
};

const ACTION_OPTIONS = [
  'navigate', 'goto', 'click_text', 'click', 'click_submit', 'type',
  'edit_field', 'set_date', 'smart_click', 'smart_fill',
  'wait', 'wait_navigation', 'screenshot', 'fill_credentials',
  'explore_page', 'copy', 'extract', 'extract_text', 'scroll',
  'decide', 'search_google'
];

/** Live recording panel — shows elapsed time, screenshot counter, and instructions */
function RecordingPanel({ stepNum, startedAt, onDone, onCancel }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const screenshots = Math.floor(elapsed / 2); // backend captures every 2s
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;

  return (
    <Box sx={{
      p: 2, borderRadius: 2,
      background: alpha('#FF4757', 0.06), border: `1px solid ${alpha('#FF4757', 0.2)}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <FiberManualRecordIcon sx={{
          fontSize: 18, color: '#FF4757',
          animation: 'pulse 1.5s ease-in-out infinite',
          '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        }} />
        <Typography sx={{ fontSize: '0.85rem', color: '#FF4757', fontWeight: 700, flex: 1 }}>
          Recording Step {stepNum}
        </Typography>
        <Chip label={timeStr} size="small" sx={{
          fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace',
          background: alpha('#FF4757', 0.12), color: '#FF4757',
        }} />
        <Chip icon={<CameraAltIcon sx={{ fontSize: '12px !important' }} />}
          label={`${screenshots} captured`} size="small" sx={{
          fontSize: '0.7rem', fontWeight: 600,
          background: alpha(BRAND.info, 0.1), color: BRAND.info,
        }} />
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary, mb: 1.5, lineHeight: 1.6 }}>
        Ace is capturing your <strong>full screen</strong> every 2 seconds.
        Switch to the right app/tab and perform the step — clicks, typing, everything is being recorded.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={onDone}
          sx={{ fontSize: '0.75rem', px: 3, background: `${BRAND.success} !important` }}>
          Done Recording
        </Button>
        <Button size="small" onClick={onCancel}
          sx={{ fontSize: '0.75rem', color: BRAND.textMuted }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

function SOPs() {
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [generateDesc, setGenerateDesc] = useState('');
  const [generateName, setGenerateName] = useState('');
  const [generating, setGenerating] = useState(false);

  // Editor state
  const [editingSop, setEditingSop] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', steps: [], triggers: [], category: '', department: '' });
  const [editDirty, setEditDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test run state
  const [testRunDialog, setTestRunDialog] = useState(null);
  const [testRunResult, setTestRunResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);

  // Expand state for SOP cards
  const [expandedSop, setExpandedSop] = useState(null);

  // Top-level tab: 0 = My SOPs, 1 = Teach Ace
  const [sopTab, setSopTab] = useState(0);

  // Learning/health data
  const [learningMap, setLearningMap] = useState({});

  // Show Ace How — per-step recording from editor
  const [recordingStep, setRecordingStep] = useState(null); // { sopId, stepNum, state: 'ready'|'recording'|'saving'|'saved' }

  useEffect(() => { fetchSOPs(); }, []);

  const fetchSOPs = async () => {
    try {
      const res = await fetch('/api/sops');
      const data = await res.json();
      if (data.success) {
        const sopList = data.data || [];
        setSops(sopList);
        // Fetch learning data for each SOP in parallel
        const entries = await Promise.all(sopList.map(async (sop) => {
          try {
            const lr = await fetch(`/api/sops/${sop.id}/learning`);
            const ld = await lr.json();
            return [sop.id, ld.data];
          } catch { return [sop.id, null]; }
        }));
        setLearningMap(Object.fromEntries(entries.filter(([, v]) => v)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getHealthColor = (reliability) => {
    if (reliability >= 0.8) return '#4ade80';
    if (reliability >= 0.5) return '#FFA726';
    return '#FF7675';
  };

  const handleRun = async (sop) => {
    setRunning(sop.id);
    try {
      await fetch(`/api/sops/${sop.id}/run`, { method: 'POST' });
    } catch (e) { console.error(e); }
    finally { setRunning(null); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/sops/${id}`, { method: 'DELETE' });
      setSops(prev => prev.filter(s => s.id !== id));
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  };

  const handleGenerate = async () => {
    if (!generateDesc.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/sops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: generateDesc, name: generateName }),
      });
      const data = await res.json();
      if (data.success) {
        setGenerateDialog(false);
        setGenerateDesc('');
        setGenerateName('');
        fetchSOPs();
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  // ── Editor Handlers ──
  const openEditor = (sop) => {
    setEditingSop(sop.id);
    setEditForm({
      name: sop.name || '',
      description: sop.description || '',
      steps: (sop.steps || []).map(s => ({ ...s })),
      triggers: sop.triggers || sop.triggerPatterns || [],
      category: sop.category || 'general',
      department: sop.department || '',
    });
    setEditDirty(false);
  };

  const closeEditor = () => {
    setEditingSop(null);
    setEditForm({ name: '', description: '', steps: [], triggers: [], category: '', department: '' });
    setEditDirty(false);
  };

  const updateStep = (index, field, value) => {
    setEditForm(prev => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
    setEditDirty(true);
  };

  const addStep = () => {
    setEditForm(prev => ({
      ...prev,
      steps: [...prev.steps, { action: 'click_text', text: '', description: 'New step' }]
    }));
    setEditDirty(true);
  };

  const removeStep = (index) => {
    setEditForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
    setEditDirty(true);
  };

  const moveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editForm.steps.length) return;
    setEditForm(prev => {
      const steps = [...prev.steps];
      [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
      return { ...prev, steps };
    });
    setEditDirty(true);
  };

  const saveEditor = async () => {
    if (!editingSop) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sops/${editingSop}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          steps: editForm.steps,
          triggers: editForm.triggers,
          category: editForm.category,
          department: editForm.department,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditDirty(false);
        fetchSOPs();
        closeEditor();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ── Show Ace How (per-step recording from editor) ──
  const handleShowMeStart = async (sopId, stepNum) => {
    setRecordingStep({ sopId, stepNum, state: 'recording', startedAt: Date.now() });
    try {
      await fetch(`/api/sops/${sopId}/steps/${stepNum}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'recording' }),
      });
    } catch (e) { console.error('Failed to start recording:', e); }
  };

  const handleShowMeDone = async () => {
    if (!recordingStep) return;
    const { sopId, stepNum } = recordingStep;
    setRecordingStep(prev => ({ ...prev, state: 'saving' }));
    try {
      await fetch(`/api/sops/${sopId}/steps/${stepNum}/record-stop`, { method: 'POST' });
      setRecordingStep(prev => ({ ...prev, state: 'saved' }));
      setTimeout(() => setRecordingStep(null), 2500);
      // Refresh learning data
      try {
        const res = await fetch(`/api/sops/${sopId}/learning`);
        const data = await res.json();
        if (data.success) setLearningMap(prev => ({ ...prev, [sopId]: data.data }));
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('Failed to stop recording:', e);
      setRecordingStep(null);
    }
  };

  const handleShowMeCancel = () => {
    if (recordingStep) {
      const { sopId, stepNum } = recordingStep;
      fetch(`/api/sops/${sopId}/steps/${stepNum}/record-stop`, { method: 'POST' }).catch(() => {});
    }
    setRecordingStep(null);
  };

  // ── Test Run ──
  const handleTestRun = async (sop, mode = 'browser') => {
    setTestRunDialog(sop.id);
    setTestRunning(true);
    setTestRunResult(null);
    try {
      const res = await fetch(`/api/sops/${sop.id}/test-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      setTestRunResult(data.data || data);
    } catch (e) {
      setTestRunResult({ success: false, error: e.message });
    }
    finally { setTestRunning(false); }
  };

  const getCategoryColor = (cat) => {
    const map = {
      general: BRAND.primary,
      email: BRAND.info,
      lead_generation: BRAND.success,
      social: BRAND.accent,
      research: BRAND.secondary,
    };
    return map[cat] || BRAND.secondary;
  };

  return (
    <Box sx={{ maxWidth: 1200 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 0,
        background: `linear-gradient(135deg, ${alpha(BRAND.info, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.info, 0.15)}`,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.info}, ${BRAND.primary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.info, 0.3)}`,
          }}>
            <AssignmentIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Playbooks
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Automated workflows Ace can execute • Teach Ace new ones
            </Typography>
          </Box>
          {sopTab === 0 && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => setGenerateDialog(true)}
                sx={{
                  background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary}) !important`,
                  fontSize: '0.8rem',
                }}
              >
                Generate SOP
              </Button>
              <Chip
                label={`${sops.length} SOPs`}
                sx={{
                  fontWeight: 600,
                  background: alpha(BRAND.info, 0.1),
                  color: BRAND.info,
                  border: `1px solid ${alpha(BRAND.info, 0.2)}`,
                }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Tab bar */}
      <Paper sx={{
        borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
        border: `1px solid ${alpha(BRAND.info, 0.15)}`,
        mb: 3,
      }}>
        <Tabs
          value={sopTab}
          onChange={(_, v) => setSopTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { fontSize: '0.875rem', minHeight: 44, textTransform: 'none', fontWeight: 500 },
            '& .Mui-selected': { color: `${BRAND.primary} !important`, fontWeight: 700 },
            '& .MuiTabs-indicator': { backgroundColor: BRAND.primary },
          }}
        >
          <Tab label="My SOPs" />
          <Tab label="Teach Ace" />
        </Tabs>
      </Paper>

      {/* Tab 1 — Teach Ace (Training) */}
      {sopTab === 1 && <Training />}

      {/* Tab 0 — SOP Grid */}
      {sopTab === 0 && (loading ? (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : sops.length > 0 ? (
        <Grid container spacing={2}>
          {sops.map((sop) => {
            const color = getCategoryColor(sop.category);
            const isExpanded = expandedSop === sop.id;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sop.id}>
                <Paper sx={{
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 25px ${alpha(color, 0.12)}`,
                    border: `1px solid ${alpha(color, 0.25)}`,
                  },
                }}
                  onClick={() => setExpandedSop(isExpanded ? null : sop.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                    <Avatar sx={{
                      width: 40, height: 40,
                      background: alpha(color, 0.12),
                      color: color,
                    }}>
                      <AssignmentIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{
                        fontWeight: 600, color: BRAND.textPrimary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {sop.name || sop.id}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        <Chip
                          icon={<FolderIcon sx={{ fontSize: '12px !important' }} />}
                          label={sop.category || 'general'}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.65rem',
                            background: alpha(color, 0.08),
                            color: color,
                            border: `1px solid ${alpha(color, 0.15)}`,
                          }}
                        />
                        {sop.source && (
                          <Chip label={sop.source.replace(/_/g, ' ')} size="small" sx={{
                            height: 22, fontSize: '0.6rem',
                            background: alpha(BRAND.textMuted, 0.08),
                            color: BRAND.textMuted,
                          }} />
                        )}
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); }}>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Box>

                  {sop.description && (
                    <Typography variant="body2" sx={{
                      color: BRAND.textMuted, fontSize: '0.8rem', mb: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {sop.description}
                    </Typography>
                  )}

                  {/* Trigger phrases */}
                  {(sop.triggers || sop.triggerPatterns || []).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                      {(sop.triggers || sop.triggerPatterns || []).slice(0, 3).map((t, i) => (
                        <Chip key={i} icon={<TagIcon sx={{ fontSize: '10px !important' }} />}
                          label={t} size="small" sx={{
                            height: 20, fontSize: '0.6rem',
                            background: alpha(BRAND.primaryLight, 0.08),
                            color: BRAND.primaryLight,
                          }} />
                      ))}
                    </Box>
                  )}

                  {/* Health bar (only if learning data exists) */}
                  {learningMap[sop.id] && (() => {
                    const learn = learningMap[sop.id];
                    const rate = learn.successRate ?? 1;
                    const hColor = getHealthColor(rate);
                    const insights = learn.stepInsights || {};
                    const struggling = Object.values(insights).filter(s => s.reliability < 0.5).length;
                    return (
                      <Box sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LinearProgress variant="determinate" value={rate * 100} sx={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: alpha(BRAND.border, 0.3),
                            '& .MuiLinearProgress-bar': { background: hColor, borderRadius: 2 },
                          }} />
                          <Typography sx={{ fontSize: '0.65rem', color: hColor, fontWeight: 700, flexShrink: 0 }}>
                            {Math.round(rate * 100)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {(sop.steps || []).map((_, si) => {
                            const ins = insights[si + 1];
                            const rel = ins?.reliability ?? 1;
                            return (
                              <Tooltip key={si} title={`Step ${si + 1}: ${Math.round(rel * 100)}%`}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: getHealthColor(rel), opacity: 0.85 }} />
                              </Tooltip>
                            );
                          })}
                        </Box>
                        {struggling > 0 && (
                          <Typography sx={{ fontSize: '0.6rem', color: '#FF7675', mt: 0.3 }}>
                            {struggling} step{struggling !== 1 ? 's' : ''} need help
                          </Typography>
                        )}
                      </Box>
                    );
                  })()}

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
                    {sop.steps && (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                        label={`${sop.steps.length} steps`}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.65rem',
                          background: alpha(BRAND.success, 0.08),
                          color: BRAND.success,
                        }}
                      />
                    )}
                    {sop.department && (
                      <Chip icon={<GroupWorkIcon sx={{ fontSize: '12px !important' }} />}
                        label={sop.department} size="small" sx={{
                          height: 22, fontSize: '0.6rem',
                          background: alpha(BRAND.secondary, 0.08),
                          color: BRAND.secondary,
                        }} />
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Edit SOP">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditor(sop); }}
                        sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.info, background: alpha(BRAND.info, 0.08) } }}>
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setConfirmDelete(sop.id); }}
                        sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error, background: alpha(BRAND.error, 0.08) } }}>
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Button size="small" variant="contained"
                      startIcon={<PlayArrowIcon sx={{ fontSize: '16px !important' }} />}
                      onClick={(e) => { e.stopPropagation(); handleRun(sop); }}
                      disabled={running === sop.id}
                      sx={{
                        fontSize: '0.75rem', px: 2,
                        background: `linear-gradient(135deg, ${color}, ${BRAND.primary}) !important`,
                        '&.Mui-disabled': { opacity: 0.5 },
                      }}
                    >
                      {running === sop.id ? 'Running...' : 'Run'}
                    </Button>
                  </Box>

                  {/* Expanded: Show steps + test run */}
                  <Collapse in={isExpanded}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: BRAND.textSecondary, mb: 1, display: 'block' }}>
                      Steps:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                      {(sop.steps || []).map((step, i) => {
                        const sc = STEP_COLORS[step.action] || BRAND.textMuted;
                        const stepInsight = learningMap[sop.id]?.stepInsights?.[i + 1];
                        const stepRel = stepInsight?.reliability;
                        const hasGuide = !!step.visualGuide;
                        return (
                          <Box key={i} sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            p: 0.8, borderRadius: 1,
                            background: alpha(sc, 0.04),
                            border: `1px solid ${alpha(sc, 0.1)}`,
                            borderLeft: stepRel != null
                              ? `3px solid ${getHealthColor(stepRel)}`
                              : `1px solid ${alpha(sc, 0.1)}`,
                          }}>
                            <Avatar sx={{ width: 22, height: 22, background: alpha(sc, 0.12), color: sc, fontSize: '0.65rem', fontWeight: 700 }}>
                              {i + 1}
                            </Avatar>
                            <Box sx={{ color: sc, display: 'flex', alignItems: 'center' }}>{STEP_ICONS[step.action]}</Box>
                            <Typography variant="caption" sx={{ color: BRAND.textSecondary, flex: 1 }}>
                              {step.description || step.action}
                              {step.url && <span style={{ color: BRAND.info }}> → {step.url}</span>}
                              {step.text && <span style={{ color: BRAND.success }}> "{step.text}"</span>}
                            </Typography>
                            {hasGuide && (
                              <Tooltip title="Visual guide recorded">
                                <CameraAltIcon sx={{ fontSize: 14, color: BRAND.secondary, opacity: 0.7 }} />
                              </Tooltip>
                            )}
                            {stepRel != null && (
                              <Chip label={`${Math.round(stepRel * 100)}%`} size="small" sx={{
                                height: 18, fontSize: '0.55rem', fontWeight: 700,
                                background: alpha(getHealthColor(stepRel), 0.12),
                                color: getHealthColor(stepRel),
                                border: 'none', minWidth: 36,
                              }} />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" startIcon={<BugReportIcon sx={{ fontSize: 14 }} />}
                        onClick={(e) => { e.stopPropagation(); handleTestRun(sop, 'browser'); }}
                        sx={{ fontSize: '0.7rem', borderColor: alpha(BRAND.info, 0.3), color: BRAND.info }}>
                        Test (Browser)
                      </Button>
                      <Button size="small" variant="outlined" startIcon={<DesktopWindowsIcon sx={{ fontSize: 14 }} />}
                        onClick={(e) => { e.stopPropagation(); handleTestRun(sop, 'desktop'); }}
                        sx={{ fontSize: '0.7rem', borderColor: alpha(BRAND.secondary, 0.3), color: BRAND.secondary }}>
                        Test (Desktop)
                      </Button>
                    </Box>
                  </Collapse>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, maxWidth: 520, mx: 'auto' }}>
          <AssignmentIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 2, display: 'block', mx: 'auto' }} />
          <Typography variant="h6" sx={{ color: BRAND.textSecondary, mb: 1, textAlign: 'center' }}>
            No Playbooks Yet
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2, textAlign: 'center' }}>
            Teach Ace your processes so it can follow them step-by-step.
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5 }}>
              <strong>1.</strong> In chat, say: <em>"Let me teach you how to [task]"</em>
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5 }}>
              <strong>2.</strong> Describe the steps in plain English
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 2 }}>
              <strong>3.</strong> Ace saves it as a playbook and follows your process next time
            </Typography>
          </Box>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, p: 1.5 }}>
            <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
              <strong>Example:</strong> "Let me teach you how to repost our meetup on Eventbrite"
              <br />→ Ace asks you to walk through the steps → Saves as a playbook you can run anytime
            </Typography>
          </Box>
        </Paper>
      ))}

      {/* ═══ Delete Confirmation Dialog ═══ */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Delete SOP
          <IconButton size="small" onClick={() => setConfirmDelete(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this SOP? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button onClick={() => handleDelete(confirmDelete)} sx={{ color: BRAND.error }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Generate SOP Dialog ═══ */}
      <Dialog open={generateDialog} onClose={() => !generating && setGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: BRAND.accent }} />
            Generate SOP from Description
          </Box>
          <IconButton size="small" onClick={() => !generating && setGenerateDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
            Describe a browser workflow in plain English and Ace will create a replayable SOP.
          </Typography>
          <TextField label="SOP Name (optional)" placeholder="e.g., Login to LinkedIn"
            value={generateName} onChange={(e) => setGenerateName(e.target.value)} fullWidth disabled={generating} />
          <TextField label="Describe the workflow"
            placeholder="Go to linkedin.com, log in with my saved credentials, navigate to search..."
            value={generateDesc} onChange={(e) => setGenerateDesc(e.target.value)}
            fullWidth multiline rows={5} disabled={generating} />
          {generating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <CircularProgress size={20} sx={{ color: BRAND.accent }} />
              <Typography variant="body2" sx={{ color: BRAND.accent }}>AI is generating your SOP...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialog(false)} disabled={generating}>Cancel</Button>
          <Button variant="contained" onClick={handleGenerate}
            disabled={!generateDesc.trim() || generating}
            startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
            sx={{ background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary}) !important`, '&.Mui-disabled': { opacity: 0.5 } }}>
            {generating ? 'Generating...' : 'Generate SOP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ SOP Editor Dialog ═══ */}
      <Dialog open={!!editingSop} onClose={closeEditor} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ color: BRAND.info }} />
            Edit SOP
          </Box>
          <IconButton size="small" onClick={closeEditor}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {/* Recording panel */}
          {recordingStep?.sopId === editingSop && recordingStep.state === 'recording' && (
            <RecordingPanel stepNum={recordingStep.stepNum} startedAt={recordingStep.startedAt}
              onDone={handleShowMeDone} onCancel={handleShowMeCancel} />
          )}
          {recordingStep?.sopId === editingSop && recordingStep.state === 'saving' && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
              background: alpha(BRAND.accent, 0.08), border: `1px solid ${alpha(BRAND.accent, 0.2)}`,
            }}>
              <CircularProgress size={18} sx={{ color: BRAND.accent }} />
              <Typography sx={{ fontSize: '0.8rem', color: BRAND.accent, fontWeight: 600 }}>
                Analyzing your demonstration...
              </Typography>
            </Box>
          )}
          {recordingStep?.sopId === editingSop && recordingStep.state === 'saved' && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2,
              background: alpha(BRAND.success, 0.08), border: `1px solid ${alpha(BRAND.success, 0.2)}`,
            }}>
              <CheckCircleIcon sx={{ fontSize: 18, color: BRAND.success }} />
              <Typography sx={{ fontSize: '0.8rem', color: BRAND.success, fontWeight: 600 }}>
                Got it! Ace will use this next time.
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Name" value={editForm.name} fullWidth
                onChange={(e) => { setEditForm(p => ({ ...p, name: e.target.value })); setEditDirty(true); }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={editForm.category} label="Category"
                  onChange={(e) => { setEditForm(p => ({ ...p, category: e.target.value })); setEditDirty(true); }}>
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="social">Social</MenuItem>
                  <MenuItem value="lead_generation">Lead Gen</MenuItem>
                  <MenuItem value="research">Research</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select value={editForm.department} label="Department"
                  onChange={(e) => { setEditForm(p => ({ ...p, department: e.target.value })); setEditDirty(true); }}>
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="CEO">CEO</MenuItem>
                  <MenuItem value="CTO">CTO</MenuItem>
                  <MenuItem value="CMO">CMO</MenuItem>
                  <MenuItem value="COO">COO</MenuItem>
                  <MenuItem value="EA">Executive Assistant</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField label="Description" value={editForm.description} fullWidth multiline rows={2}
            onChange={(e) => { setEditForm(p => ({ ...p, description: e.target.value })); setEditDirty(true); }} />

          {/* Trigger Phrases */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: BRAND.textSecondary, mb: 0.5, display: 'block' }}>
              Trigger Phrases (what activates this SOP when said to Ace)
            </Typography>
            <TextField
              placeholder="Enter trigger phrases separated by commas"
              value={(editForm.triggers || []).join(', ')}
              fullWidth size="small"
              onChange={(e) => {
                const triggers = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                setEditForm(p => ({ ...p, triggers }));
                setEditDirty(true);
              }}
              InputProps={{ startAdornment: <TagIcon sx={{ mr: 1, color: BRAND.textMuted, fontSize: 18 }} /> }}
            />
          </Box>

          <Divider />

          {/* Steps Editor */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Steps ({editForm.steps.length})
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addStep}
              sx={{ color: BRAND.success, fontSize: '0.75rem' }}>
              Add Step
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 400, overflowY: 'auto' }}>
            {editForm.steps.map((step, i) => {
              const sc = STEP_COLORS[step.action] || BRAND.textMuted;
              return (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1,
                  p: 1.5, borderRadius: 2,
                  border: `1px solid ${alpha(sc, 0.15)}`,
                  background: alpha(sc, 0.03),
                }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3, pt: 0.5 }}>
                    <IconButton size="small" onClick={() => moveStep(i, -1)} disabled={i === 0}
                      sx={{ p: 0.3, color: BRAND.textMuted }}>
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: sc }}>{i + 1}</Typography>
                    <IconButton size="small" onClick={() => moveStep(i, 1)} disabled={i === editForm.steps.length - 1}
                      sx={{ p: 0.3, color: BRAND.textMuted }}>
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <Select value={step.action} onChange={(e) => updateStep(i, 'action', e.target.value)}>
                          {ACTION_OPTIONS.map(a => (
                            <MenuItem key={a} value={a}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {STEP_ICONS[a]} {a}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField size="small" placeholder="Description" value={step.description || ''}
                        onChange={(e) => updateStep(i, 'description', e.target.value)}
                        sx={{ flex: 1 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {(step.action === 'navigate') && (
                        <TextField size="small" placeholder="URL" value={step.url || ''}
                          onChange={(e) => updateStep(i, 'url', e.target.value)} sx={{ flex: 1 }} />
                      )}
                      {(step.action === 'click_text' || step.action === 'type') && (
                        <TextField size="small" placeholder="Text" value={step.text || ''}
                          onChange={(e) => updateStep(i, 'text', e.target.value)} sx={{ flex: 1 }} />
                      )}
                      {(step.action === 'wait') && (
                        <TextField size="small" placeholder="ms" type="number" value={step.ms || ''}
                          onChange={(e) => updateStep(i, 'ms', parseInt(e.target.value) || 0)} sx={{ width: 120 }} />
                      )}
                      {(step.action === 'fill_credentials') && (
                        <TextField size="small" placeholder="Credential ID" value={step.credentialId || ''}
                          onChange={(e) => updateStep(i, 'credentialId', e.target.value)} sx={{ flex: 1 }} />
                      )}
                      {(step.action === 'copy' || step.action === 'extract') && (
                        <TextField size="small" placeholder="Target" value={step.target || ''}
                          onChange={(e) => updateStep(i, 'target', e.target.value)} sx={{ flex: 1 }} />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
                    {/* Show Ace How button */}
                    {recordingStep?.sopId === editingSop && recordingStep?.stepNum === i + 1 ? (
                      // Recording/saving/saved states
                      recordingStep.state === 'saving' ? (
                        <CircularProgress size={16} sx={{ color: BRAND.accent }} />
                      ) : recordingStep.state === 'saved' ? (
                        <Tooltip title="Got it!">
                          <CheckCircleIcon sx={{ fontSize: 18, color: BRAND.success }} />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Recording... click when done">
                          <IconButton size="small" onClick={handleShowMeDone}
                            sx={{
                              p: 0.3, color: '#FF4757',
                              animation: 'pulse 1.5s ease-in-out infinite',
                              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                            }}>
                            <FiberManualRecordIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )
                    ) : (
                      <Tooltip title="Show Ace How — record this step">
                        <IconButton size="small"
                          onClick={() => handleShowMeStart(editingSop, i + 1)}
                          disabled={!!recordingStep}
                          sx={{
                            p: 0.3, color: BRAND.textMuted,
                            '&:hover': { color: BRAND.accent, background: alpha(BRAND.accent, 0.08) },
                          }}>
                          <VideocamIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {/* Delete button */}
                    <IconButton size="small" onClick={() => removeStep(i)}
                      sx={{ p: 0.3, color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor}>Cancel</Button>
          <Button variant="contained" onClick={saveEditor} disabled={!editDirty || saving}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
            sx={{ background: `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondaryLight}) !important`, '&.Mui-disabled': { opacity: 0.5 } }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Test Run Dialog ═══ */}
      <Dialog open={!!testRunDialog} onClose={() => { setTestRunDialog(null); setTestRunResult(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReportIcon sx={{ color: BRAND.warning }} />
            Test Run Results
          </Box>
          <IconButton size="small" onClick={() => { setTestRunDialog(null); setTestRunResult(null); }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {testRunning ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={40} sx={{ color: BRAND.accent, mb: 2 }} />
              <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                Executing SOP... This may take a while.
              </Typography>
            </Box>
          ) : testRunResult ? (
            <Box>
              <Box sx={{
                p: 2, borderRadius: 2, mb: 2,
                background: testRunResult.success ? alpha(BRAND.success, 0.08) : alpha(BRAND.error, 0.08),
                border: `1px solid ${testRunResult.success ? alpha(BRAND.success, 0.2) : alpha(BRAND.error, 0.2)}`,
              }}>
                <Typography variant="body1" sx={{
                  fontWeight: 600,
                  color: testRunResult.success ? BRAND.success : BRAND.error,
                }}>
                  {testRunResult.success ? '✅ SOP completed successfully!' : `❌ SOP failed: ${testRunResult.error}`}
                </Typography>
                {testRunResult.duration && (
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                    Duration: {(testRunResult.duration / 1000).toFixed(1)}s •
                    Steps: {testRunResult.stepsCompleted}/{testRunResult.totalSteps} •
                    Mode: {testRunResult.mode || 'browser'}
                  </Typography>
                )}
              </Box>

              {testRunResult.log && testRunResult.log.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: BRAND.textSecondary }}>
                    Step Log:
                  </Typography>
                  {testRunResult.log.map((entry, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      p: 0.8, borderRadius: 1,
                      background: entry.success ? alpha(BRAND.success, 0.04) : alpha(BRAND.error, 0.04),
                    }}>
                      <Typography variant="caption" sx={{
                        color: entry.success ? BRAND.success : BRAND.error,
                        fontWeight: 600,
                      }}>
                        {entry.success ? '✓' : '✗'} Step {entry.step}
                      </Typography>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted, flex: 1 }}>
                        {entry.description || entry.action}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTestRunDialog(null); setTestRunResult(null); }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SOPs;
