import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Dialog, DialogContent, IconButton, TextField, Button,
  alpha, Chip, CircularProgress, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { BRAND } from '../theme';

// ═══ NewProcessDialog — Single entry point for creating SOPs ═══

export default function NewProcessDialog({ open, onClose, onCreated }) {
  // Shared state
  const [name, setName] = useState('');
  const [triggers, setTriggers] = useState('');
  const [mode, setMode] = useState(null); // null | 'type' | 'record' | 'generate'

  // Type Steps state
  const [steps, setSteps] = useState([{ text: '' }]);
  const [phase, setPhase] = useState('building'); // building | saving | reviewing | done | error
  const [parsedSteps, setParsedSteps] = useState([]);
  const [qualityResult, setQualityResult] = useState(null);
  const [savedSop, setSavedSop] = useState(null);
  const [error, setError] = useState(null);
  const [lastEditedIdx, setLastEditedIdx] = useState(-1);
  const [showVarInput, setShowVarInput] = useState(false);
  const [varName, setVarName] = useState('');
  const stepRefs = useRef([]);
  const [focusIdx, setFocusIdx] = useState(-1);

  // Record Screen state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState([]);
  const [recordingError, setRecordingError] = useState(null);

  // Generate state
  const [generateText, setGenerateText] = useState('');
  const [generating, setGenerating] = useState(false);

  // Auto-focus new step
  useEffect(() => {
    if (focusIdx >= 0 && stepRefs.current[focusIdx]) {
      stepRefs.current[focusIdx].focus();
      setFocusIdx(-1);
    }
  }, [focusIdx, steps.length]);

  // SSE listener for recording steps
  useEffect(() => {
    if (!isRecording) return;
    const es = new EventSource('/api/events/stream');
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'desktop:train:step' && data.data) {
          setRecordingSteps(prev => {
            const step = {
              type: data.data.type,
              x: data.data.x,
              y: data.data.y,
              key: data.data.key,
              direction: data.data.direction,
              stepNumber: data.data.stepNumber || prev.length + 1,
            };
            const updated = [...prev, step];
            return updated.length > 20 ? updated.slice(-20) : updated;
          });
        }
      } catch {}
    };
    return () => es.close();
  }, [isRecording]);

  const reset = () => {
    setName('');
    setTriggers('');
    setMode(null);
    setSteps([{ text: '' }]);
    setPhase('building');
    setParsedSteps([]);
    setQualityResult(null);
    setSavedSop(null);
    setError(null);
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingError(null);
    setGenerateText('');
    setGenerating(false);
    setLastEditedIdx(-1);
    setShowVarInput(false);
    setVarName('');
  };

  const handleClose = () => {
    if (isRecording) return; // Don't close while recording
    reset();
    onClose();
  };

  const handleSuccess = (sop) => {
    setSavedSop(sop);
    setPhase('done');
    if (onCreated) onCreated(sop);
  };

  // ── Type Steps handlers ──
  const updateStep = (idx, text) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, text } : s));
  };

  const removeStep = (idx) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const addStepAfter = (idx) => {
    setSteps(prev => {
      const n = [...prev];
      n.splice(idx + 1, 0, { text: '' });
      return n;
    });
    setFocusIdx(idx + 1);
  };

  const handleStepKeyDown = (e, idx) => {
    if (e.key === 'Enter' && steps[idx].text?.trim()) {
      e.preventDefault();
      addStepAfter(idx);
    }
    if (e.key === 'Backspace' && !steps[idx].text && steps.length > 1) {
      e.preventDefault();
      removeStep(idx);
      setFocusIdx(Math.max(0, idx - 1));
    }
  };

  const handlePreview = async () => {
    setPhase('saving');
    setError(null);
    try {
      const stepTexts = steps.filter(s => s.text?.trim()).map(s => s.text.trim());
      const resp = await fetch('/api/training/guided-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: stepTexts }),
      });
      const data = await resp.json();
      if (data.success) {
        setParsedSteps(data.data.parsedSteps);
        setQualityResult(data.data.qualityResult);
        setPhase('reviewing');
      } else {
        setError(data.error || 'Preview failed');
        setPhase('building');
      }
    } catch (e) {
      setError(e.message);
      setPhase('building');
    }
  };

  const handleSaveTyped = async () => {
    setPhase('saving');
    setError(null);
    try {
      const stepTexts = steps.filter(s => s.text?.trim()).map(s => s.text.trim());
      const triggerList = triggers.split(',').map(t => t.trim()).filter(Boolean);
      const resp = await fetch('/api/training/guided-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, triggers: triggerList, steps: stepTexts }),
      });
      const data = await resp.json();
      if (data.success) {
        handleSuccess(data.data);
      } else {
        setError(data.error || 'Save failed');
        setPhase('reviewing');
      }
    } catch (e) {
      setError(e.message);
      setPhase('reviewing');
    }
  };

  // ── Record Screen handlers ──
  const handleStartRecording = async () => {
    setRecordingError(null);
    setRecordingSteps([]);
    try {
      const resp = await fetch('/api/training/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: name }),
      });
      const data = await resp.json();
      if (data.success) {
        setIsRecording(true);
      } else {
        setRecordingError(data.error || 'Could not start recording');
      }
    } catch (e) {
      setRecordingError(e.message);
    }
  };

  const handleStopRecording = async () => {
    try {
      const resp = await fetch('/api/training/stop-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: `Desktop recording: ${name}`, category: 'custom' }),
      });
      const data = await resp.json();
      setIsRecording(false);
      setRecordingSteps([]);
      if (data.success && data.data?.sop) {
        handleSuccess(data.data.sop);
      } else {
        setRecordingError(data.data?.error || data.error || 'Recording produced no steps. Try again with more actions.');
      }
    } catch (e) {
      setIsRecording(false);
      setRecordingError(e.message);
    }
  };

  // ── Generate handler ──
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const resp = await fetch('/api/sops/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: generateText, name }),
      });
      const data = await resp.json();
      if (data.success) {
        handleSuccess(data.data || data.sop);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Shared styles ──
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: '0.85rem', borderRadius: '10px',
      background: alpha(BRAND.bgSurface, 0.5),
      '& fieldset': { borderColor: alpha(BRAND.border, 0.5) },
      '&:hover fieldset': { borderColor: alpha(BRAND.primary, 0.4) },
      '&.Mui-focused fieldset': { borderColor: BRAND.primary },
    },
    '& .MuiOutlinedInput-input': { color: BRAND.textPrimary },
  };

  const btnPrimary = {
    fontSize: '0.8rem', textTransform: 'none', borderRadius: '10px',
    background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})`,
    color: '#fff', px: 3, fontWeight: 600,
    '&:hover': { background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})` },
    '&.Mui-disabled': { opacity: 0.4, color: '#fff' },
  };

  // ═══ RENDER ═══

  // ── Done state ──
  if (phase === 'done' && savedSop) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${alpha(BRAND.success, 0.3)}` } }}>
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <CheckCircleIcon sx={{ fontSize: 56, color: BRAND.success, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Process Saved!</Typography>
          <Typography sx={{ color: BRAND.textSecondary, mb: 1 }}>
            <strong>"{savedSop.name || name}"</strong> is ready with {savedSop.steps?.length || '?'} steps.
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
            Say "{savedSop.triggers?.[0] || name}" in chat to run it, or click Run from the Processes page.
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Button onClick={handleClose} sx={btnPrimary}>Done</Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Mode not yet selected: show name + method picker ──
  if (!mode) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${alpha(BRAND.border, 0.5)}` } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Create a New Process</Typography>
          <IconButton onClick={handleClose} size="small"><CloseIcon sx={{ color: BRAND.textMuted }} /></IconButton>
        </Box>
        <DialogContent sx={{ pt: 2 }}>
          {/* Name */}
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary, mb: 0.5 }}>Process name</Typography>
          <TextField
            fullWidth size="small" autoFocus
            placeholder='e.g., "Post on Instagram", "Search for leads"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ ...inputSx, mb: 2 }}
          />

          {/* Triggers */}
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary, mb: 0.5 }}>
            Trigger phrases <span style={{ color: BRAND.textMuted }}>(optional, comma-separated)</span>
          </Typography>
          <TextField
            fullWidth size="small"
            placeholder='e.g., "post on insta", "share on instagram"'
            value={triggers}
            onChange={(e) => setTriggers(e.target.value)}
            sx={{ ...inputSx, mb: 3 }}
          />

          {/* Method picker */}
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary, mb: 1.5, fontWeight: 600 }}>
            How do you want to teach Ace?
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* Type Steps */}
            <Box
              onClick={() => name.trim() && setMode('type')}
              sx={{
                flex: 1, p: 2.5, borderRadius: 3, cursor: name.trim() ? 'pointer' : 'default',
                border: `1.5px solid ${alpha(BRAND.primary, 0.3)}`,
                background: alpha(BRAND.primary, 0.06),
                opacity: name.trim() ? 1 : 0.4,
                transition: 'all 0.2s',
                '&:hover': name.trim() ? {
                  borderColor: BRAND.primary,
                  background: alpha(BRAND.primary, 0.12),
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 20px ${alpha(BRAND.primary, 0.2)}`,
                } : {},
              }}
            >
              <EditNoteIcon sx={{ fontSize: 32, color: BRAND.primary, mb: 1 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Type Steps</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary }}>
                Describe each step in plain English
              </Typography>
            </Box>

            {/* Record Screen */}
            <Box
              onClick={() => name.trim() && setMode('record')}
              sx={{
                flex: 1, p: 2.5, borderRadius: 3, cursor: name.trim() ? 'pointer' : 'default',
                border: `1.5px solid ${alpha(BRAND.accent, 0.3)}`,
                background: alpha(BRAND.accent, 0.06),
                opacity: name.trim() ? 1 : 0.4,
                transition: 'all 0.2s',
                '&:hover': name.trim() ? {
                  borderColor: BRAND.accent,
                  background: alpha(BRAND.accent, 0.12),
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 20px ${alpha(BRAND.accent, 0.2)}`,
                } : {},
              }}
            >
              <ScreenshotMonitorIcon sx={{ fontSize: 32, color: BRAND.accent, mb: 1 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Record Screen</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary }}>
                Show Ace by doing it on your screen
              </Typography>
            </Box>
          </Box>

          {/* Generate link */}
          <Divider sx={{ my: 2, borderColor: alpha(BRAND.border, 0.3) }}>
            <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted }}>OR</Typography>
          </Divider>
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              onClick={() => name.trim() && setMode('generate')}
              sx={{
                fontSize: '0.8rem', color: name.trim() ? BRAND.info : BRAND.textMuted,
                cursor: name.trim() ? 'pointer' : 'default',
                '&:hover': name.trim() ? { textDecoration: 'underline' } : {},
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              Let Ace generate it from a description
            </Typography>
          </Box>

          {!name.trim() && (
            <Typography sx={{ fontSize: '0.75rem', color: BRAND.warning, mt: 2, textAlign: 'center' }}>
              Enter a process name above to continue
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ── Type Steps mode ──
  if (mode === 'type') {
    const nonEmptyCount = steps.filter(s => s.text?.trim()).length;

    // Reviewing phase
    if (phase === 'reviewing') {
      const stepScores = qualityResult?.stepScores || [];
      return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${alpha(BRAND.border, 0.5)}` } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Review: {name}</Typography>
              {qualityResult && (
                <Chip label={`Quality: ${qualityResult.overallScore}%`} size="small" sx={{
                  height: 22, fontSize: '0.7rem', fontWeight: 600,
                  background: alpha(qualityResult.overallScore >= 70 ? BRAND.success : qualityResult.overallScore >= 40 ? BRAND.warning : BRAND.error, 0.15),
                  color: qualityResult.overallScore >= 70 ? BRAND.success : qualityResult.overallScore >= 40 ? BRAND.warning : BRAND.error,
                }} />
              )}
            </Box>
            <IconButton onClick={handleClose} size="small"><CloseIcon sx={{ color: BRAND.textMuted }} /></IconButton>
          </Box>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {(parsedSteps || []).map((step, idx) => {
                const scoreData = stepScores[idx] || {};
                const isWeak = scoreData.score < 50;
                const stepColor = scoreData.score >= 70 ? BRAND.success : scoreData.score >= 40 ? BRAND.warning : BRAND.error;
                return (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, bgcolor: alpha(stepColor, 0.05) }}>
                    {isWeak ? <ErrorOutlineIcon sx={{ fontSize: 18, color: BRAND.warning }} /> : <CheckCircleIcon sx={{ fontSize: 18, color: BRAND.success }} />}
                    <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, flex: 1 }}>
                      {step.description || `${step.action}: ${step.target || step.text || step.url || step.key || ''}`}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: stepColor, fontWeight: 600 }}>{scoreData.score}/100</Typography>
                  </Box>
                );
              })}
            </Box>
            {error && <Typography sx={{ fontSize: '0.8rem', color: BRAND.error, mb: 2 }}>{error}</Typography>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button size="small" onClick={() => { setPhase('building'); setError(null); }}
                startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
                sx={{ fontSize: '0.8rem', textTransform: 'none', color: BRAND.textMuted }}>
                Edit Steps
              </Button>
              <Button size="small" onClick={handleSaveTyped} disabled={phase === 'saving'} sx={btnPrimary}>
                {phase === 'saving' ? <CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} /> : null}
                Save Process
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      );
    }

    // Building phase (step builder)
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${alpha(BRAND.border, 0.5)}` } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => { setMode(null); setPhase('building'); }}
              sx={{ color: BRAND.textMuted }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{name}</Typography>
            <Chip label="Type Steps" size="small" sx={{ height: 22, fontSize: '0.65rem', background: alpha(BRAND.primary, 0.15), color: BRAND.primary }} />
          </Box>
          <IconButton onClick={handleClose} size="small"><CloseIcon sx={{ color: BRAND.textMuted }} /></IconButton>
        </Box>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary, mb: 2 }}>
            Describe each step in plain English. Press <strong>Enter</strong> after each step.
          </Typography>

          {/* Step rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {steps.map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.text?.trim() ? alpha(BRAND.primary, 0.2) : alpha(BRAND.border, 0.3),
                  border: `1px solid ${step.text?.trim() ? alpha(BRAND.primary, 0.3) : alpha(BRAND.border, 0.3)}`,
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: step.text?.trim() ? BRAND.primary : BRAND.textMuted }}>
                    {idx + 1}
                  </Typography>
                </Box>
                <TextField
                  fullWidth size="small"
                  placeholder={idx === 0 ? 'e.g., Go to https://google.com' : idx === 1 ? 'e.g., Type {{search_query}} in search field' : 'Next step...'}
                  value={step.text || ''}
                  onChange={(e) => { updateStep(idx, e.target.value); setLastEditedIdx(idx); }}
                  onKeyDown={(e) => handleStepKeyDown(e, idx)}
                  onFocus={() => setLastEditedIdx(idx)}
                  inputRef={(el) => { stepRefs.current[idx] = el; }}
                  autoFocus={idx === 0 && steps.length === 1}
                  sx={inputSx}
                />
                {steps.length > 1 && (
                  <IconButton size="small" onClick={() => removeStep(idx)}
                    sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: BRAND.error } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>

          {/* Add step */}
          <Button size="small" onClick={() => addStepAfter(steps.length - 1)}
            sx={{ fontSize: '0.75rem', textTransform: 'none', color: BRAND.primary, mb: 2, '&:hover': { background: alpha(BRAND.primary, 0.08) } }}>
            + Add step
          </Button>

          {/* Variable blanks */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 0.75 }}>
              If part of a step changes each time, insert a variable:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              {[
                { label: 'city / location', key: 'city' },
                { label: 'name', key: 'name' },
                { label: 'date', key: 'date' },
                { label: 'text to type', key: 'content' },
              ].map(v => (
                <Chip
                  key={v.key}
                  label={`{{${v.key}}}`}
                  size="small"
                  onClick={() => {
                    const targetIdx = lastEditedIdx >= 0 ? lastEditedIdx : steps.length - 1;
                    const current = steps[targetIdx]?.text || '';
                    updateStep(targetIdx, current ? `${current} {{${v.key}}}` : `{{${v.key}}}`);
                    setFocusIdx(targetIdx);
                  }}
                  sx={{
                    height: 24, fontSize: '0.7rem', cursor: 'pointer',
                    background: alpha(BRAND.info, 0.08),
                    border: `1px dashed ${alpha(BRAND.info, 0.3)}`,
                    color: BRAND.info,
                    '&:hover': { background: alpha(BRAND.info, 0.18), borderStyle: 'solid' },
                  }}
                />
              ))}
              {!showVarInput ? (
                <Chip label="+ custom" size="small" onClick={() => setShowVarInput(true)}
                  sx={{
                    height: 24, fontSize: '0.7rem', cursor: 'pointer',
                    background: 'transparent', border: `1px dashed ${alpha(BRAND.textMuted, 0.3)}`,
                    color: BRAND.textMuted, '&:hover': { background: alpha(BRAND.textMuted, 0.08) },
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField size="small" autoFocus placeholder="e.g., company"
                    value={varName}
                    onChange={(e) => setVarName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && varName.trim()) {
                        const targetIdx = lastEditedIdx >= 0 ? lastEditedIdx : steps.length - 1;
                        const current = steps[targetIdx]?.text || '';
                        updateStep(targetIdx, current ? `${current} {{${varName.trim()}}}` : `{{${varName.trim()}}}`);
                        setFocusIdx(targetIdx);
                        setVarName('');
                        setShowVarInput(false);
                      }
                      if (e.key === 'Escape') { setVarName(''); setShowVarInput(false); }
                    }}
                    sx={{ width: 120, '& .MuiOutlinedInput-root': { fontSize: '0.7rem', borderRadius: '6px', height: 26 } }}
                  />
                  <Typography onClick={() => { setVarName(''); setShowVarInput(false); }}
                    sx={{ fontSize: '0.65rem', color: BRAND.textMuted, cursor: 'pointer' }}>cancel</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {error && <Typography sx={{ fontSize: '0.8rem', color: BRAND.error, mb: 2 }}>{error}</Typography>}

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" disabled={nonEmptyCount < 2 || phase === 'saving'} onClick={handlePreview} sx={btnPrimary}>
              {phase === 'saving' ? <CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} /> : null}
              Preview & Save
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Record Screen mode ──
  if (mode === 'record') {
    return (
      <Dialog open={open} onClose={isRecording ? undefined : handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${isRecording ? alpha('#f44336', 0.4) : alpha(BRAND.border, 0.5)}` } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!isRecording && (
              <IconButton size="small" onClick={() => setMode(null)} sx={{ color: BRAND.textMuted }}>
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{name}</Typography>
            <Chip label="Record Screen" size="small" sx={{ height: 22, fontSize: '0.65rem', background: alpha(BRAND.accent, 0.15), color: BRAND.accent }} />
          </Box>
          {!isRecording && <IconButton onClick={handleClose} size="small"><CloseIcon sx={{ color: BRAND.textMuted }} /></IconButton>}
        </Box>
        <DialogContent>
          {!isRecording ? (
            <>
              <Typography sx={{ fontSize: '0.85rem', color: BRAND.textSecondary, mb: 2 }}>
                Click <strong>Start Recording</strong>, then perform the process on your screen. Ace will capture every click and keystroke.
              </Typography>
              {recordingError && (
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.error, mb: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(BRAND.error, 0.08) }}>
                  {recordingError}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button onClick={handleStartRecording} sx={{
                  ...btnPrimary,
                  background: `linear-gradient(135deg, ${BRAND.accent}, #E84393)`,
                  px: 4, py: 1.2, fontSize: '0.9rem',
                  '&:hover': { background: `linear-gradient(135deg, #E84393, ${BRAND.accent})` },
                }}>
                  <FiberManualRecordIcon sx={{ fontSize: 16, mr: 1 }} />
                  Start Recording
                </Button>
              </Box>
            </>
          ) : (
            <>
              {/* Recording in progress */}
              <Box sx={{
                p: 2, mb: 2, borderRadius: 2,
                border: `1px solid ${alpha('#f44336', 0.3)}`,
                background: alpha('#f44336', 0.06),
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{
                    width: 12, height: 12, borderRadius: '50%', bgcolor: '#f44336',
                    animation: 'recPulse 1.5s ease-in-out infinite',
                    '@keyframes recPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
                  }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#f44336', fontWeight: 600 }}>
                    Recording... {recordingSteps.length} step{recordingSteps.length !== 1 ? 's' : ''} captured
                  </Typography>
                </Box>

                {/* Live step feed */}
                {recordingSteps.length > 0 && (
                  <Box sx={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {recordingSteps.slice(-8).map((step, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Chip
                          label={step.type === 'click' ? 'Click' : step.type === 'key' ? 'Key' : step.type === 'scroll' ? 'Scroll' : step.type}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.7rem', fontWeight: 600,
                            bgcolor: step.type === 'click' ? alpha('#2196f3', 0.15) : step.type === 'key' ? alpha('#4caf50', 0.15) : alpha('#9e9e9e', 0.15),
                            color: step.type === 'click' ? '#2196f3' : step.type === 'key' ? '#4caf50' : '#9e9e9e',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary, fontFamily: 'monospace' }}>
                          {step.type === 'click' ? `(${step.x}, ${step.y})` :
                           step.type === 'key' ? (step.key || '?') :
                           step.type === 'scroll' ? (step.direction || 'down') : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, mb: 2, textAlign: 'center' }}>
                Perform your process now. Click <strong>Stop</strong> when done.
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button onClick={handleStopRecording} sx={{
                  ...btnPrimary,
                  background: 'linear-gradient(135deg, #f44336, #d32f2f)',
                  px: 4, py: 1.2, fontSize: '0.9rem',
                  '&:hover': { background: 'linear-gradient(135deg, #d32f2f, #b71c1c)' },
                }}>
                  <StopCircleIcon sx={{ fontSize: 18, mr: 1 }} />
                  Stop & Save
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ── Generate mode ──
  if (mode === 'generate') {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: BRAND.bgCard, borderRadius: 3, border: `1px solid ${alpha(BRAND.border, 0.5)}` } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => setMode(null)} sx={{ color: BRAND.textMuted }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{name}</Typography>
            <Chip label="AI Generate" size="small" sx={{ height: 22, fontSize: '0.65rem', background: alpha(BRAND.info, 0.15), color: BRAND.info }} />
          </Box>
          <IconButton onClick={handleClose} size="small"><CloseIcon sx={{ color: BRAND.textMuted }} /></IconButton>
        </Box>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: BRAND.textSecondary, mb: 2 }}>
            Describe what this process does and Ace will generate the steps automatically.
          </Typography>
          <TextField
            fullWidth multiline rows={4}
            placeholder='e.g., "Go to Facebook, create a new post with an image and caption, then share it to my business page"'
            value={generateText}
            onChange={(e) => setGenerateText(e.target.value)}
            sx={{ ...inputSx, mb: 2 }}
          />
          {error && <Typography sx={{ fontSize: '0.8rem', color: BRAND.error, mb: 2 }}>{error}</Typography>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" disabled={!generateText.trim() || generating} onClick={handleGenerate} sx={btnPrimary}>
              {generating ? <CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} /> : <AutoAwesomeIcon sx={{ fontSize: 16, mr: 1 }} />}
              Generate Process
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
