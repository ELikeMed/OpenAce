import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, alpha, Button, TextField, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Switch, Snackbar, Alert, Drawer, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ExtensionIcon from '@mui/icons-material/Extension';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SchoolIcon from '@mui/icons-material/School';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import CircularProgress from '@mui/material/CircularProgress';
import { BRAND } from '../theme';

const API = 'http://localhost:3333';

const TIER_CONFIG = {
  off: { label: 'Off', color: BRAND.textMuted, bg: alpha(BRAND.textMuted, 0.1) },
  aware: { label: 'Aware', color: BRAND.info, bg: alpha(BRAND.info, 0.12) },
  trained: { label: 'Trained', color: BRAND.warning, bg: alpha(BRAND.warning, 0.12) },
  connected: { label: 'Connected', color: BRAND.success, bg: alpha(BRAND.success, 0.12) },
};

export default function Integrations() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [linkedSOPs, setLinkedSOPs] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', url: '', category: 'productivity', description: '' });
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ serviceName: '', details: '' });
  const [requestSending, setRequestSending] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  // Notes being edited
  const [notesValue, setNotesValue] = useState('');

  // Twilio credentials
  const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [twilioStatus, setTwilioStatus] = useState({ configured: false });
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioSaving, setTwilioSaving] = useState(false);

  // BYO Phone Agent
  const [byoForm, setByoForm] = useState({ provider: 'vapi', apiKey: '', endpointUrl: '', assistantId: '' });
  const [byoStatus, setByoStatus] = useState({ configured: false });

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/integrations`);
      const data = await res.json();
      if (data.success) {
        setServices(data.data.services || []);
        setCategories(data.data.categories || []);
      }
    } catch (e) {
      console.error('Failed to load integrations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  // Check if Gmail/Google is connected (for sending requests via Ace)
  useEffect(() => {
    fetch(`${API}/api/google-status`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.connected) {
          setGmailConnected(true);
          setGmailEmail(res.data.email || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (serviceId, currentlyEnabled) => {
    const endpoint = currentlyEnabled ? 'disable' : 'enable';
    try {
      await fetch(`${API}/api/integrations/${serviceId}/${endpoint}`, { method: 'POST' });
      await fetchServices();
      setSnackbar({ open: true, message: currentlyEnabled ? 'Integration disabled' : 'Integration enabled — Ace now knows about this service', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update', severity: 'error' });
    }
  };

  const handleOpenDetail = async (service) => {
    setSelectedService(service);
    setDrawerOpen(true);
    setNotesValue(service.state?.notes || '');

    // Fetch linked SOPs
    try {
      const res = await fetch(`${API}/api/integrations/${service.id}/sops`);
      const data = await res.json();
      setLinkedSOPs(data.success ? data.data : []);
    } catch { setLinkedSOPs([]); }

    // Fetch Twilio status if this is Twilio
    if (service.id === 'twilio') {
      fetch(`${API}/api/twilio/status`).then(r => r.json()).then(data => {
        if (data.success) setTwilioStatus(data.data);
      }).catch(() => {});
      fetch(`${API}/api/twilio/byo-status`).then(r => r.json()).then(data => {
        if (data.success) setByoStatus(data.data);
      }).catch(() => {});
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedService) return;
    try {
      await fetch(`${API}/api/integrations/${selectedService.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      });
      await fetchServices();
      setSnackbar({ open: true, message: 'Notes saved', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to save notes', severity: 'error' });
    }
  };

  const handleTrainAce = (serviceName) => {
    // Navigate to chat with prefilled message
    window.dispatchEvent(new CustomEvent('ace:prefill-chat', {
      detail: { message: `Teach me how to use ${serviceName}` }
    }));
    window.dispatchEvent(new CustomEvent('ace:navigate', { detail: { page: 'chat' } }));
    setDrawerOpen(false);
  };

  const handleAddCustom = async () => {
    if (!customForm.name.trim()) return;
    try {
      const res = await fetch(`${API}/api/integrations/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customForm),
      });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: `${customForm.name} added`, severity: 'success' });
        setCustomOpen(false);
        setCustomForm({ name: '', url: '', category: 'productivity', description: '' });
        await fetchServices();
      } else {
        setSnackbar({ open: true, message: data.error || 'Failed to add', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to add custom service', severity: 'error' });
    }
  };

  const handleDeleteCustom = async (id) => {
    try {
      await fetch(`${API}/api/integrations/custom/${id}`, { method: 'DELETE' });
      await fetchServices();
      setDrawerOpen(false);
      setSnackbar({ open: true, message: 'Custom service removed', severity: 'info' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove', severity: 'error' });
    }
  };

  const _buildRequestEmail = () => {
    const subject = `Integration Request: ${requestForm.serviceName}`;
    const body =
      `Integration Request\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Service: ${requestForm.serviceName}\n\n` +
      `Details:\n${requestForm.details || 'No additional details provided.'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Sent from OpenAce Dashboard`;
    return { subject, body };
  };

  const handleSendViaAce = async () => {
    const { subject, body } = _buildRequestEmail();
    setRequestSending(true);
    try {
      const res = await fetch(`${API}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'openaceai@gmail.com',
          subject,
          body: body.replace(/\n/g, '<br>'),
          isHtml: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Request sent via Ace — we\'ll review it!', severity: 'success' });
        setRequestOpen(false);
        setRequestForm({ serviceName: '', details: '' });
      } else {
        setSnackbar({ open: true, message: data.error || 'Failed to send', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to send email', severity: 'error' });
    } finally {
      setRequestSending(false);
    }
  };

  const handleSendViaGmail = () => {
    const { subject, body } = _buildRequestEmail();
    const url = `https://mail.google.com/mail/?view=cm&to=openaceai@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
    setRequestOpen(false);
    setRequestForm({ serviceName: '', details: '' });
    setSnackbar({ open: true, message: 'Gmail compose opened — send when ready!', severity: 'success' });
  };

  const handleSendViaMailApp = () => {
    const { subject, body } = _buildRequestEmail();
    window.location.href = `mailto:openaceai@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setRequestOpen(false);
    setRequestForm({ serviceName: '', details: '' });
    setSnackbar({ open: true, message: 'Mail app opened — send when ready!', severity: 'success' });
  };

  // ── Twilio credential handlers ──
  const handleTestTwilio = async () => {
    setTwilioTesting(true);
    try {
      await fetch(`${API}/api/twilio/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(twilioForm),
      });
      const res = await fetch(`${API}/api/twilio/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnackbar({ open: true, message: `Connected! Account: ${data.data.accountName}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.error || 'Connection failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Connection test failed', severity: 'error' });
    } finally {
      setTwilioTesting(false);
    }
  };

  const handleSaveTwilio = async () => {
    setTwilioSaving(true);
    try {
      const res = await fetch(`${API}/api/twilio/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(twilioForm),
      });
      const data = await res.json();
      if (data.success) {
        setTwilioStatus({ configured: true, phoneNumber: twilioForm.phoneNumber });
        setSnackbar({ open: true, message: 'Twilio connected! SMS and call tools are now active.', severity: 'success' });
        await fetchServices();
      } else {
        setSnackbar({ open: true, message: data.error || 'Save failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to save credentials', severity: 'error' });
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleSaveByoAgent = async () => {
    try {
      const res = await fetch(`${API}/api/twilio/byo-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byoForm),
      });
      const data = await res.json();
      if (data.success) {
        setByoStatus({ configured: true, provider: byoForm.provider });
        setSnackbar({ open: true, message: `${byoForm.provider} agent connected!`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.error || 'Save failed', severity: 'error' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to save agent credentials', severity: 'error' });
    }
  };

  // Filter services
  const filtered = services.filter(s => {
    if (filter !== 'all' && s.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const enabledCount = services.filter(s => s.state?.enabled).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: BRAND.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Integrations
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
            Tell Ace what tools you use. Toggle services on so Ace understands your tech stack.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label={`${enabledCount} active`}
            size="small"
            sx={{
              background: alpha(BRAND.success, 0.12),
              color: BRAND.success,
              fontWeight: 600,
              border: `1px solid ${alpha(BRAND.success, 0.25)}`,
            }}
          />
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => setCustomOpen(true)}
            sx={{ fontSize: '0.8rem' }}
          >
            Add Custom
          </Button>
        </Box>
      </Box>

      {/* Search + Category Filter */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: BRAND.textMuted, fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            size="small"
            onClick={() => setFilter('all')}
            sx={{
              fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
              background: filter === 'all' ? alpha(BRAND.primary, 0.2) : alpha(BRAND.textMuted, 0.08),
              color: filter === 'all' ? BRAND.primary : BRAND.textSecondary,
              border: `1px solid ${filter === 'all' ? alpha(BRAND.primary, 0.3) : 'transparent'}`,
              '&:hover': { background: alpha(BRAND.primary, 0.15) },
            }}
          />
          {categories.map(cat => (
            <Chip
              key={cat.id}
              label={cat.label}
              size="small"
              onClick={() => setFilter(cat.id)}
              sx={{
                fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                background: filter === cat.id ? alpha(BRAND.primary, 0.2) : alpha(BRAND.textMuted, 0.08),
                color: filter === cat.id ? BRAND.primary : BRAND.textSecondary,
                border: `1px solid ${filter === cat.id ? alpha(BRAND.primary, 0.3) : 'transparent'}`,
                '&:hover': { background: alpha(BRAND.primary, 0.15) },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Service Cards Grid */}
      <Grid container spacing={2}>
        {filtered.map(service => {
          const isEnabled = service.state?.enabled;
          const tier = isEnabled ? (service.state?.tier || 'aware') : 'off';
          const tierCfg = TIER_CONFIG[tier];

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={service.id}>
              <Paper
                sx={{
                  p: 2.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: `1px solid ${isEnabled ? alpha(tierCfg.color, 0.25) : BRAND.border}`,
                  background: isEnabled ? alpha(tierCfg.color, 0.04) : BRAND.bgCard,
                  '&:hover': {
                    borderColor: BRAND.primary,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${alpha(BRAND.primary, 0.15)}`,
                  },
                }}
                onClick={() => handleOpenDetail(service)}
              >
                {/* Top row: Name + Toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <ExtensionIcon sx={{ fontSize: 20, color: isEnabled ? tierCfg.color : BRAND.textMuted, flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {service.name}
                    </Typography>
                  </Box>
                  <Switch
                    size="small"
                    checked={isEnabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleToggle(service.id, isEnabled)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: tierCfg.color },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: tierCfg.color },
                    }}
                  />
                </Box>

                {/* Description */}
                <Typography sx={{ fontSize: '0.78rem', color: BRAND.textMuted, mb: 1.5, lineHeight: 1.4, minHeight: 32 }}>
                  {service.description}
                </Typography>

                {/* Status badge */}
                <Chip
                  label={tierCfg.label}
                  size="small"
                  sx={{
                    fontSize: '0.7rem', fontWeight: 700, height: 22,
                    background: tierCfg.bg,
                    color: tierCfg.color,
                    border: `1px solid ${alpha(tierCfg.color, 0.3)}`,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
                {service.custom && (
                  <Chip
                    label="Custom"
                    size="small"
                    sx={{
                      ml: 0.75, fontSize: '0.65rem', fontWeight: 600, height: 20,
                      background: alpha(BRAND.accent, 0.12),
                      color: BRAND.accent,
                    }}
                  />
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <ExtensionIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
          <Typography sx={{ color: BRAND.textMuted }}>
            {search ? 'No services match your search' : 'No services in this category'}
          </Typography>
        </Box>
      )}

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            background: BRAND.bgCard,
            borderLeft: `1px solid ${BRAND.border}`,
          },
        }}
      >
        {selectedService && (() => {
          const svc = selectedService;
          const isEnabled = svc.state?.enabled;
          const tier = isEnabled ? (svc.state?.tier || 'aware') : 'off';
          const tierCfg = TIER_CONFIG[tier];

          return (
            <Box sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <ExtensionIcon sx={{ fontSize: 28, color: tierCfg.color }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{svc.name}</Typography>
                    <Chip
                      label={tierCfg.label}
                      size="small"
                      sx={{
                        fontSize: '0.68rem', fontWeight: 700, height: 20, mt: 0.5,
                        background: tierCfg.bg, color: tierCfg.color,
                        border: `1px solid ${alpha(tierCfg.color, 0.3)}`,
                      }}
                    />
                  </Box>
                </Box>
                <IconButton onClick={() => setDrawerOpen(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Description */}
              <Typography sx={{ fontSize: '0.85rem', color: BRAND.textSecondary, mb: 2 }}>
                {svc.description}
              </Typography>

              {/* URL */}
              {svc.url && (
                <Button
                  startIcon={<OpenInNewIcon />}
                  size="small"
                  onClick={() => window.open(svc.url, '_blank')}
                  sx={{ mb: 2.5, fontSize: '0.78rem', color: BRAND.info }}
                >
                  {svc.url.replace(/^https?:\/\//, '')}
                </Button>
              )}

              <Divider sx={{ borderColor: BRAND.border, mb: 2.5 }} />

              {/* Enable toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>Ace knows I use this</Typography>
                <Switch
                  checked={isEnabled}
                  onChange={() => {
                    handleToggle(svc.id, isEnabled);
                    setSelectedService(prev => ({
                      ...prev,
                      state: { ...prev.state, enabled: !isEnabled, tier: !isEnabled ? 'aware' : 'off' }
                    }));
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: BRAND.primary },
                  }}
                />
              </Box>

              {/* Train Ace button */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SchoolIcon />}
                onClick={() => handleTrainAce(svc.name)}
                sx={{
                  mb: 2.5, fontSize: '0.82rem', fontWeight: 600,
                  borderColor: alpha(BRAND.warning, 0.4),
                  color: BRAND.warning,
                  '&:hover': { borderColor: BRAND.warning, background: alpha(BRAND.warning, 0.08) },
                }}
              >
                Train Ace on {svc.name}
              </Button>

              {/* API Connection (only for services with backend support) */}
              {svc.hasBackendSupport && svc.id === 'twilio' && (
                <Box sx={{ mb: 2.5 }}>
                  <Divider sx={{ borderColor: BRAND.border, mb: 2.5 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PhoneIcon sx={{ fontSize: 18 }} /> API Connection
                  </Typography>

                  {twilioStatus.configured ? (
                    <Box sx={{ mb: 2 }}>
                      <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: '0.8rem' }}>
                        Connected — Phone: {twilioStatus.phoneNumber}
                      </Alert>
                      <Button size="small" variant="outlined" onClick={() => setTwilioStatus({ configured: false })}
                        sx={{ fontSize: '0.75rem', borderColor: BRAND.border, color: BRAND.textMuted }}>
                        Update Credentials
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, mb: 1.5 }}>
                        Get your credentials from twilio.com/console
                      </Typography>
                      <TextField fullWidth size="small" label="Account SID" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioForm.accountSid}
                        onChange={(e) => setTwilioForm(p => ({ ...p, accountSid: e.target.value }))} sx={{ mb: 1.5 }} />
                      <TextField fullWidth size="small" label="Auth Token" type="password"
                        value={twilioForm.authToken}
                        onChange={(e) => setTwilioForm(p => ({ ...p, authToken: e.target.value }))} sx={{ mb: 1.5 }} />
                      <TextField fullWidth size="small" label="Phone Number" placeholder="+15551234567"
                        value={twilioForm.phoneNumber}
                        onChange={(e) => setTwilioForm(p => ({ ...p, phoneNumber: e.target.value }))} sx={{ mb: 1.5 }} />

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" size="small" onClick={handleTestTwilio}
                          disabled={twilioTesting || !twilioForm.accountSid}
                          startIcon={twilioTesting ? <CircularProgress size={16} /> : null}
                          sx={{ fontSize: '0.75rem', borderColor: BRAND.border }}>
                          {twilioTesting ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <Button variant="contained" size="small" onClick={handleSaveTwilio}
                          disabled={twilioSaving || !twilioForm.accountSid || !twilioForm.authToken || !twilioForm.phoneNumber}
                          startIcon={twilioSaving ? <CircularProgress size={16} color="inherit" /> : null}
                          sx={{ fontSize: '0.75rem' }}>
                          {twilioSaving ? 'Saving...' : 'Save & Connect'}
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* BYO AI Phone Agent */}
                  <Box sx={{ mt: 3 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.5 }}>
                      AI Phone Agent (Optional)
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: BRAND.textMuted, mb: 1.5 }}>
                      Connect a Vapi, Bland, or Retell agent to make AI-powered calls.
                    </Typography>
                    {byoStatus.configured ? (
                      <Box>
                        <Alert severity="success" sx={{ mb: 1, borderRadius: 2, fontSize: '0.8rem' }}>
                          {byoStatus.provider} agent connected
                        </Alert>
                        <Button size="small" variant="outlined" onClick={() => setByoStatus({ configured: false })}
                          sx={{ fontSize: '0.75rem', borderColor: BRAND.border, color: BRAND.textMuted }}>
                          Update Agent
                        </Button>
                      </Box>
                    ) : (
                      <Box>
                        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                          <InputLabel>Provider</InputLabel>
                          <Select value={byoForm.provider} label="Provider"
                            onChange={(e) => setByoForm(p => ({ ...p, provider: e.target.value }))}>
                            <MenuItem value="vapi">Vapi</MenuItem>
                            <MenuItem value="bland">Bland AI</MenuItem>
                            <MenuItem value="retell">Retell</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField fullWidth size="small" label="API Key" type="password" value={byoForm.apiKey}
                          onChange={(e) => setByoForm(p => ({ ...p, apiKey: e.target.value }))} sx={{ mb: 1.5 }} />
                        {(byoForm.provider === 'vapi' || byoForm.provider === 'retell') && (
                          <TextField fullWidth size="small" label="Assistant / Agent ID" value={byoForm.assistantId}
                            onChange={(e) => setByoForm(p => ({ ...p, assistantId: e.target.value }))} sx={{ mb: 1.5 }} />
                        )}
                        {byoForm.provider === 'custom' && (
                          <TextField fullWidth size="small" label="Endpoint URL" value={byoForm.endpointUrl}
                            onChange={(e) => setByoForm(p => ({ ...p, endpointUrl: e.target.value }))} sx={{ mb: 1.5 }} />
                        )}
                        <Button variant="outlined" size="small" onClick={handleSaveByoAgent}
                          disabled={!byoForm.apiKey}
                          sx={{ fontSize: '0.75rem', borderColor: BRAND.border }}>
                          Save Agent
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {/* Webhook info */}
                  <Box sx={{ mt: 2.5, p: 1.5, borderRadius: 2, background: alpha(BRAND.info, 0.06), border: `1px solid ${alpha(BRAND.info, 0.15)}` }}>
                    <Typography sx={{ fontSize: '0.72rem', color: BRAND.info }}>
                      Outbound SMS and calls work immediately. For inbound SMS, you need a public URL
                      (e.g., Cloudflare Tunnel) pointed to http://localhost:3333/api/webhooks/twilio/sms
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Linked SOPs */}
              {linkedSOPs.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PlaylistPlayIcon sx={{ fontSize: 18 }} /> Linked Processes ({linkedSOPs.length})
                  </Typography>
                  {linkedSOPs.map(sop => (
                    <Chip
                      key={sop.id}
                      label={sop.name}
                      size="small"
                      sx={{
                        mr: 0.5, mb: 0.5, fontSize: '0.72rem',
                        background: alpha(BRAND.warning, 0.1),
                        color: BRAND.warning,
                        border: `1px solid ${alpha(BRAND.warning, 0.2)}`,
                      }}
                    />
                  ))}
                </Box>
              )}

              <Divider sx={{ borderColor: BRAND.border, mb: 2.5 }} />

              {/* Notes */}
              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', mb: 1 }}>Notes for Ace</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: BRAND.textMuted, mb: 1 }}>
                Add context Ace should know (e.g., "My Slack workspace is acme-corp")
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="e.g., My company Stripe account, primary workspace..."
                sx={{ mb: 1 }}
              />
              <Button
                size="small"
                onClick={handleSaveNotes}
                disabled={notesValue === (svc.state?.notes || '')}
                sx={{ mb: 2.5, fontSize: '0.75rem' }}
              >
                Save Notes
              </Button>

              <Divider sx={{ borderColor: BRAND.border, mb: 2.5 }} />

              {/* Request API Build */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RocketLaunchIcon />}
                onClick={() => {
                  setRequestForm({ serviceName: svc.name, details: '' });
                  setRequestOpen(true);
                }}
                sx={{
                  mb: 2.5, fontSize: '0.82rem', fontWeight: 600,
                  borderColor: alpha(BRAND.secondary, 0.4),
                  color: BRAND.secondary,
                  '&:hover': { borderColor: BRAND.secondary, background: alpha(BRAND.secondary, 0.08) },
                }}
              >
                Request {svc.name} API Build
              </Button>

              {/* Delete custom service */}
              {svc.custom && (
                <>
                  <Divider sx={{ borderColor: BRAND.border, my: 2.5 }} />
                  <Button
                    fullWidth
                    size="small"
                    onClick={() => handleDeleteCustom(svc.id)}
                    sx={{
                      fontSize: '0.78rem', color: BRAND.error,
                      '&:hover': { background: alpha(BRAND.error, 0.08) },
                    }}
                  >
                    Remove Custom Service
                  </Button>
                </>
              )}
            </Box>
          );
        })()}
      </Drawer>

      {/* Add Custom Dialog */}
      <Dialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Add Custom Service</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField
            fullWidth
            size="small"
            label="Service Name"
            value={customForm.name}
            onChange={(e) => setCustomForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="URL (optional)"
            placeholder="https://..."
            value={customForm.url}
            onChange={(e) => setCustomForm(prev => ({ ...prev, url: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={customForm.category}
              label="Category"
              onChange={(e) => setCustomForm(prev => ({ ...prev, category: e.target.value }))}
            >
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="Description (optional)"
            multiline
            rows={2}
            value={customForm.description}
            onChange={(e) => setCustomForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCustomOpen(false)} sx={{ color: BRAND.textMuted }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddCustom}
            disabled={!customForm.name.trim()}
          >
            Add Service
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Integration Dialog */}
      <Dialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { background: BRAND.bgCard, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>
          Request Integration
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography sx={{ fontSize: '0.82rem', color: BRAND.textMuted, mb: 2 }}>
            Want Ace to natively connect with a service? Let us know and we'll build it.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Service Name"
            placeholder="e.g., Calendly, Freshdesk, Zendesk..."
            value={requestForm.serviceName}
            onChange={(e) => setRequestForm(prev => ({ ...prev, serviceName: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="What would you use it for? (optional)"
            multiline
            rows={3}
            placeholder="e.g., I want Ace to automatically schedule calls from my pipeline leads"
            value={requestForm.details}
            onChange={(e) => setRequestForm(prev => ({ ...prev, details: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
          <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, mb: 0.5, textAlign: 'center' }}>
            Choose how to send your request
          </Typography>

          {gmailConnected && (
            <Button
              variant="contained"
              fullWidth
              startIcon={requestSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              onClick={handleSendViaAce}
              disabled={!requestForm.serviceName.trim() || requestSending}
              sx={{
                background: `linear-gradient(135deg, ${BRAND.secondary} 0%, ${BRAND.success} 100%)`,
                '&:hover': { background: `linear-gradient(135deg, ${BRAND.success} 0%, ${BRAND.secondary} 100%)` },
              }}
            >
              {requestSending ? 'Sending...' : `Let Ace Send It${gmailEmail ? ` (${gmailEmail})` : ''}`}
            </Button>
          )}

          <Button
            variant="outlined"
            fullWidth
            startIcon={<EmailIcon />}
            onClick={handleSendViaGmail}
            disabled={!requestForm.serviceName.trim()}
            sx={{ borderColor: BRAND.border, color: BRAND.textPrimary }}
          >
            Open in Gmail
          </Button>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<MailOutlineIcon />}
            onClick={handleSendViaMailApp}
            disabled={!requestForm.serviceName.trim()}
            sx={{ borderColor: BRAND.border, color: BRAND.textSecondary, fontSize: '0.82rem' }}
          >
            Open in Mail App
          </Button>

          <Button
            onClick={() => setRequestOpen(false)}
            sx={{ color: BRAND.textMuted, mt: 0.5 }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
