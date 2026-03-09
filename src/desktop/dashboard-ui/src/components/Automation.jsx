import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, Grid, alpha, Button, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Skeleton
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AceSpadeIcon from './AceSpadeIcon';
import TelegramIcon from '@mui/icons-material/Telegram';
import RefreshIcon from '@mui/icons-material/Refresh';
import { BRAND } from '../theme';

const INSIGHT_ICONS = {
  warning: <WarningAmberIcon />,
  suggestion: <TipsAndUpdatesIcon />,
  opportunity: <LightbulbIcon />,
  info: <CheckCircleIcon />,
};

const INSIGHT_COLORS = {
  warning: BRAND.warning,
  suggestion: BRAND.info,
  opportunity: BRAND.success,
  info: BRAND.primaryLight,
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Automation() {
  const [routines, setRoutines] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [newRoutine, setNewRoutine] = useState({ name: '', time: '09:00', type: 'briefing', prompt: '', sopIds: [], days: [1,2,3,4,5] });

  const fetchData = async () => {
    try {
      const [routinesRes, statusRes, insightsRes] = await Promise.allSettled([
        fetch('/api/scheduler/routines').then(r => r.json()),
        fetch('/api/scheduler/status').then(r => r.json()),
        fetch('/api/insights').then(r => r.json()),
      ]);

      if (routinesRes.status === 'fulfilled' && routinesRes.value.success) setRoutines(routinesRes.value.data || []);
      if (statusRes.status === 'fulfilled' && statusRes.value.success) setSchedulerStatus(statusRes.value.data);
      if (insightsRes.status === 'fulfilled' && insightsRes.value.success) setInsights(insightsRes.value.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (id) => {
    try {
      await fetch(`/api/scheduler/routines/${id}/toggle`, { method: 'POST' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/scheduler/routines/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleRunNow = async (id) => {
    try {
      await fetch(`/api/scheduler/routines/${id}/run`, { method: 'POST' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    try {
      await fetch('/api/scheduler/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoutine),
      });
      setAddDialog(false);
      setNewRoutine({ name: '', time: '09:00', sopIds: [], days: [1,2,3,4,5] });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleCheckInsights = async () => {
    try {
      await fetch('/api/insights/check', { method: 'POST' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleReadInsight = async (id) => {
    try {
      await fetch(`/api/insights/${id}/read`, { method: 'POST' });
      setInsights(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
    } catch (e) { console.error(e); }
  };

  const unreadInsights = insights.filter(i => !i.read);

  return (
    <Box sx={{ maxWidth: 1200 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.warning, 0.1)} 0%, ${alpha(BRAND.secondary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.warning, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.warning}, ${BRAND.secondary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.warning, 0.3)}`,
          }}>
            <ScheduleIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Automation & Insights
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Scheduled routines, proactive insights, and autonomous actions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Chip
              icon={<FiberManualRecordIcon sx={{
                fontSize: '8px !important',
                color: `${schedulerStatus?.running ? BRAND.success : BRAND.textMuted} !important`,
              }} />}
              label={schedulerStatus?.running ? 'Scheduler Active' : 'Inactive'}
              size="small"
              sx={{
                background: alpha(schedulerStatus?.running ? BRAND.success : BRAND.textMuted, 0.1),
                color: schedulerStatus?.running ? BRAND.success : BRAND.textMuted,
                fontWeight: 600,
              }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setAddDialog(true)}
            >
              Add Routine
            </Button>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Proactive Insights */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LightbulbIcon sx={{ color: BRAND.warning, fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  Ace's Insights
                </Typography>
                {unreadInsights.length > 0 && (
                  <Chip label={unreadInsights.length} size="small" sx={{
                    height: 20, fontSize: '0.65rem', fontWeight: 700,
                    background: BRAND.warning, color: '#000',
                  }} />
                )}
              </Box>
              <IconButton size="small" onClick={handleCheckInsights} sx={{ color: BRAND.textMuted }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {insights.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 400, overflow: 'auto' }}>
                {insights.slice().reverse().map(insight => {
                  const color = INSIGHT_COLORS[insight.type] || BRAND.primaryLight;
                  const icon = INSIGHT_ICONS[insight.type] || <LightbulbIcon />;
                  return (
                    <Box key={insight.id} sx={{
                      display: 'flex', gap: 1.5, p: 1.5, borderRadius: 2,
                      background: insight.read ? 'transparent' : alpha(color, 0.04),
                      border: `1px solid ${insight.read ? alpha(BRAND.border, 0.5) : alpha(color, 0.15)}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { background: alpha(color, 0.06) },
                    }}
                    onClick={() => handleReadInsight(insight.id)}
                    >
                      <Avatar sx={{
                        width: 28, height: 28,
                        background: alpha(color, 0.15),
                        color: color,
                      }}>
                        {React.cloneElement(icon, { sx: { fontSize: 15 } })}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{
                          fontWeight: insight.read ? 400 : 600,
                          color: BRAND.textPrimary, fontSize: '0.8rem',
                        }}>
                          {insight.title || insight.message}
                        </Typography>
                        {insight.suggestion && (
                          <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block' }}>
                            💡 {insight.suggestion}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
                          {new Date(insight.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      {!insight.read && (
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: color, flexShrink: 0, mt: 0.5,
                        }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <LightbulbIcon sx={{ fontSize: 36, color: BRAND.textMuted, mb: 1 }} />
                <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                  No insights yet. Ace monitors your pipeline and suggests improvements.
                </Typography>
                <Button size="small" onClick={handleCheckInsights} sx={{ mt: 1, color: BRAND.primaryLight }}>
                  Run Check Now
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Scheduled Routines */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon sx={{ color: BRAND.secondary, fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  Scheduled Routines
                </Typography>
              </Box>
              <Chip
                label={`${schedulerStatus?.enabledCount || 0} active`}
                size="small"
                sx={{
                  background: alpha(BRAND.success, 0.1),
                  color: BRAND.success,
                  fontWeight: 600,
                }}
              />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={70} />)}
              </Box>
            ) : routines.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {routines.map(routine => {
                  const nextRun = schedulerStatus?.timers?.[routine.id]?.nextRun;
                  return (
                    <Paper key={routine.id} sx={{
                      p: 2,
                      border: `1px solid ${alpha(routine.enabled ? BRAND.success : BRAND.textMuted, 0.15)}`,
                      background: alpha(routine.enabled ? BRAND.success : BRAND.textMuted, 0.03),
                      transition: 'all 0.2s',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Switch
                          checked={routine.enabled}
                          onChange={() => handleToggle(routine.id)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.success },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: BRAND.success },
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                              {routine.name}
                            </Typography>
                            {routine.type === 'briefing' && (
                              <Chip
                                icon={<AceSpadeIcon sx={{ fontSize: '10px !important' }} />}
                                label="Briefing"
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem', fontWeight: 700,
                                  background: alpha(BRAND.info, 0.12),
                                  color: BRAND.info,
                                }}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                            <Chip
                              icon={<AccessTimeIcon sx={{ fontSize: '12px !important' }} />}
                              label={routine.time}
                              size="small"
                              sx={{
                                height: 20, fontSize: '0.65rem',
                                background: alpha(BRAND.primary, 0.08),
                                color: BRAND.primaryLight,
                              }}
                            />
                            <Box sx={{ display: 'flex', gap: 0.25 }}>
                              {[0,1,2,3,4,5,6].map(d => (
                                <Typography key={d} variant="caption" sx={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.55rem', fontWeight: 600,
                                  background: routine.days?.includes(d) ? alpha(BRAND.secondary, 0.15) : 'transparent',
                                  color: routine.days?.includes(d) ? BRAND.secondary : BRAND.textMuted,
                                }}>
                                  {DAY_LABELS[d][0]}
                                </Typography>
                              ))}
                            </Box>
                            {routine.runCount > 0 && (
                              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
                                {routine.runCount} runs
                              </Typography>
                            )}
                          </Box>
                          {nextRun && (
                            <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
                              Next: {new Date(nextRun).toLocaleString()}
                            </Typography>
                          )}
                          {routine.type === 'briefing' && routine.prompt && (
                            <Typography variant="caption" sx={{
                              color: BRAND.textMuted, fontSize: '0.65rem',
                              display: 'block', mt: 0.25,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              📝 {routine.prompt.slice(0, 80)}{routine.prompt.length > 80 ? '…' : ''}
                            </Typography>
                          )}
                          {routine.type === 'briefing' && routine.sendToTelegram !== false && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <TelegramIcon sx={{ fontSize: 11, color: BRAND.info }} />
                              <Typography variant="caption" sx={{ color: BRAND.info, fontSize: '0.6rem' }}>
                                Sends to Telegram
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleRunNow(routine.id)}
                            sx={{ color: BRAND.success, '&:hover': { background: alpha(BRAND.success, 0.08) } }}
                          >
                            <PlayArrowIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(routine.id)}
                            sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error, background: alpha(BRAND.error, 0.08) } }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ py: 3, px: 2 }}>
                <ScheduleIcon sx={{ fontSize: 36, color: BRAND.textMuted, mb: 1, display: 'block', mx: 'auto' }} />
                <Typography variant="body2" sx={{ color: BRAND.textSecondary, textAlign: 'center', mb: 2 }}>
                  Routines let Ace work on autopilot. Here are the defaults:
                </Typography>
                <Box sx={{ pl: 1, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5 }}>
                    <strong>Morning Briefing</strong> — Ace summarizes your day at 9:15 AM
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 0.5 }}>
                    <strong>Pipeline Grooming</strong> — Ace checks on your leads at 10:30 AM
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 1.5 }}>
                    <strong>Evening Review</strong> — Ace wraps up at 5:30 PM
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                    <strong>Add your own:</strong> In chat, say <em>"Every day at 10am, find me new leads in Dallas"</em>
                    <br />Ace will create the routine automatically.
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>

          {/* Execution History */}
          {schedulerStatus?.recentHistory?.length > 0 && (
            <Paper sx={{ p: 2.5, mt: 2 }}>
              <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 1.5 }}>
                Recent Executions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {schedulerStatus.recentHistory.slice(-5).reverse().map((entry, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                    {entry.success
                      ? <CheckCircleIcon sx={{ fontSize: 16, color: BRAND.success }} />
                      : <WarningAmberIcon sx={{ fontSize: 16, color: BRAND.error }} />}
                    <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem', flex: 1 }}>
                      {entry.type || 'routine'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Add Routine Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Add Scheduled Routine
          <IconButton size="small" onClick={() => setAddDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {/* Routine type selector */}
          <Box>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 1 }}>Routine Type</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[
                { value: 'briefing', label: '🧠 AI Briefing', desc: 'Ask Ace a question on schedule' },
                { value: 'sop', label: '🖥️ Browser SOP', desc: 'Run a recorded browser automation' },
              ].map(opt => (
                <Box
                  key={opt.value}
                  onClick={() => setNewRoutine({ ...newRoutine, type: opt.value })}
                  sx={{
                    flex: 1, p: 1.5, borderRadius: 2, cursor: 'pointer',
                    border: `1px solid ${newRoutine.type === opt.value ? alpha(BRAND.primary, 0.5) : alpha(BRAND.border, 0.5)}`,
                    background: newRoutine.type === opt.value ? alpha(BRAND.primary, 0.06) : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>{opt.label}</Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>{opt.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <TextField
            label="Routine Name"
            placeholder={newRoutine.type === 'briefing' ? 'e.g., Morning Briefing' : 'e.g., Morning Login'}
            value={newRoutine.name}
            onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
            fullWidth
          />

          {newRoutine.type === 'briefing' && (
            <TextField
              label="What should Ace report on?"
              placeholder="e.g., Give me a summary of today's top pipeline tasks and any leads that need follow-up."
              value={newRoutine.prompt}
              onChange={(e) => setNewRoutine({ ...newRoutine, prompt: e.target.value })}
              fullWidth
              multiline
              rows={3}
              helperText="Ace will answer this question and send the result to Telegram."
            />
          )}

          <TextField
            label="Time"
            type="time"
            value={newRoutine.time}
            onChange={(e) => setNewRoutine({ ...newRoutine, time: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Box>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mb: 1 }}>Active Days</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {DAY_LABELS.map((label, i) => (
                <Chip
                  key={i}
                  label={label}
                  size="small"
                  onClick={() => {
                    const days = newRoutine.days.includes(i)
                      ? newRoutine.days.filter(d => d !== i)
                      : [...newRoutine.days, i].sort();
                    setNewRoutine({ ...newRoutine, days });
                  }}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    background: newRoutine.days.includes(i) ? alpha(BRAND.primary, 0.15) : alpha(BRAND.textMuted, 0.08),
                    color: newRoutine.days.includes(i) ? BRAND.primary : BRAND.textMuted,
                    border: `1px solid ${newRoutine.days.includes(i) ? alpha(BRAND.primary, 0.3) : 'transparent'}`,
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newRoutine.name.trim() || (newRoutine.type === 'briefing' && !newRoutine.prompt.trim())}
          >
            Add Routine
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Automation;
