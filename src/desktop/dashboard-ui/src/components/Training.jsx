import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Button, Typography, Paper, TextField, Chip, Avatar, Grid,
  alpha, LinearProgress, Divider, IconButton, Tabs, Tab,
  CircularProgress, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SchoolIcon from '@mui/icons-material/School';
import LayersIcon from '@mui/icons-material/Layers';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import MouseIcon from '@mui/icons-material/Mouse';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LanguageIcon from '@mui/icons-material/Language';
import TimerIcon from '@mui/icons-material/Timer';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LoginIcon from '@mui/icons-material/Login';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import EmailIcon from '@mui/icons-material/Email';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
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
};

function Training() {
  const [activeTab, setActiveTab] = useState(0);
  const [sessions, setSessions] = useState([]);

  // Teach by Telling state
  const [nlText, setNlText] = useState('');
  const [nlName, setNlName] = useState('');
  const [nlCategory, setNlCategory] = useState('general');
  const [parsedSteps, setParsedSteps] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Teach by Example state (desktop recording)
  const [recordingName, setRecordingName] = useState('');
  const [desktopStatus, setDesktopStatus] = useState({ isRecording: false, actionsRecorded: 0 });
  const [recordingCategory, setRecordingCategory] = useState('general');

  // Upload SOP state
  const [uploadedFile, setUploadedFile] = useState(null);  // { name, size, type }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Quick SOP state
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVars, setTemplateVars] = useState({});
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchDesktopStatus();
  }, []);

  const fetchDesktopStatus = async () => {
    try {
      const response = await fetch('/api/training/recording-status');
      const result = await response.json();
      if (result.success) setDesktopStatus(result.data);
    } catch (e) { console.error(e); }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/training/sessions');
      const result = await response.json();
      if (result.success) setSessions(result.data);
    } catch (e) { console.error(e); }
  };

  // ── Teach by Telling handlers ──
  const handleParseSteps = async () => {
    if (!nlText.trim()) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/training/parse-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlText, useAI: true }),
      });
      const data = await res.json();
      if (data.success && data.data?.steps) {
        setParsedSteps(data.data.steps);
        if (!nlName && data.data.name) setNlName(data.data.name);
        setShowPreview(true);
      }
    } catch (e) { console.error(e); }
    finally { setIsParsing(false); }
  };

  const handleSaveTeachByTelling = async () => {
    if (!parsedSteps.length) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/training/teach-by-telling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlText, name: nlName, category: nlCategory, useAI: true }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setNlText('');
          setNlName('');
          setParsedSteps([]);
          setShowPreview(false);
          setSaveSuccess(false);
        }, 2000);
      }
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  // ── Upload SOP Document handler ──
  const ACCEPTED_TYPES = ['.pdf', '.docx', '.doc', '.txt', '.md', '.text', '.csv'];

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setUploadError(`Unsupported file type. Use: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large (max 10MB)');
      return;
    }

    setUploadedFile({ name: file.name, size: file.size, type: ext });
    setUploadError('');
    setIsUploading(true);
    setParsedSteps([]);
    setShowPreview(false);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/training/upload-sop-document', {
        method: 'POST',
        headers: { 'x-filename': encodeURIComponent(file.name) },
        body: buffer,
      });
      const data = await res.json();
      if (data.success && data.data?.steps?.length) {
        setParsedSteps(data.data.steps);
        if (data.data.name) setNlName(data.data.name);
        if (data.data.extractedText) setNlText(data.data.extractedText);
        setShowPreview(true);
      } else {
        setUploadError(data.error || 'Could not extract steps from document');
      }
    } catch (e) {
      console.error(e);
      setUploadError('Upload failed — check your connection');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClearUpload = () => {
    setUploadedFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Teach by Example handlers ──
  const handleStartDesktopRecording = async () => {
    if (!recordingName.trim()) return;
    try {
      const res = await fetch('/api/training/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: recordingName }),
      });
      const data = await res.json();
      if (data.success) {
        setDesktopStatus({ isRecording: true, actionsRecorded: 0 });
        // Poll for status updates
        const interval = setInterval(async () => {
          await fetchDesktopStatus();
        }, 3000);
        window._recordingPollInterval = interval;
      }
    } catch (e) { console.error(e); }
  };

  const handleStopDesktopRecording = async () => {
    try {
      if (window._recordingPollInterval) {
        clearInterval(window._recordingPollInterval);
      }
      const res = await fetch('/api/training/stop-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recordingName,
          description: `Desktop recording: ${recordingName}`,
          category: recordingCategory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDesktopStatus({ isRecording: false, actionsRecorded: 0 });
        setRecordingName('');
        fetchSessions();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteSession = async (sessionName) => {
    try {
      await fetch(`/api/training/sessions/${encodeURIComponent(sessionName)}`, { method: 'DELETE' });
      fetchSessions();
    } catch (e) { console.error(e); }
  };

  // ── Quick SOP handler ──
  const handleCreateQuickSOP = async () => {
    if (!selectedTemplate) return;
    setIsCreatingQuick(true);
    try {
      const res = await fetch('/api/training/quick-sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selectedTemplate, variables: templateVars }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTemplate('');
        setTemplateVars({});
        // Show success feedback
      }
    } catch (e) { console.error(e); }
    finally { setIsCreatingQuick(false); }
  };

  const TEMPLATES = [
    { id: 'login-to-website', name: 'Login to Website', icon: <LoginIcon />, color: BRAND.error,
      fields: [
        { key: 'url', label: 'Website URL', placeholder: 'https://example.com' },
        { key: 'credentialId', label: 'Saved Credential ID', placeholder: 'e.g. linkedin' },
      ]
    },
    { id: 'search-and-extract', name: 'Search & Extract Data', icon: <SearchIcon />, color: BRAND.info,
      fields: [
        { key: 'searchUrl', label: 'Search Engine URL', placeholder: 'https://google.com' },
        { key: 'query', label: 'Search Query', placeholder: 'duplexes in Miami under $400k' },
        { key: 'extractTarget', label: 'What to Extract', placeholder: 'prices and addresses' },
      ]
    },
    { id: 'post-on-social-media', name: 'Post on Social Media', icon: <ShareIcon />, color: BRAND.accent,
      fields: [
        { key: 'platform', label: 'Platform', placeholder: 'LinkedIn' },
        { key: 'url', label: 'Platform URL', placeholder: 'https://linkedin.com' },
        { key: 'content', label: 'Post Content', placeholder: 'Your post text here...' },
      ]
    },
    { id: 'send-email-campaign', name: 'Send Email Campaign', icon: <EmailIcon />, color: BRAND.success,
      fields: [
        { key: 'url', label: 'Email Platform URL', placeholder: 'https://mail.google.com' },
        { key: 'to', label: 'Recipient', placeholder: 'recipient@example.com' },
        { key: 'subject', label: 'Subject', placeholder: 'Email subject line' },
        { key: 'body', label: 'Email Body', placeholder: 'Email content...' },
      ]
    },
  ];

  const isRecordingAny = desktopStatus.isRecording;

  return (
    <Box sx={{ maxWidth: 1100 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.accent, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.accent, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.accent, 0.3)}`,
          }}>
            <SchoolIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Train Ace
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Teach Ace new workflows by telling, showing, or using templates
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {isRecordingAny && (
              <Chip
                icon={<FiberManualRecordIcon sx={{
                  fontSize: '10px !important',
                  color: `${BRAND.error} !important`,
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                }} />}
                label={`Recording (${desktopStatus.actionsRecorded} actions)`}
                sx={{
                  fontWeight: 600,
                  background: alpha(BRAND.error, 0.1),
                  color: BRAND.error,
                  border: `1px solid ${alpha(BRAND.error, 0.2)}`,
                }}
              />
            )}
            <Chip
              label={`${sessions.length} sessions`}
              sx={{
                fontWeight: 600,
                background: alpha(BRAND.primary, 0.1),
                color: BRAND.primaryLight,
                border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
              }}
            />
          </Box>
        </Box>
        {isRecordingAny && (
          <LinearProgress variant="indeterminate" sx={{ mt: 2,
            '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${BRAND.error}, ${BRAND.accent})` },
            backgroundColor: alpha(BRAND.error, 0.1),
          }} />
        )}
      </Paper>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.9rem' },
            '& .Mui-selected': { color: `${BRAND.accent} !important` },
            '& .MuiTabs-indicator': { backgroundColor: BRAND.accent },
          }}
        >
          <Tab icon={<EditNoteIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Teach by Telling" />
          <Tab icon={<ScreenshotMonitorIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Teach by Example" />
          <Tab icon={<RocketLaunchIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Quick SOP" />
        </Tabs>
      </Paper>

      {/* ═══ TAB 0: Teach by Telling ═══ */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: showPreview ? 6 : 12 }}>
            {/* ── Upload SOP Document ── */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <UploadFileIcon sx={{ color: BRAND.secondary }} />
                Import from Document
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2 }}>
                Upload an SOP document and Ace will parse it into executable steps automatically.
              </Typography>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.text,.csv"
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
              />

              {/* Drag & drop zone */}
              <Box
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                sx={{
                  p: 3, borderRadius: 2, textAlign: 'center', cursor: isUploading ? 'default' : 'pointer',
                  border: `2px dashed ${isDragging ? BRAND.accent : uploadedFile ? BRAND.success : BRAND.border}`,
                  background: isDragging
                    ? alpha(BRAND.accent, 0.06)
                    : uploadedFile
                      ? alpha(BRAND.success, 0.04)
                      : alpha(BRAND.primary, 0.02),
                  transition: 'all 0.2s ease',
                  '&:hover': !isUploading ? {
                    borderColor: BRAND.accent,
                    background: alpha(BRAND.accent, 0.04),
                  } : {},
                }}
              >
                {isUploading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={32} sx={{ color: BRAND.accent }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: BRAND.accent }}>
                      Analyzing document...
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted }}>
                      Ace is reading your document and converting it into executable steps
                    </Typography>
                  </Box>
                ) : uploadedFile ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
                    <DescriptionIcon sx={{ fontSize: 28, color: BRAND.success }} />
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {uploadedFile.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted }}>
                        {(uploadedFile.size / 1024).toFixed(1)} KB — parsed successfully
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClearUpload(); }}
                      sx={{ ml: 1, color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box>
                    <UploadFileIcon sx={{ fontSize: 36, color: isDragging ? BRAND.accent : BRAND.textMuted, mb: 1 }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: BRAND.textSecondary }}>
                      {isDragging ? 'Drop your file here' : 'Drag & drop or click to upload'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mt: 0.5 }}>
                      PDF, Word (.docx), Text, Markdown, CSV
                    </Typography>
                  </Box>
                )}
              </Box>

              {uploadError && (
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.error, mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {uploadError}
                </Typography>
              )}
            </Paper>

            {/* ── "OR" Divider ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography sx={{ px: 2, fontSize: '0.75rem', fontWeight: 600, color: BRAND.textMuted, textTransform: 'uppercase' }}>
                or type it out
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>

            {/* ── Write Instructions Manually ── */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditNoteIcon sx={{ color: BRAND.accent }} />
                Describe the Workflow
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2.5 }}>
                Write step-by-step instructions in plain English. Ace will parse them into an executable SOP.
              </Typography>

              <TextField
                label="SOP Name"
                placeholder="e.g., Search for Duplexes on Zillow"
                value={nlName}
                onChange={(e) => setNlName(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />

              <TextField
                label="Instructions"
                placeholder={`Example:\nGo to google.com\nSearch for 'duplexes in Miami'\nClick the first Zillow link\nWait 3 seconds\nTake a screenshot\nCopy the prices`}
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                fullWidth
                multiline
                rows={7}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Category</InputLabel>
                  <Select value={nlCategory} label="Category" onChange={(e) => setNlCategory(e.target.value)}>
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="social">Social Media</MenuItem>
                    <MenuItem value="lead_generation">Lead Gen</MenuItem>
                    <MenuItem value="research">Research</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={isParsing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <PreviewIcon />}
                  onClick={handleParseSteps}
                  disabled={!nlText.trim() || isParsing}
                  sx={{
                    background: `linear-gradient(135deg, ${BRAND.info}, ${BRAND.primary}) !important`,
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  {isParsing ? 'Parsing...' : 'Preview Steps'}
                </Button>

                {parsedSteps.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : saveSuccess ? <CheckCircleIcon /> : <SaveIcon />}
                    onClick={handleSaveTeachByTelling}
                    disabled={isSaving || saveSuccess}
                    sx={{
                      background: saveSuccess
                        ? `${BRAND.success} !important`
                        : `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondaryLight}) !important`,
                      '&.Mui-disabled': { opacity: saveSuccess ? 1 : 0.5 },
                    }}
                  >
                    {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save SOP'}
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Step Preview */}
          {showPreview && parsedSteps.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon sx={{ color: BRAND.accent }} />
                    Parsed Steps
                  </Typography>
                  <Chip label={`${parsedSteps.length} steps`} size="small"
                    sx={{ background: alpha(BRAND.success, 0.1), color: BRAND.success, fontWeight: 600 }} />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {parsedSteps.map((step, i) => {
                    const color = STEP_COLORS[step.action] || BRAND.textSecondary;
                    return (
                      <Box key={i} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, borderRadius: 2,
                        border: `1px solid ${alpha(color, 0.15)}`,
                        background: alpha(color, 0.04),
                      }}>
                        <Avatar sx={{
                          width: 28, height: 28,
                          background: alpha(color, 0.15),
                          color: color,
                          fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          {i + 1}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ color }}>{STEP_ICONS[step.action]}</Box>
                            <Chip label={step.action} size="small" sx={{
                              height: 20, fontSize: '0.65rem', fontWeight: 600,
                              background: alpha(color, 0.12), color,
                            }} />
                          </Box>
                          <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: 'block', mt: 0.3 }}>
                            {step.description || step.url || step.text || ''}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ═══ TAB 1: Teach by Example ═══ */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScreenshotMonitorIcon sx={{ color: BRAND.secondary }} />
            Screen Recording
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2.5 }}>
            Ace captures your full screen every 3 seconds and records mouse clicks, keyboard input, and navigation.
            Perform the workflow you want to teach, then click Stop — Ace will turn it into a replayable SOP.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
            <TextField
              label="What are you teaching Ace?"
              placeholder="e.g., Process a lead in CRM, Post on Facebook"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              fullWidth
              disabled={desktopStatus.isRecording}
              InputProps={{
                startAdornment: <LayersIcon sx={{ mr: 1, color: BRAND.textMuted, fontSize: 20 }} />,
              }}
            />

            <FormControl size="small" sx={{ maxWidth: 200 }}>
              <InputLabel>Category</InputLabel>
              <Select value={recordingCategory} label="Category" onChange={(e) => setRecordingCategory(e.target.value)}
                disabled={desktopStatus.isRecording}>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="social">Social Media</MenuItem>
                <MenuItem value="lead_generation">Lead Gen</MenuItem>
                <MenuItem value="research">Research</MenuItem>
              </Select>
            </FormControl>

            {desktopStatus.isRecording && (
              <Box sx={{
                p: 2, borderRadius: 2, background: alpha('#FF4757', 0.06),
                border: `1px solid ${alpha('#FF4757', 0.2)}`,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <FiberManualRecordIcon sx={{
                    fontSize: 16, color: '#FF4757',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#FF4757', fontWeight: 700, flex: 1 }}>
                    Recording in Progress
                  </Typography>
                  <Chip icon={<CameraAltIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${desktopStatus.screenshotsCaptured || desktopStatus.actionsRecorded || 0} captured`}
                    size="small" sx={{
                      fontSize: '0.7rem', fontWeight: 600,
                      background: alpha(BRAND.info, 0.1), color: BRAND.info,
                    }} />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary, lineHeight: 1.6 }}>
                  Your <strong>full screen</strong> is being captured every 3 seconds. Switch to the app/tab you want to demonstrate and perform the workflow.
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleStartDesktopRecording}
                disabled={desktopStatus.isRecording || !recordingName.trim()}
                sx={{
                  px: 4,
                  background: `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondaryLight}) !important`,
                  '&:hover': { boxShadow: `0 4px 15px ${alpha(BRAND.success, 0.4)}` },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                Start Recording
              </Button>
              <Button
                variant="contained"
                startIcon={<StopIcon />}
                onClick={handleStopDesktopRecording}
                disabled={!desktopStatus.isRecording}
                sx={{
                  px: 4,
                  background: `linear-gradient(135deg, ${BRAND.error}, ${BRAND.accent}) !important`,
                  '&:hover': { boxShadow: `0 4px 15px ${alpha(BRAND.error, 0.4)}` },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                Stop & Save
              </Button>
            </Box>
          </Box>

          {/* Past Sessions */}
          {sessions.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: BRAND.textSecondary }}>
                Past Recordings ({sessions.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {sessions.map((s, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1, borderRadius: 1, border: `1px solid ${BRAND.border}`,
                    '&:hover': { background: alpha(BRAND.primary, 0.03) },
                  }}>
                    <ScreenshotMonitorIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                      {s.name || s.sessionName || 'Untitled'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      {s.steps?.length || '?'} steps
                    </Typography>
                    <IconButton size="small" onClick={() => handleDeleteSession(s.name || s.sessionName)}
                      sx={{ color: BRAND.textMuted, opacity: 0.5, '&:hover': { color: BRAND.error, opacity: 1 } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* ═══ TAB 2: Quick SOP Templates ═══ */}
      {activeTab === 2 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {TEMPLATES.map((tpl) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={tpl.id}>
                <Paper
                  onClick={() => {
                    setSelectedTemplate(tpl.id);
                    setTemplateVars({});
                  }}
                  sx={{
                    p: 2.5, cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.3s ease',
                    border: selectedTemplate === tpl.id
                      ? `2px solid ${tpl.color}`
                      : `1px solid ${BRAND.border}`,
                    background: selectedTemplate === tpl.id
                      ? alpha(tpl.color, 0.08)
                      : 'transparent',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 6px 20px ${alpha(tpl.color, 0.15)}`,
                      border: `1px solid ${alpha(tpl.color, 0.3)}`,
                    },
                  }}
                >
                  <Avatar sx={{
                    width: 48, height: 48, mx: 'auto', mb: 1.5,
                    background: alpha(tpl.color, 0.15),
                    color: tpl.color,
                  }}>
                    {tpl.icon}
                  </Avatar>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {tpl.name}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Template Configuration */}
          {selectedTemplate && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 2.5 }}>
                Configure: {TEMPLATES.find(t => t.id === selectedTemplate)?.name}
              </Typography>

              <Grid container spacing={2}>
                {TEMPLATES.find(t => t.id === selectedTemplate)?.fields.map((field) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
                    <TextField
                      label={field.label}
                      placeholder={field.placeholder}
                      value={templateVars[field.key] || ''}
                      onChange={(e) => setTemplateVars(prev => ({ ...prev, [field.key]: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                ))}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="SOP Name (optional)"
                    placeholder="Custom name for this SOP"
                    value={templateVars.name || ''}
                    onChange={(e) => setTemplateVars(prev => ({ ...prev, name: e.target.value }))}
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2.5 }}>
                <Button
                  variant="contained"
                  startIcon={isCreatingQuick ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <RocketLaunchIcon />}
                  onClick={handleCreateQuickSOP}
                  disabled={isCreatingQuick}
                  sx={{
                    background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary}) !important`,
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  {isCreatingQuick ? 'Creating...' : 'Create SOP'}
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      )}

    </Box>
  );
}

export default Training;
