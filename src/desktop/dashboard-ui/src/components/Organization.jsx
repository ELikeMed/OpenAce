import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, alpha, Switch, Chip, Avatar, Button,
  TextField, Divider, Snackbar, Alert, CircularProgress, Card, CardContent,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemIcon, ListItemText, LinearProgress, Collapse,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import CodeIcon from '@mui/icons-material/Code';
import CampaignIcon from '@mui/icons-material/Campaign';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WebIcon from '@mui/icons-material/Web';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import MouseIcon from '@mui/icons-material/Mouse';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import AppsIcon from '@mui/icons-material/Apps';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SecurityIcon from '@mui/icons-material/Security';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import SchoolIcon from '@mui/icons-material/School';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import RouteIcon from '@mui/icons-material/AltRoute';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import { BRAND } from '../theme';

const DEPT_ICONS = {
  ceo: <TrendingUpIcon />,
  cto: <CodeIcon />,
  cmo: <CampaignIcon />,
  research: <SearchIcon />,
  admin: <CalendarMonthIcon />,
  browser: <WebIcon />,
};

const DEPT_COLORS = {
  ceo: '#6366f1',
  cto: '#06b6d4',
  cmo: '#f59e0b',
  research: '#10b981',
  admin: '#8b5cf6',
  browser: '#ef4444',
};

function DepartmentCard({ dept, onToggle }) {
  const color = DEPT_COLORS[dept.id] || BRAND.primary;
  const icon = DEPT_ICONS[dept.id] || <PersonIcon />;

  return (
    <Card sx={{
      position: 'relative',
      border: `1px solid ${alpha(color, dept.enabled ? 0.3 : 0.1)}`,
      background: dept.enabled 
        ? `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(color, 0.02)} 100%)`
        : alpha('#fff', 0.02),
      opacity: dept.enabled ? 1 : 0.6,
      transition: 'all 0.3s ease',
      '&:hover': { borderColor: alpha(color, 0.5), transform: 'translateY(-2px)' }
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{
              width: 40, height: 40,
              background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.7)})`,
              boxShadow: dept.enabled ? `0 4px 12px ${alpha(color, 0.3)}` : 'none',
            }}>
              {icon}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                {dept.name}
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                {dept.id.toUpperCase()}
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={dept.enabled}
            onChange={(e) => onToggle(dept.id, e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: color },
            }}
          />
        </Box>
        
        <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 1.5, fontSize: '0.8rem', lineHeight: 1.4 }}>
          {dept.description}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(dept.keywords || []).slice(0, 5).map((kw, i) => (
            <Chip key={i} label={kw} size="small" sx={{
              fontSize: '0.65rem', height: 20,
              backgroundColor: alpha(color, 0.1),
              color: color,
              border: `1px solid ${alpha(color, 0.2)}`
            }} />
          ))}
        </Box>

        {dept.memorySize > 0 && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: alpha(BRAND.textSecondary, 0.7) }}>
            💬 {dept.memorySize} conversation(s) in memory
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function BusinessProfileEditor({ profile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ownerName: '',
    name: '',
    mission: '',
    targetAudience: '',
    offerings: '',
    industry: '',
    location: '',
    website: '',
    ...profile
  });

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      ...profile,
      offerings: Array.isArray(profile?.offerings) ? profile.offerings.join(', ') : (profile?.offerings || '')
    }));
  }, [profile]);

  const handleSave = () => {
    const saveData = {
      ...form,
      offerings: form.offerings.split(',').map(s => s.trim()).filter(Boolean)
    };
    onSave(saveData);
    setEditing(false);
  };

  const isEmpty = !profile || Object.keys(profile).length === 0 || !profile.name;

  return (
    <Paper sx={{
      p: 3, mb: 3,
      background: isEmpty
        ? `linear-gradient(135deg, ${alpha('#f59e0b', 0.15)} 0%, ${alpha('#ef4444', 0.05)} 100%)`
        : `linear-gradient(135deg, ${alpha(BRAND.primary, 0.1)} 0%, ${alpha(BRAND.secondary, 0.05)} 100%)`,
      border: `1px solid ${alpha(isEmpty ? '#f59e0b' : BRAND.primary, 0.2)}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 44, height: 44,
            background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
          }}>
            <BusinessIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {isEmpty ? '⚠️ Set Up Your Business Profile' : (profile.name || 'Business Profile')}
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              {isEmpty
                ? 'Ace needs to know about your business to help you effectively'
                : `${profile.industry || 'Business'} • ${profile.location || 'Location not set'}`}
            </Typography>
          </Box>
        </Box>
        <Button
          variant={editing ? 'contained' : 'outlined'}
          startIcon={editing ? <SaveIcon /> : <EditIcon />}
          onClick={editing ? handleSave : () => setEditing(true)}
          size="small"
        >
          {editing ? 'Save' : 'Edit'}
        </Button>
      </Box>

      {isEmpty && !editing && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            👋 Tell Ace about yourself and your business so every department knows how to help you.
          </Typography>
          <Button variant="contained" onClick={() => setEditing(true)} startIcon={<EditIcon />}>
            Set Up Now
          </Button>
        </Box>
      )}

      {editing && (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Your Name"
              value={form.ownerName || ''}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              placeholder="e.g., Eric"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Company Name"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., LikeMindedPro"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Industry"
              value={form.industry || ''}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g., Digital Services & Web Hosting"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Location"
              value={form.location || ''}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g., Miami, FL"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Mission / What does your company do?"
              value={form.mission || ''}
              onChange={(e) => setForm({ ...form, mission: e.target.value })}
              placeholder="e.g., Provide affordable web hosting and digital services to small businesses"
              multiline rows={2}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Target Audience"
              value={form.targetAudience || ''}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              placeholder="e.g., Small businesses, freelancers, startups"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" label="Website"
              value={form.website || ''}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="e.g., https://likemindedpro.com"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Key Offerings (comma-separated)"
              value={form.offerings || ''}
              onChange={(e) => setForm({ ...form, offerings: e.target.value })}
              placeholder="e.g., Web Hosting, Website Design, SEO, Digital Marketing"
            />
          </Grid>
        </Grid>
      )}

      {!editing && !isEmpty && (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {profile.ownerName && (
            <Grid item xs={6} sm={4}>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Owner</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.ownerName}</Typography>
            </Grid>
          )}
          {profile.mission && (
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Mission</Typography>
              <Typography variant="body2">{profile.mission}</Typography>
            </Grid>
          )}
          {profile.targetAudience && (
            <Grid item xs={6} sm={4}>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Target Audience</Typography>
              <Typography variant="body2">{profile.targetAudience}</Typography>
            </Grid>
          )}
          {profile.offerings && (
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>Offerings</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {(Array.isArray(profile.offerings) ? profile.offerings : []).map((o, i) => (
                  <Chip key={i} label={o} size="small" color="primary" variant="outlined" />
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Paper>
  );
}

function DesktopControlSection({ onSnackbar }) {
  const [autonomy, setAutonomy] = useState(null);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAutonomy = async () => {
    try {
      const res = await fetch('/api/desktop-autonomy');
      const data = await res.json();
      if (data.success) setAutonomy(data.data);
    } catch (e) {
      console.error('Failed to load desktop autonomy:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAutonomy(); }, []);

  const handleToggle = (checked) => {
    if (checked && (!autonomy?.consentGiven)) {
      // Show consent dialog for first-time enable
      setConsentDialogOpen(true);
    } else {
      // Just toggle on/off (consent already given)
      updateAutonomy({ enabled: checked });
    }
  };

  const handleConsent = async () => {
    setConsentDialogOpen(false);
    await updateAutonomy({ consent: true, enabled: true });
  };

  const updateAutonomy = async (body) => {
    try {
      const res = await fetch('/api/desktop-autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setAutonomy(data.data);
        const status = data.data.desktopControlEnabled ? 'enabled' : 'disabled';
        onSnackbar?.({ open: true, message: `🖥️ Desktop control ${status}`, severity: 'success' });
      }
    } catch (e) {
      onSnackbar?.({ open: true, message: 'Failed to update desktop control', severity: 'error' });
    }
  };

  if (loading || !autonomy) return null;

  const isEnabled = autonomy.desktopControlEnabled;
  const controlColor = isEnabled ? '#10b981' : '#6b7280';

  return (
    <>
      <Paper sx={{
        p: 3, mb: 3,
        background: isEnabled
          ? `linear-gradient(135deg, ${alpha('#10b981', 0.1)} 0%, ${alpha('#06b6d4', 0.05)} 100%)`
          : `linear-gradient(135deg, ${alpha('#6b7280', 0.08)} 0%, ${alpha('#6b7280', 0.02)} 100%)`,
        border: `1px solid ${alpha(controlColor, 0.2)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{
              width: 44, height: 44,
              background: isEnabled
                ? `linear-gradient(135deg, #10b981, #06b6d4)`
                : `linear-gradient(135deg, #6b7280, #9ca3af)`,
              boxShadow: isEnabled ? `0 4px 12px ${alpha('#10b981', 0.3)}` : 'none',
            }}>
              <DesktopWindowsIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Desktop Control
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                {isEnabled
                  ? '✅ Ace can control your Mac — apps, keyboard, mouse, files'
                  : '🔒 Desktop control is disabled'}
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={isEnabled}
            onChange={(e) => handleToggle(e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
            }}
          />
        </Box>

        {isEnabled && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
            {(autonomy.allowedActions || []).map((action, i) => (
              <Chip key={i} label={action} size="small" sx={{
                fontSize: '0.7rem', height: 22,
                backgroundColor: alpha('#10b981', 0.1),
                color: '#10b981',
                border: `1px solid ${alpha('#10b981', 0.2)}`
              }} />
            ))}
            {autonomy.consentDate && (
              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', ml: 1, color: BRAND.textSecondary }}>
                <SecurityIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Consent given: {new Date(autonomy.consentDate).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        )}

        {isEnabled && autonomy.blockedApps?.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
              🚫 Blocked apps: {autonomy.blockedApps.join(', ')}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Consent Warning Dialog */}
      <Dialog
        open={consentDialogOpen}
        onClose={() => setConsentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            border: `2px solid ${alpha('#f59e0b', 0.5)}`,
            background: `linear-gradient(180deg, ${alpha('#f59e0b', 0.05)} 0%, #1a1a2e 30%)`,
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              ⚠️ Full Desktop Control
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              This grants Ace significant control over your computer
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This allows Ace to control your mouse, keyboard, open apps, and manage files on this computer.
          </Typography>

          <Paper sx={{ p: 2, mb: 2, background: alpha('#f59e0b', 0.05), border: `1px solid ${alpha('#f59e0b', 0.2)}` }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Ace will be able to:
            </Typography>
            <List dense disablePadding>
              <ListItem disableGutters sx={{ py: 0.3 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><MouseIcon sx={{ fontSize: 18, color: '#f59e0b' }} /></ListItemIcon>
                <ListItemText primary="Move your mouse and click" primaryTypographyProps={{ fontSize: '0.85rem' }} />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.3 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><KeyboardIcon sx={{ fontSize: 18, color: '#f59e0b' }} /></ListItemIcon>
                <ListItemText primary="Type on your keyboard" primaryTypographyProps={{ fontSize: '0.85rem' }} />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.3 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><AppsIcon sx={{ fontSize: 18, color: '#f59e0b' }} /></ListItemIcon>
                <ListItemText primary="Open and close applications" primaryTypographyProps={{ fontSize: '0.85rem' }} />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.3 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><FolderOpenIcon sx={{ fontSize: 18, color: '#f59e0b' }} /></ListItemIcon>
                <ListItemText primary="Navigate files and folders" primaryTypographyProps={{ fontSize: '0.85rem' }} />
              </ListItem>
            </List>
          </Paper>

          <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
            You can disable this at any time from this page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConsentDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConsent}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #d97706, #dc2626)' }
            }}
          >
            I Understand the Risks — Enable
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function AceMemorySection({ onSnackbar }) {
  const [memoryStats, setMemoryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchMemoryStats = async () => {
    try {
      const res = await fetch('/api/memory/stats');
      const data = await res.json();
      if (data.success) setMemoryStats(data.data);
    } catch (e) {
      console.error('Failed to load memory stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMemoryStats(); }, []);

  const handleClearMemory = async () => {
    if (!window.confirm('Are you sure you want to clear all of Ace\'s memory? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/memory/clear', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        onSnackbar?.({ open: true, message: `🧹 ${data.message}`, severity: 'success' });
        fetchMemoryStats();
      }
    } catch (e) {
      onSnackbar?.({ open: true, message: 'Failed to clear memory', severity: 'error' });
    } finally {
      setClearing(false);
    }
  };

  if (loading) return null;

  const research = memoryStats?.research || { totalSessions: 0, recent24h: 0, topics: [] };
  const corrections = memoryStats?.corrections || { totalCorrections: 0, totalApplied: 0, topics: [], recentCorrections: [] };
  const totalMemory = research.totalSessions + corrections.totalCorrections;
  const memoryColor = totalMemory > 0 ? '#8b5cf6' : '#6b7280';

  return (
    <Paper sx={{
      p: 3, mb: 3,
      background: totalMemory > 0
        ? `linear-gradient(135deg, ${alpha('#8b5cf6', 0.1)} 0%, ${alpha('#6366f1', 0.05)} 100%)`
        : `linear-gradient(135deg, ${alpha('#6b7280', 0.08)} 0%, ${alpha('#6b7280', 0.02)} 100%)`,
      border: `1px solid ${alpha(memoryColor, 0.2)}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 44, height: 44,
            background: `linear-gradient(135deg, #8b5cf6, #6366f1)`,
            boxShadow: totalMemory > 0 ? `0 4px 12px ${alpha('#8b5cf6', 0.3)}` : 'none',
          }}>
            <PsychologyIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Ace's Memory
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              {totalMemory > 0
                ? `${totalMemory} memories — Ace learns from every interaction`
                : 'No memories saved yet — Ace will learn as you interact'}
            </Typography>
          </Box>
        </Box>
        {totalMemory > 0 && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteSweepIcon />}
            onClick={handleClearMemory}
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear Memory'}
          </Button>
        )}
      </Box>

      <Grid container spacing={2}>
        {/* Research Memory Card */}
        <Grid item xs={12} sm={6}>
          <Card sx={{
            border: `1px solid ${alpha('#10b981', 0.2)}`,
            background: alpha('#10b981', 0.04),
          }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScienceIcon sx={{ color: '#10b981', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Research Memory</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {research.totalSessions}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                    Saved sessions
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {research.recent24h}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                    Last 24h
                  </Typography>
                </Box>
              </Box>
              {research.topics.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: 'block', mb: 0.5 }}>
                    Recent topics:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {research.topics.slice(0, 4).map((t, i) => (
                      <Chip key={i} label={t.query?.substring(0, 30) || 'research'} size="small" sx={{
                        fontSize: '0.65rem', height: 20,
                        backgroundColor: alpha('#10b981', 0.1),
                        color: '#10b981',
                        border: `1px solid ${alpha('#10b981', 0.2)}`
                      }} />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Corrections Memory Card */}
        <Grid item xs={12} sm={6}>
          <Card sx={{
            border: `1px solid ${alpha('#f59e0b', 0.2)}`,
            background: alpha('#f59e0b', 0.04),
          }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SchoolIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Corrections Learned</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    {corrections.totalCorrections}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                    Corrections
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    {corrections.totalApplied}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                    Times applied
                  </Typography>
                </Box>
              </Box>
              {corrections.recentCorrections?.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: 'block', mb: 0.5 }}>
                    Recent corrections:
                  </Typography>
                  {corrections.recentCorrections.slice(0, 2).map((c, i) => (
                    <Typography key={i} variant="caption" sx={{
                      display: 'block', color: BRAND.textSecondary, fontSize: '0.7rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      📝 {c.correction}
                    </Typography>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
}

function RoutingHistorySection() {
  const [routeHistory, setRouteHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filterDept, setFilterDept] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/departments/history');
        const data = await res.json();
        if (data.success) setRouteHistory((data.data || []).reverse());
      } catch (e) {
        console.error('Failed to load routing history:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 15000);
    return () => clearInterval(interval);
  }, []);

  const allDepts = [...new Set(routeHistory.map(r => r.department).filter(Boolean))];
  const filtered = filterDept === 'all' ? routeHistory : routeHistory.filter(r => r.department === filterDept);

  if (loading) return null;

  return (
    <Paper sx={{
      p: 3, mb: 3,
      background: `linear-gradient(135deg, ${alpha(BRAND.accent, 0.06)} 0%, ${alpha(BRAND.primary, 0.03)} 100%)`,
      border: `1px solid ${alpha(BRAND.accent, 0.15)}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 44, height: 44,
            background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
            boxShadow: routeHistory.length > 0 ? `0 4px 12px ${alpha(BRAND.accent, 0.3)}` : 'none',
          }}>
            <RouteIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Routing History
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              {routeHistory.length > 0
                ? `${routeHistory.length} routing decisions tracked`
                : 'No routing decisions yet — send Ace a message to see routing'}
            </Typography>
          </Box>
        </Box>
        {allDepts.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ fontSize: '0.8rem' }}>Filter</InputLabel>
            <Select
              value={filterDept}
              label="Filter"
              onChange={(e) => setFilterDept(e.target.value)}
              sx={{ fontSize: '0.8rem' }}
            >
              <MenuItem value="all">All Departments</MenuItem>
              {allDepts.map(d => (
                <MenuItem key={d} value={d}>
                  {d.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {filtered.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <RouteIcon sx={{ fontSize: 36, color: BRAND.textMuted, mb: 1 }} />
          <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
            {filterDept !== 'all' ? `No routes to ${filterDept.toUpperCase()}` : 'No routing history yet'}
          </Typography>
        </Box>
      ) : (
        <Box>
          {filtered.slice(0, 20).map((route, i) => {
            const color = DEPT_COLORS[route.department] || BRAND.textMuted;
            const icon = DEPT_ICONS[route.department] || <PersonIcon />;
            const isExpanded = expandedIdx === i;
            const conf = ((route.confidence || 0) * 100).toFixed(0);
            const time = route.timestamp ? new Date(route.timestamp).toLocaleString() : '';

            return (
              <Box key={i}>
                <Box
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    py: 1.2, px: 1.5,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    '&:hover': { background: alpha(color, 0.05) },
                    borderBottom: !isExpanded && i < filtered.length - 1 ? `1px solid ${alpha(BRAND.border, 0.3)}` : 'none',
                  }}
                >
                  <Avatar sx={{
                    width: 30, height: 30,
                    background: alpha(color, 0.15), color,
                  }}>
                    {React.cloneElement(icon, { sx: { fontSize: 16 } })}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{
                      color: BRAND.textPrimary, fontSize: '0.82rem', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {route.message || '—'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.3 }}>
                      <AccessTimeIcon sx={{ fontSize: 11, color: BRAND.textMuted }} />
                      <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
                        {time}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={route.department?.toUpperCase()}
                    size="small"
                    sx={{
                      height: 22, fontSize: '0.65rem', fontWeight: 700,
                      background: alpha(color, 0.12), color,
                      border: `1px solid ${alpha(color, 0.2)}`,
                    }}
                  />
                  <Tooltip title={`Confidence: ${conf}%`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{
                        width: 40, height: 6, borderRadius: 3,
                        background: alpha(BRAND.border, 0.3),
                      }}>
                        <Box sx={{
                          width: `${conf}%`, height: '100%', borderRadius: 3,
                          background: route.confidence > 0.7 ? BRAND.success :
                            route.confidence > 0.4 ? BRAND.warning : BRAND.error,
                          transition: 'width 0.3s',
                        }} />
                      </Box>
                      <Typography variant="caption" sx={{
                        fontSize: '0.65rem', fontWeight: 600, minWidth: 28,
                        color: route.confidence > 0.7 ? BRAND.success :
                          route.confidence > 0.4 ? BRAND.warning : BRAND.error,
                      }}>
                        {conf}%
                      </Typography>
                    </Box>
                  </Tooltip>
                  <IconButton size="small" sx={{ color: BRAND.textMuted }}>
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </Box>
                <Collapse in={isExpanded}>
                  <Box sx={{
                    ml: 6, mr: 2, mb: 1.5, p: 2,
                    background: alpha(color, 0.03),
                    border: `1px solid ${alpha(color, 0.1)}`,
                    borderRadius: 1.5,
                  }}>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 0.5 }}>
                      Full Message
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND.textPrimary, fontSize: '0.82rem', mb: 1.5 }}>
                      {route.message || 'No message recorded'}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Department</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color }}>
                          {route.department?.toUpperCase()}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Confidence</Typography>
                        <Typography variant="body2" sx={{
                          fontWeight: 600,
                          color: route.confidence > 0.7 ? BRAND.success :
                            route.confidence > 0.4 ? BRAND.warning : BRAND.error,
                        }}>
                          {conf}%
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Timestamp</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {time || 'Unknown'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}

function AddBusinessDialog({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '', ownerName: '', industry: '', mission: '',
    targetAudience: '', offerings: '', location: '', website: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onAdd({
      ...form,
      offerings: form.offerings.split(',').map(s => s.trim()).filter(Boolean),
    });
    setSaving(false);
    setForm({ name: '', ownerName: '', industry: '', mission: '', targetAudience: '', offerings: '', location: '', website: '' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})` }}>
          <AddIcon />
        </Avatar>
        Add a New Business
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Company Name *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., My New Business" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Your Name" value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              placeholder="e.g., Eric" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Industry" value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g., E-commerce" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Location" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g., New York, NY" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Mission" value={form.mission}
              onChange={(e) => setForm({ ...form, mission: e.target.value })}
              placeholder="What does this business do?" multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Target Audience" value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              placeholder="e.g., Small businesses" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Website" value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="e.g., https://example.com" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Key Offerings (comma-separated)" value={form.offerings}
              onChange={(e) => setForm({ ...form, offerings: e.target.value })}
              placeholder="e.g., Consulting, Training, Software" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!form.name.trim() || saving}
          startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}>
          {saving ? 'Adding...' : 'Add Business'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Organization() {
  const [departments, setDepartments] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = async () => {
    try {
      const [deptRes, bizRes] = await Promise.allSettled([
        fetch('/api/departments').then(r => r.json()),
        fetch('/api/businesses').then(r => r.json()),
      ]);
      if (deptRes.status === 'fulfilled' && deptRes.value.success) {
        setDepartments(deptRes.value.data || []);
      }
      if (bizRes.status === 'fulfilled' && bizRes.value.success) {
        setBusinesses(bizRes.value.data.businesses || []);
        setActiveId(bizRes.value.data.activeId);
      }
    } catch (e) {
      console.error('Failed to load organization data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (deptId, enabled) => {
    try {
      await fetch(`/api/departments/${deptId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, enabled } : d));
      setSnackbar({ open: true, message: `${deptId.toUpperCase()} department ${enabled ? 'enabled' : 'disabled'}`, severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update department', severity: 'error' });
    }
  };

  const handleSaveBusiness = async (id, data) => {
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setBusinesses(prev => prev.map(b => b.id === id ? result.data : b));
        setSnackbar({ open: true, message: '✅ Business profile saved!', severity: 'success' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to save profile', severity: 'error' });
    }
  };

  const handleAddBusiness = async (data) => {
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setBusinesses(prev => [...prev, result.data]);
        setAddDialogOpen(false);
        setSnackbar({ open: true, message: `"${result.data.name}" added!`, severity: 'success' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to add business', severity: 'error' });
    }
  };

  const handleDeleteBusiness = async (id) => {
    const biz = businesses.find(b => b.id === id);
    if (!window.confirm(`Delete "${biz?.name || id}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setBusinesses(prev => prev.filter(b => b.id !== id));
        setSnackbar({ open: true, message: `"${biz?.name}" deleted`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: result.error || 'Cannot delete', severity: 'warning' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to delete business', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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
            <GroupsIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Organization
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Manage your businesses, desktop control, and Ace's memory
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Businesses Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon fontSize="small" /> Your Businesses
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Business
        </Button>
      </Box>

      {businesses.length === 0 ? (
        <Paper sx={{
          p: 4, mb: 3, textAlign: 'center',
          background: `linear-gradient(135deg, ${alpha('#f59e0b', 0.15)} 0%, ${alpha('#ef4444', 0.05)} 100%)`,
          border: `1px solid ${alpha('#f59e0b', 0.2)}`,
        }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            No businesses set up yet. Add your first business so Ace knows how to help you.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)}>
            Add Your First Business
          </Button>
        </Paper>
      ) : (
        businesses.map(biz => (
          <Box key={biz.id} sx={{ position: 'relative', mb: 1 }}>
            {biz.id === activeId && (
              <Chip
                icon={<StarIcon sx={{ fontSize: 14 }} />}
                label="Active"
                size="small"
                color="success"
                sx={{
                  position: 'absolute', top: 12, right: 12, zIndex: 1,
                  fontWeight: 700, fontSize: '0.7rem',
                }}
              />
            )}
            {businesses.length > 1 && biz.id !== activeId && (
              <IconButton
                size="small"
                onClick={() => handleDeleteBusiness(biz.id)}
                sx={{
                  position: 'absolute', top: 10, right: 52, zIndex: 1,
                  color: BRAND.textMuted,
                  '&:hover': { color: '#ef4444' },
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
            <BusinessProfileEditor
              profile={biz}
              onSave={(data) => handleSaveBusiness(biz.id, data)}
            />
          </Box>
        ))
      )}

      {/* Add Business Dialog */}
      <AddBusinessDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddBusiness}
      />

      {/* Desktop Control — Autonomy Consent */}
      <DesktopControlSection onSnackbar={setSnackbar} />

      {/* Ace's Memory — Research & Corrections */}
      <AceMemorySection onSnackbar={setSnackbar} />

      {/* Routing History */}
      <RoutingHistorySection />

      {/* Department Grid */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsIcon fontSize="small" /> Departments
      </Typography>
      
      <Grid container spacing={2}>
        {departments.map(dept => (
          <Grid item xs={12} sm={6} md={4} key={dept.id}>
            <DepartmentCard dept={dept} onToggle={handleToggle} />
          </Grid>
        ))}
        {departments.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: BRAND.textSecondary }}>
                No departments loaded. The department system may still be initializing...
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
