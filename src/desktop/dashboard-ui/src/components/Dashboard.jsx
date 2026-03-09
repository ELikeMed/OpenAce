import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, LinearProgress, Avatar, alpha, Skeleton,
  Collapse, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Tab, Tabs
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AceSpadeIcon from './AceSpadeIcon';
import SearchIcon from '@mui/icons-material/Search';
import SchoolIcon from '@mui/icons-material/School';
import RouteIcon from '@mui/icons-material/AltRoute';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CodeIcon from '@mui/icons-material/Code';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WebIcon from '@mui/icons-material/Web';
import EmailIcon from '@mui/icons-material/Email';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { BRAND } from '../theme';

const DEPT_COLORS = {
  ceo: '#6366f1', cto: '#06b6d4', cmo: '#f59e0b',
  research: '#10b981', admin: '#8b5cf6', browser: '#ef4444',
};
const DEPT_ICONS = {
  ceo: <TrendingUpIcon sx={{ fontSize: 16 }} />,
  cto: <CodeIcon sx={{ fontSize: 16 }} />,
  cmo: <CampaignIcon sx={{ fontSize: 16 }} />,
  research: <SearchIcon sx={{ fontSize: 16 }} />,
  admin: <CalendarMonthIcon sx={{ fontSize: 16 }} />,
  browser: <WebIcon sx={{ fontSize: 16 }} />,
};

// Stat card component
function StatCard({ icon, label, value, color, trend, loading }) {
  return (
    <Paper sx={{
      p: 2.5,
      background: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(color, 0.03)} 100%)`,
      border: `1px solid ${alpha(color, 0.15)}`,
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 25px ${alpha(color, 0.15)}`,
        border: `1px solid ${alpha(color, 0.3)}`,
      },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Avatar sx={{
          width: 44, height: 44,
          background: `linear-gradient(135deg, ${alpha(color, 0.2)} 0%, ${alpha(color, 0.1)} 100%)`,
          color: color,
        }}>
          {icon}
        </Avatar>
        {trend && (
          <Chip
            icon={<TrendingUpIcon sx={{ fontSize: '14px !important' }} />}
            label={trend}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 600,
              background: alpha(BRAND.success, 0.1),
              color: BRAND.success,
              border: `1px solid ${alpha(BRAND.success, 0.2)}`,
            }}
          />
        )}
      </Box>
      <Box sx={{ mt: 2 }}>
        {loading ? (
          <Skeleton variant="text" width={60} height={36} />
        ) : (
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.75rem', color: BRAND.textPrimary }}>
            {value ?? '—'}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: BRAND.textMuted, fontSize: '0.8rem', mt: 0.5 }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

// Activity timeline item
function ActivityItem({ action, index }) {
  const colors = [BRAND.primary, BRAND.secondary, BRAND.accent, BRAND.info, BRAND.warning];
  const color = colors[index % colors.length];
  const deptColor = action.department ? (DEPT_COLORS[action.department] || color) : color;

  return (
    <Box sx={{
      display: 'flex',
      gap: 2,
      py: 1.5,
      px: 2,
      borderRadius: 2,
      transition: 'background 0.2s ease',
      '&:hover': { background: alpha(BRAND.primary, 0.04) },
    }}>
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%', mt: 1,
        background: deptColor, flexShrink: 0,
        boxShadow: `0 0 8px ${alpha(deptColor, 0.4)}`,
      }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{
          color: BRAND.textPrimary, fontWeight: 500, fontSize: '0.85rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {action.action || 'Unknown Action'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {action.department && (
            <Chip
              label={action.department.toUpperCase()}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 600,
                background: alpha(deptColor, 0.1), color: deptColor,
                border: `1px solid ${alpha(deptColor, 0.2)}`,
              }}
            />
          )}
          <Chip
            label={action.type || 'system'}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 500,
              background: alpha(color, 0.1), color: color,
              border: `1px solid ${alpha(color, 0.2)}`,
            }}
          />
          <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.7rem' }}>
            {action.timestamp ? new Date(action.timestamp).toLocaleString() : ''}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// Live Department Activity Indicator
function DepartmentActivityBanner({ activeDept, progressMessage, connected }) {
  if (!activeDept && !progressMessage) {
    return (
      <Paper sx={{
        p: 2, mb: 2,
        display: 'flex', alignItems: 'center', gap: 2,
        border: `1px solid ${alpha(BRAND.success, 0.15)}`,
        background: alpha(BRAND.success, 0.03),
      }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondary})`,
        }}>
          <AceSpadeIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary, fontSize: '0.85rem' }}>
            Ace is standing by
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
            {connected ? 'Connected — waiting for tasks' : 'Connecting to event stream...'}
          </Typography>
        </Box>
        <Chip
          icon={<FiberManualRecordIcon sx={{
            fontSize: '8px !important',
            color: `${connected ? BRAND.success : BRAND.warning} !important`,
          }} />}
          label={connected ? 'Idle' : 'Connecting'}
          size="small"
          sx={{
            background: alpha(connected ? BRAND.success : BRAND.warning, 0.1),
            color: connected ? BRAND.success : BRAND.warning,
            fontWeight: 600, fontSize: '0.7rem',
          }}
        />
      </Paper>
    );
  }

  const deptColor = DEPT_COLORS[activeDept] || BRAND.primary;
  const deptIcon = DEPT_ICONS[activeDept] || <AceSpadeIcon sx={{ fontSize: 16 }} />;

  return (
    <Paper sx={{
      p: 2, mb: 2,
      display: 'flex', alignItems: 'center', gap: 2,
      border: `1px solid ${alpha(deptColor, 0.25)}`,
      background: `linear-gradient(135deg, ${alpha(deptColor, 0.08)} 0%, ${alpha(deptColor, 0.02)} 100%)`,
      animation: 'fadeIn 0.3s ease',
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
    }}>
      <Avatar sx={{
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${deptColor}, ${alpha(deptColor, 0.7)})`,
        boxShadow: `0 4px 12px ${alpha(deptColor, 0.3)}`,
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
          '0%,100%': { boxShadow: `0 0 0 0 ${alpha(deptColor, 0.3)}` },
          '50%': { boxShadow: `0 0 0 8px ${alpha(deptColor, 0)}` },
        },
      }}>
        {deptIcon}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: deptColor, fontSize: '0.85rem' }}>
            {activeDept ? activeDept.toUpperCase() + ' Department' : 'Working'}
          </Typography>
          <Chip
            icon={<FiberManualRecordIcon sx={{
              fontSize: '6px !important',
              color: `${BRAND.success} !important`,
              animation: 'blink 1s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />}
            label="Active"
            size="small"
            sx={{
              height: 18, fontSize: '0.6rem',
              background: alpha(BRAND.success, 0.1),
              color: BRAND.success,
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
          {progressMessage || 'Processing request...'}
        </Typography>
      </Box>
    </Paper>
  );
}

// Recent Routing Decisions (compact)
function RecentRoutingWidget({ routeHistory }) {
  const [expanded, setExpanded] = useState(false);

  if (!routeHistory || routeHistory.length === 0) return null;

  const display = expanded ? routeHistory.slice(0, 10) : routeHistory.slice(0, 4);

  return (
    <Paper sx={{ p: 2.5, mb: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RouteIcon sx={{ color: BRAND.primaryLight, fontSize: 20 }} />
          <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            Recent Routing
          </Typography>
        </Box>
        <Chip
          label={`${routeHistory.length} routes`}
          size="small"
          sx={{
            height: 20, fontSize: '0.65rem',
            background: alpha(BRAND.primary, 0.1),
            color: BRAND.primaryLight,
          }}
        />
      </Box>
      {display.map((route, i) => {
        const color = DEPT_COLORS[route.department] || BRAND.textMuted;
        return (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8,
            borderBottom: i < display.length - 1 ? `1px solid ${alpha(BRAND.border, 0.5)}` : 'none',
          }}>
            <Avatar sx={{
              width: 24, height: 24,
              background: alpha(color, 0.15),
              color: color,
            }}>
              {DEPT_ICONS[route.department] || <AceSpadeIcon sx={{ fontSize: 12 }} />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{
                fontSize: '0.78rem', color: BRAND.textPrimary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {route.message}
              </Typography>
            </Box>
            <Chip
              label={route.department?.toUpperCase()}
              size="small"
              sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 600,
                background: alpha(color, 0.1), color: color,
                flexShrink: 0,
              }}
            />
            <Tooltip title={`Confidence: ${(route.confidence * 100).toFixed(0)}%`}>
              <Box sx={{
                width: 36, height: 4, borderRadius: 2,
                background: alpha(BRAND.border, 0.3),
                flexShrink: 0,
              }}>
                <Box sx={{
                  width: `${(route.confidence || 0) * 100}%`,
                  height: '100%', borderRadius: 2,
                  background: route.confidence > 0.7 ? BRAND.success : route.confidence > 0.4 ? BRAND.warning : BRAND.error,
                }} />
              </Box>
            </Tooltip>
          </Box>
        );
      })}
      {routeHistory.length > 4 && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: BRAND.textMuted }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
      )}
    </Paper>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pipelineStats, setPipelineStats] = useState(null);
  const [recentActions, setRecentActions] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeHistory, setRouteHistory] = useState([]);
  const [memoryStats, setMemoryStats] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [gmailEmails, setGmailEmails] = useState([]);
  const [projects, setProjects] = useState([]);
  const [deployTargets, setDeployTargets] = useState([]);
  const [deploying, setDeploying] = useState(null); // project name currently deploying
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState(0); // 0=ZIP, 1=folder
  const [importFolder, setImportFolder] = useState('');
  const [importName, setImportName] = useState('');
  const [importing, setImporting] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

  // SSE live state
  const [connected, setConnected] = useState(false);
  const [activeDept, setActiveDept] = useState(null);
  const [progressMessage, setProgressMessage] = useState('');
  const activeDeptTimeout = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, pipelineRes, actionsRes, systemRes, historyRes, memRes] = await Promise.allSettled([
          fetch('/api/activity-stats').then(r => r.json()),
          fetch('/api/pipeline-stats').then(r => r.json()),
          fetch('/api/recent-actions').then(r => r.json()),
          fetch('/api/system-info').then(r => r.json()),
          fetch('/api/departments/history').then(r => r.json()),
          fetch('/api/memory/stats').then(r => r.json()),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value.success) setStats(statsRes.value.data);
        if (pipelineRes.status === 'fulfilled' && pipelineRes.value.success) setPipelineStats(pipelineRes.value.data);
        if (actionsRes.status === 'fulfilled' && actionsRes.value.success) setRecentActions(actionsRes.value.data);
        if (systemRes.status === 'fulfilled' && systemRes.value.success) setSystemInfo(systemRes.value.data);
        if (historyRes.status === 'fulfilled' && historyRes.value.success) setRouteHistory(historyRes.value.data || []);
        if (memRes.status === 'fulfilled' && memRes.value.success) setMemoryStats(memRes.value.data);

        // Google data — non-blocking, silently ignored if not connected
        fetch('/api/google/calendar?maxResults=5').then(r => r.json()).then(d => {
          if (d.success && Array.isArray(d.data)) setGoogleEvents(d.data);
        }).catch(() => {});
        fetch('/api/google/gmail?maxResults=5').then(r => r.json()).then(d => {
          if (d.success && Array.isArray(d.data)) setGmailEmails(d.data);
        }).catch(() => {});

        // Diagnostics & health — non-blocking
        fetch('/api/diagnostics').then(r => r.json()).then(d => {
          if (d.success) setDiagnostics(d.data);
        }).catch(() => {});
        fetch('/api/diagnostics/health').then(r => r.json()).then(d => {
          if (d.success) setHealthStatus(d.data);
        }).catch(() => {});

        // Projects & deploy targets — non-blocking
        fetch('/api/projects').then(r => r.json()).then(d => {
          if (d.success && Array.isArray(d.data)) setProjects(d.data);
        }).catch(() => {});
        fetch('/api/deploy/targets').then(r => r.json()).then(d => {
          if (d.success && Array.isArray(d.targets)) setDeployTargets(d.targets);
        }).catch(() => {});
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // SSE for live department activity
  useEffect(() => {
    const eventSource = new EventSource('/api/events/stream');

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping' || data.type === 'connected') return;

        // Department routed event
        if (data.type === 'department:routed') {
          const d = data.data || {};
          setActiveDept(d.department);
          setProgressMessage(`Routing to ${d.departmentName || d.department} — confidence ${((d.confidence || 0) * 100).toFixed(0)}%`);
          // Add to local route history
          setRouteHistory(prev => [{
            message: d.message,
            department: d.department,
            confidence: d.confidence,
            timestamp: Date.now(),
          }, ...prev].slice(0, 20));
          // Clear active after 15s
          clearTimeout(activeDeptTimeout.current);
          activeDeptTimeout.current = setTimeout(() => {
            setActiveDept(null);
            setProgressMessage('');
          }, 15000);
        }

        // Progress updates
        if (data.type === 'progress:update' || data.type === 'brain:thinking') {
          const msg = data.data?.message || data.data?.thought || '';
          if (msg) setProgressMessage(msg);
        }

        // Research events
        if (data.type === 'research:started') {
          setActiveDept('research');
          setProgressMessage(`Research: ${data.data?.query || 'Starting research...'}`);
        }
        if (data.type === 'research:completed') {
          setProgressMessage('Research complete');
          clearTimeout(activeDeptTimeout.current);
          activeDeptTimeout.current = setTimeout(() => {
            setActiveDept(null);
            setProgressMessage('');
          }, 5000);
        }

        // SOP events
        if (data.type === 'sop:started') {
          setActiveDept('browser');
          setProgressMessage(`Running SOP: ${data.data?.sopName || 'Unknown'}`);
        }
        if (data.type === 'sop:step:started') {
          setProgressMessage(`Step: ${data.data?.message || data.data?.stepName || 'Processing...'}`);
        }
        if (data.type === 'sop:completed' || data.type === 'sop:failed') {
          clearTimeout(activeDeptTimeout.current);
          activeDeptTimeout.current = setTimeout(() => {
            setActiveDept(null);
            setProgressMessage('');
          }, 5000);
        }
      } catch (e) { /* ignore */ }
    };

    eventSource.onerror = () => setConnected(false);
    return () => {
      eventSource.close();
      clearTimeout(activeDeptTimeout.current);
    };
  }, []);

  const researchSessions = memoryStats?.research?.totalSessions || 0;
  const correctionsLearned = memoryStats?.corrections?.totalCorrections || 0;

  // Chart data
  const chartData = [
    { name: 'Mon', actions: 12, messages: 8 },
    { name: 'Tue', actions: 19, messages: 14 },
    { name: 'Wed', actions: 15, messages: 11 },
    { name: 'Thu', actions: 22, messages: 16 },
    { name: 'Fri', actions: 28, messages: 20 },
    { name: 'Sat', actions: 18, messages: 12 },
    { name: 'Today', actions: stats?.actions || 0, messages: stats?.messages || 0 },
  ];

  const handleDeploy = async (projectName, target = 'local') => {
    setDeploying(projectName);
    try {
      const res = await fetch(`/api/projects/${projectName}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        // Update project in local state with lastDeploy info
        setProjects(prev => prev.map(p =>
          p.name === projectName
            ? { ...p, lastDeploy: { target, url: data.url, timestamp: data.timestamp, success: true } }
            : p
        ));
      }
    } catch (e) {
      console.error('Deploy failed:', e);
    } finally {
      setDeploying(null);
    }
  };

  const handleImportZip = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const name = importName || file.name.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-');
      const res = await fetch(`/api/projects/import/zip?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file,
      });
      const data = await res.json();
      if (data.success) {
        setProjects(prev => [...prev, data.project]);
        setImportOpen(false);
        setImportName('');
      }
    } catch (e) {
      console.error('ZIP import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFolder = async () => {
    if (!importFolder || !importName) return;
    setImporting(true);
    try {
      const res = await fetch('/api/projects/import/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: importFolder, name: importName }),
      });
      const data = await res.json();
      if (data.success) {
        setProjects(prev => [...prev, data.project]);
        setImportOpen(false);
        setImportFolder('');
        setImportName('');
      }
    } catch (e) {
      console.error('Folder import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1400 }}>
      {/* Welcome Banner */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.12)} 0%, ${alpha(BRAND.secondary, 0.06)} 100%)`,
        border: `1px solid ${alpha(BRAND.primary, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 52, height: 52,
            background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.primary, 0.3)}`,
          }}>
            <AceSpadeIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '1.2rem' }}>
              Welcome back! Ace is working for you.
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary, mt: 0.5 }}>
              {systemInfo?.uptime
                ? `System uptime: ${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor((systemInfo.uptime % 3600) / 60)}m`
                : 'Your AI executive assistant is monitoring all systems.'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Live Department Activity Banner */}
      <DepartmentActivityBanner
        activeDept={activeDept}
        progressMessage={progressMessage}
        connected={connected}
      />

      {/* Stat Cards — 6 columns */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<ChatBubbleOutlineIcon />}
            label="Messages Today"
            value={stats?.messages}
            color={BRAND.primary}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<BoltIcon />}
            label="Actions Taken"
            value={stats?.actions}
            color={BRAND.secondary}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<SearchIcon />}
            label="Research Sessions"
            value={researchSessions}
            color={BRAND.success}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<SchoolIcon />}
            label="Corrections Learned"
            value={correctionsLearned}
            color={BRAND.warning}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<RouteIcon />}
            label="Routes Today"
            value={routeHistory.length}
            color={BRAND.accent}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<AssignmentTurnedInIcon />}
            label="Pipeline Tasks"
            value={pipelineStats?.tasks?.total}
            color={BRAND.info}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts + Routing History */}
      <Grid container spacing={2.5}>
        {/* Activity Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                  Activity Overview
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                  Actions & messages this week
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: BRAND.primary }} />
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Actions</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: BRAND.secondary }} />
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>Messages</Typography>
                </Box>
              </Box>
            </Box>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND.secondary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BRAND.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: BRAND.textMuted, fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: BRAND.textMuted, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: BRAND.bgElevated,
                    border: `1px solid ${BRAND.border}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                  labelStyle={{ color: BRAND.textPrimary }}
                  itemStyle={{ color: BRAND.textSecondary }}
                />
                <Area type="monotone" dataKey="actions" stroke={BRAND.primary} fillOpacity={1} fill="url(#colorActions)" strokeWidth={2} />
                <Area type="monotone" dataKey="messages" stroke={BRAND.secondary} fillOpacity={1} fill="url(#colorMessages)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Routing Decisions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <RecentRoutingWidget routeHistory={routeHistory} />
        </Grid>

        {/* System Health */}
        {(diagnostics || healthStatus) && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MonitorHeartIcon sx={{ color: BRAND.secondary, fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                  System Health
                </Typography>
                {diagnostics?.errorsLastHour === 0 && (
                  <Chip label="All Clear" size="small" sx={{
                    height: 20, fontSize: '0.65rem', fontWeight: 600,
                    background: alpha(BRAND.success, 0.1), color: BRAND.success,
                  }} />
                )}
              </Box>

              {/* Error Summary Stats */}
              {diagnostics && (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {[
                    { label: 'Errors/Hour', value: diagnostics.errorsLastHour ?? 0, color: diagnostics.errorsLastHour > 0 ? BRAND.error : BRAND.success },
                    { label: 'Total Errors', value: diagnostics.totalErrors ?? 0, color: BRAND.info },
                    { label: 'Fix Rate', value: diagnostics.totalFixes > 0 ? `${Math.round((diagnostics.successfulFixes / diagnostics.totalFixes) * 100)}%` : '100%', color: BRAND.success },
                    { label: 'Auto-Fixes', value: diagnostics.totalFixes ?? 0, color: BRAND.secondary },
                  ].map(s => (
                    <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, background: alpha(s.color, 0.05) }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>{s.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* Error type breakdown */}
              {diagnostics?.byType && Object.keys(diagnostics.byType).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1 }}>
                    Error Types (Last Hour)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(diagnostics.byType).map(([type, count]) => (
                      <Chip key={type} label={`${type}: ${count}`} size="small" sx={{
                        height: 22, fontSize: '0.65rem', fontWeight: 600,
                        background: alpha(BRAND.warning, 0.1), color: BRAND.warning,
                      }} />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Subsystem health */}
              {healthStatus && (
                <Box>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1 }}>
                    Subsystem Health
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(healthStatus).map(([name, status]) => (
                      <Chip
                        key={name}
                        icon={status.healthy
                          ? <CheckCircleIcon sx={{ fontSize: '12px !important', color: `${BRAND.success} !important` }} />
                          : <ErrorIcon sx={{ fontSize: '12px !important', color: `${BRAND.error} !important` }} />}
                        label={name.replace(/([A-Z])/g, ' $1').trim()}
                        size="small"
                        sx={{
                          height: 24, fontSize: '0.7rem', fontWeight: 500,
                          background: alpha(status.healthy ? BRAND.success : BRAND.error, 0.08),
                          color: status.healthy ? BRAND.success : BRAND.error,
                          border: `1px solid ${alpha(status.healthy ? BRAND.success : BRAND.error, 0.15)}`,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Quick Deploy */}
        {projects.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <RocketLaunchIcon sx={{ color: BRAND.secondary, fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                  Quick Deploy
                </Typography>
                <Chip
                  label={`${projects.length} projects`}
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.65rem',
                    background: alpha(BRAND.secondary, 0.1),
                    color: BRAND.secondary,
                  }}
                />
                <Box sx={{ flex: 1 }} />
                <Chip
                  icon={<UploadFileIcon sx={{ fontSize: '14px !important' }} />}
                  label="Import Project"
                  size="small"
                  onClick={() => setImportOpen(true)}
                  sx={{
                    height: 28, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: alpha(BRAND.accent, 0.1),
                    color: BRAND.accent,
                    border: `1px solid ${alpha(BRAND.accent, 0.2)}`,
                    '&:hover': { background: alpha(BRAND.accent, 0.2) },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {projects.slice(0, 8).map((project) => {
                  const isDeploying = deploying === project.name;
                  const lastDeploy = project.lastDeploy;
                  return (
                    <Box key={project.name} sx={{
                      display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
                      borderRadius: 1.5,
                      background: alpha(BRAND.secondary, 0.03),
                      border: `1px solid ${alpha(BRAND.secondary, 0.1)}`,
                      transition: 'all 0.2s ease',
                      '&:hover': { background: alpha(BRAND.secondary, 0.06) },
                    }}>
                      <FolderOpenIcon sx={{ fontSize: 18, color: BRAND.secondary, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {project.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                          {project.type || 'project'}
                          {lastDeploy?.success && lastDeploy?.url && (
                            <> — <a href={lastDeploy.url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.success, textDecoration: 'none' }}>
                              {lastDeploy.url} <OpenInNewIcon sx={{ fontSize: 10, verticalAlign: 'middle' }} />
                            </a></>
                          )}
                        </Typography>
                      </Box>
                      {lastDeploy && (
                        <Tooltip title={lastDeploy.success ? `Deployed ${new Date(lastDeploy.timestamp).toLocaleDateString()}` : 'Last deploy failed'}>
                          {lastDeploy.success
                            ? <CheckCircleIcon sx={{ fontSize: 16, color: BRAND.success }} />
                            : <ErrorIcon sx={{ fontSize: 16, color: BRAND.error }} />
                          }
                        </Tooltip>
                      )}
                      {deployTargets.filter(t => t.configured).map(target => (
                        <Chip
                          key={target.name}
                          label={isDeploying ? 'Deploying...' : `Deploy ${target.name}`}
                          size="small"
                          disabled={isDeploying}
                          onClick={() => handleDeploy(project.name, target.name)}
                          sx={{
                            height: 26, fontSize: '0.7rem', fontWeight: 600,
                            cursor: isDeploying ? 'wait' : 'pointer',
                            background: alpha(BRAND.secondary, 0.1),
                            color: BRAND.secondary,
                            border: `1px solid ${alpha(BRAND.secondary, 0.2)}`,
                            '&:hover': { background: alpha(BRAND.secondary, 0.2) },
                          }}
                        />
                      ))}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Google Calendar */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CalendarMonthIcon sx={{ color: '#4285F4', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                Upcoming Calendar
              </Typography>
            </Box>
            {googleEvents.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {googleEvents.slice(0, 5).map((ev, i) => {
                  const time = ev.start?.dateTime
                    ? new Date(ev.start.dateTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'All day';
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 1.5, background: alpha('#4285F4', 0.05), border: `1px solid ${alpha('#4285F4', 0.1)}` }}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: '#4285F4', mt: 0.25, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.summary || 'Untitled'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>{time}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                  No upcoming events — or Google not connected.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Gmail */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <EmailIcon sx={{ color: '#EA4335', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                Unread Emails
              </Typography>
            </Box>
            {gmailEmails.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {gmailEmails.slice(0, 5).map((email, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 1.5, background: alpha('#EA4335', 0.05), border: `1px solid ${alpha('#EA4335', 0.1)}` }}>
                    <EmailIcon sx={{ fontSize: 16, color: '#EA4335', mt: 0.25, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {email.subject || '(No subject)'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                        From: {email.from || 'Unknown'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                  No unread emails — or Google not connected.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Recent Actions Timeline */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                  Recent Activity
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                  Latest actions performed by Ace
                </Typography>
              </Box>
              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
                label={`${recentActions.length} actions`}
                size="small"
                sx={{
                  background: alpha(BRAND.primary, 0.1),
                  color: BRAND.primaryLight,
                  border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                }}
              />
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[...Array(5)].map((_, i) => <Skeleton key={i} variant="rounded" height={50} />)}
              </Box>
            ) : recentActions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {recentActions.slice(0, 10).map((action, index) => (
                  <ActivityItem key={index} action={action} index={index} />
                ))}
              </Box>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                  No recent activity yet. Ace is standing by.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Import Project Dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: BRAND.bgElevated, border: `1px solid ${BRAND.border}` } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CreateNewFolderIcon sx={{ color: BRAND.accent }} />
          Import Project
        </DialogTitle>
        <DialogContent>
          <Tabs value={importTab} onChange={(_, v) => setImportTab(v)} sx={{ mb: 2 }}>
            <Tab label="Upload ZIP" />
            <Tab label="From Folder" />
          </Tabs>

          <TextField
            label="Project Name"
            placeholder="my-project"
            fullWidth
            size="small"
            value={importName}
            onChange={(e) => setImportName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '-'))}
            sx={{ mb: 2 }}
            helperText="Letters, numbers, hyphens, underscores only"
          />

          {importTab === 0 && (
            <Box sx={{
              border: `2px dashed ${alpha(BRAND.accent, 0.3)}`,
              borderRadius: 2, p: 4, textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: BRAND.accent, background: alpha(BRAND.accent, 0.05) },
            }}
              onClick={() => document.getElementById('zip-upload-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.zip')) handleImportZip(file);
              }}
            >
              <UploadFileIcon sx={{ fontSize: 40, color: BRAND.accent, mb: 1 }} />
              <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
                {importing ? 'Importing...' : 'Drag & drop a ZIP file here, or click to browse'}
              </Typography>
              <input
                id="zip-upload-input"
                type="file"
                accept=".zip"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportZip(file);
                }}
              />
            </Box>
          )}

          {importTab === 1 && (
            <Box>
              <TextField
                label="Folder Path"
                placeholder="/Users/you/my-project"
                fullWidth
                size="small"
                value={importFolder}
                onChange={(e) => setImportFolder(e.target.value)}
                sx={{ mb: 2 }}
                helperText="Absolute path to the project folder on this machine"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportOpen(false)} sx={{ color: BRAND.textMuted }}>Cancel</Button>
          {importTab === 1 && (
            <Button
              variant="contained"
              disabled={!importFolder || !importName || importing}
              onClick={handleImportFolder}
              sx={{
                background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.secondary})`,
                textTransform: 'none', fontWeight: 600,
              }}
            >
              {importing ? 'Importing...' : 'Import Folder'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;
