import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, alpha, Switch, Chip, Avatar, Slider,
  Button, Divider, TextField, FormControlLabel, IconButton, Snackbar
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
import { BRAND } from '../theme';
import Console from './Console';

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

function Settings() {
  const [permissions, setPermissions] = useState(null);
  const [toolGroups, setToolGroups] = useState(null);
  const [disabledTools, setDisabledTools] = useState(new Set());
  const [toolsSaving, setToolsSaving] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [toolSnack, setToolSnack] = useState('');

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
      // Map number back to string for local state
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
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.7rem', color: BRAND.textMuted,
                  },
                  '& .MuiSlider-thumb': {
                    boxShadow: `0 0 10px ${alpha(BRAND.primary, 0.4)}`,
                  },
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
                          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                            {group.description}
                          </Typography>
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

      {/* ── THE ONE COMMAND YOU NEED ── */}
      <Box sx={{
        p: 2.5, mb: 3, borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(BRAND.success, 0.12)} 0%, ${alpha(BRAND.success, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.success, 0.3)}`,
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BRAND.success, mb: 0.5 }}>
          ✅ Start / Restart OpenAce
        </Typography>
        <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: 'block', mb: 1.5 }}>
          This is the only command you need for day-to-day use.
          To restart: press <strong>Ctrl+C</strong> in the terminal to stop, then run this again.
        </Typography>
        <CommandBlock command="npm start" />
      </Box>

      <Grid container spacing={3}>
        {/* Running & Other Modes */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 600, color: BRAND.primaryLight, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <TerminalIcon sx={{ fontSize: 16 }} /> Other Run Modes
          </Typography>

          <CommandBlock
            description="Force restart (if port 3333 is stuck)"
            command="kill $(lsof -ti:3333); npm start"
          />
          <CommandBlock
            description="Start Telegram bot (separate process)"
            command="npm run telegram"
          />
          <CommandBlock
            description="Run with PM2 (keeps running after terminal closes)"
            command="pm2 start ecosystem.config.cjs"
          />
          <CommandBlock
            description="Restart with PM2"
            command="pm2 restart openace-dashboard"
          />
          <CommandBlock
            description="View PM2 logs"
            command="pm2 logs openace-dashboard"
          />
          <CommandBlock
            description="Stop PM2"
            command="pm2 stop all"
          />
        </Grid>

        {/* Setup */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 600, color: BRAND.warning, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <BuildIcon sx={{ fontSize: 16 }} /> Setup & Integrations
          </Typography>

          <CommandBlock
            description="Install all dependencies (first time only)"
            command="npm install"
          />
          <CommandBlock
            description="Run first-time setup wizard"
            command="npm run setup"
          />
          <CommandBlock
            description="Re-connect Google (Gmail, Calendar, Drive)"
            command="npm run setup-google"
          />
          <CommandBlock
            description="Setup Zoom integration"
            command="npm run setup-zoom"
          />
        </Grid>

        {/* Dashboard Development */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 600, color: BRAND.accent, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <BuildIcon sx={{ fontSize: 16 }} /> Dashboard Development
          </Typography>

          <CommandBlock
            description="Rebuild the dashboard UI after code changes"
            command="cd src/desktop/dashboard-ui && npm run build"
          />
          <CommandBlock
            description="Rebuild dashboard then restart server"
            command="cd src/desktop/dashboard-ui && npm run build && cd ../../.. && npm start"
          />
          <CommandBlock
            description="Dev mode with hot reload (dashboard only)"
            command="cd src/desktop/dashboard-ui && npm run dev"
          />
        </Grid>

        {/* Maintenance */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 600, color: BRAND.info, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <StorageIcon sx={{ fontSize: 16 }} /> Maintenance
          </Typography>

          <CommandBlock
            description="Check server is running"
            command="curl http://localhost:3333/api/health"
          />
          <CommandBlock
            description="Update dependencies"
            command="npm install"
          />
          <CommandBlock
            description="View server logs"
            command="cat logs/openace.log"
          />
          <CommandBlock
            description="Clear activity data"
            command="rm data/activity/activity.json"
          />
        </Grid>

        {/* URLs & Endpoints */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" sx={{
            fontWeight: 600, color: BRAND.secondary, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
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
