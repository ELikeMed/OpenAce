import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, Grid, alpha, LinearProgress, Button, Divider,
  Collapse, IconButton, Tooltip
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BoltIcon from '@mui/icons-material/Bolt';
import AceSpadeIcon from './AceSpadeIcon';
import LanguageIcon from '@mui/icons-material/Language';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SearchIcon from '@mui/icons-material/Search';
import EmailIcon from '@mui/icons-material/Email';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RouteIcon from '@mui/icons-material/AltRoute';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CodeIcon from '@mui/icons-material/Code';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WebIcon from '@mui/icons-material/Web';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { BRAND } from '../theme';

const DEPT_COLORS = {
  ceo: '#6366f1', cto: '#06b6d4', cmo: '#f59e0b',
  research: '#10b981', admin: '#8b5cf6', browser: '#ef4444',
};
const DEPT_ICONS_SMALL = {
  ceo: <TrendingUpIcon sx={{ fontSize: 14 }} />,
  cto: <CodeIcon sx={{ fontSize: 14 }} />,
  cmo: <CampaignIcon sx={{ fontSize: 14 }} />,
  research: <SearchIcon sx={{ fontSize: 14 }} />,
  admin: <CalendarMonthIcon sx={{ fontSize: 14 }} />,
  browser: <WebIcon sx={{ fontSize: 14 }} />,
};

const EVENT_CONFIG = {
  'progress:update': { icon: <BoltIcon />, color: BRAND.primary, label: 'Progress' },
  'brain:thinking': { icon: <PsychologyIcon />, color: BRAND.primaryLight, label: 'Thinking' },
  'brain:thought:complete': { icon: <PsychologyIcon />, color: BRAND.secondary, label: 'Thought' },
  'action:detected': { icon: <BoltIcon />, color: BRAND.warning, label: 'Action Detected' },
  'action:completed': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Action Done' },
  'action:failed': { icon: <ErrorIcon />, color: BRAND.error, label: 'Action Failed' },
  'department:routed': { icon: <RouteIcon />, color: BRAND.accent, label: 'Routed' },
  'sop:started': { icon: <PlayArrowIcon />, color: BRAND.secondary, label: 'SOP Started' },
  'sop:step:started': { icon: <ScheduleIcon />, color: BRAND.info, label: 'SOP Step' },
  'sop:step:completed': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Step Done' },
  'sop:completed': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'SOP Complete' },
  'sop:failed': { icon: <ErrorIcon />, color: BRAND.error, label: 'SOP Failed' },
  'browser:launched': { icon: <LanguageIcon />, color: BRAND.info, label: 'Browser' },
  'browser:navigated': { icon: <LanguageIcon />, color: BRAND.info, label: 'Navigation' },
  'research:started': { icon: <SearchIcon />, color: BRAND.primaryLight, label: 'Research' },
  'research:completed': { icon: <SearchIcon />, color: BRAND.success, label: 'Research Done' },
  'research:failed': { icon: <ErrorIcon />, color: BRAND.error, label: 'Research Failed' },
  'email:sent': { icon: <EmailIcon />, color: BRAND.success, label: 'Email Sent' },
  'email:draft:created': { icon: <EmailIcon />, color: BRAND.info, label: 'Email Draft' },
  'chat:response:sent': { icon: <AceSpadeIcon />, color: BRAND.secondary, label: 'Response' },
  'approval:queued': { icon: <ScheduleIcon />, color: BRAND.warning, label: 'Approval Queued' },
  'approval:approved': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Approved' },
  'approval:rejected': { icon: <ErrorIcon />, color: BRAND.error, label: 'Rejected' },
  'approval:trust:learned': { icon: <PsychologyIcon />, color: BRAND.primaryLight, label: 'Trust Learned' },
  'system:error:diagnosed': { icon: <ErrorIcon />, color: BRAND.error, label: 'Error Diagnosed' },
  'system:health:degraded': { icon: <ErrorIcon />, color: BRAND.warning, label: 'Health Degraded' },
  'system:health:checked': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Health OK' },
  'system:error:uncaught': { icon: <ErrorIcon />, color: BRAND.error, label: 'Uncaught Error' },
  'system:error:unhandled': { icon: <ErrorIcon />, color: BRAND.error, label: 'Unhandled Error' },
  'skill:chain:started': { icon: <BoltIcon />, color: BRAND.accent, label: 'Skill Chain' },
  'skill:chain:completed': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Chain Done' },
  'skill:completed': { icon: <CheckCircleIcon />, color: BRAND.secondary, label: 'Skill Done' },
  'skill:failed': { icon: <ErrorIcon />, color: BRAND.error, label: 'Skill Failed' },
  'task:added': { icon: <BoltIcon />, color: BRAND.info, label: 'Task Added' },
  'lead:added': { icon: <BoltIcon />, color: BRAND.info, label: 'Lead Added' },
  'scheduler:routine:due': { icon: <ScheduleIcon />, color: BRAND.warning, label: 'Routine Due' },
  'scheduler:routine:completed': { icon: <CheckCircleIcon />, color: BRAND.success, label: 'Routine Done' },
};

function EventItem({ event }) {
  const config = EVENT_CONFIG[event.type] || { icon: <BoltIcon />, color: BRAND.textMuted, label: event.type };
  const time = new Date(event.timestamp).toLocaleTimeString();
  
  const getMessage = () => {
    const d = event.data || {};
    if (d.message) return d.message;
    if (d.sopName) return d.sopName;
    if (d.title) return d.title;
    if (d.url) return d.url;
    if (d.intent) return `Intent: ${d.intent} (${d.confidence || '?'})`;
    if (d.thought) return d.thought.substring(0, 120);
    if (d.query) return d.query;
    if (d.chain) return `Chain: ${d.chain.join(' → ')}`;
    if (d.actionType) return d.actionType;
    // Department routing
    if (d.department && d.departmentName) return `→ ${d.departmentName} (${((d.confidence || 0) * 100).toFixed(0)}% confidence)`;
    return '';
  };

  const msg = getMessage();
  const deptId = event.data?.department;
  const deptColor = deptId ? (DEPT_COLORS[deptId] || config.color) : null;

  return (
    <Box sx={{
      display: 'flex', gap: 1.5, py: 1, px: 1.5,
      borderRadius: 1.5,
      transition: 'background 0.2s',
      '&:hover': { background: alpha(config.color, 0.04) },
      animation: 'fadeInLeft 0.3s ease',
      '@keyframes fadeInLeft': {
        from: { opacity: 0, transform: 'translateX(-8px)' },
        to: { opacity: 1, transform: 'translateX(0)' },
      },
    }}>
      <Avatar sx={{
        width: 28, height: 28,
        background: alpha(deptColor || config.color, 0.15),
        color: deptColor || config.color,
      }}>
        {React.cloneElement(config.icon, { sx: { fontSize: 15 } })}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={config.label}
            size="small"
            sx={{
              height: 18, fontSize: '0.6rem', fontWeight: 600,
              background: alpha(config.color, 0.1),
              color: config.color,
            }}
          />
          {deptId && (
            <Chip
              label={deptId.toUpperCase()}
              size="small"
              sx={{
                height: 18, fontSize: '0.58rem', fontWeight: 700,
                background: alpha(deptColor, 0.1),
                color: deptColor,
                border: `1px solid ${alpha(deptColor, 0.2)}`,
              }}
            />
          )}
          <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
            {time}
          </Typography>
        </Box>
        {msg && (
          <Typography variant="body2" sx={{
            color: BRAND.textSecondary, fontSize: '0.78rem', mt: 0.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {msg}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SOPProgress({ sopEvents }) {
  if (sopEvents.length === 0) return null;

  const latest = sopEvents[sopEvents.length - 1];
  const isRunning = !['sop:completed', 'sop:failed'].includes(latest.type);
  const startEvent = sopEvents.find(e => e.type === 'sop:started');
  const stepEvents = sopEvents.filter(e => e.type === 'sop:step:completed' || e.type === 'sop:step:started');
  const totalSteps = startEvent?.data?.stepCount || stepEvents.length || 1;
  const completedSteps = sopEvents.filter(e => e.type === 'sop:step:completed').length;
  const progress = Math.round((completedSteps / totalSteps) * 100);
  const isFailed = latest.type === 'sop:failed';
  const isComplete = latest.type === 'sop:completed';

  return (
    <Paper sx={{
      p: 2.5, mb: 2,
      border: `1px solid ${alpha(
        isFailed ? BRAND.error : isComplete ? BRAND.success : BRAND.secondary, 0.2
      )}`,
      background: alpha(
        isFailed ? BRAND.error : isComplete ? BRAND.success : BRAND.secondary, 0.04
      ),
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: alpha(isRunning ? BRAND.secondary : isComplete ? BRAND.success : BRAND.error, 0.15),
          color: isRunning ? BRAND.secondary : isComplete ? BRAND.success : BRAND.error,
        }}>
          {isRunning ? <PlayArrowIcon /> : isComplete ? <CheckCircleIcon /> : <ErrorIcon />}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
            {startEvent?.data?.sopName || 'SOP Execution'}
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
            {isRunning ? `Step ${completedSteps + 1}/${totalSteps}` : isComplete ? 'Completed' : 'Failed'}
          </Typography>
        </Box>
        {isRunning && (
          <Chip
            icon={<FiberManualRecordIcon sx={{
              fontSize: '8px !important',
              color: `${BRAND.success} !important`,
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />}
            label="Running"
            size="small"
            sx={{
              background: alpha(BRAND.success, 0.1),
              color: BRAND.success,
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8, borderRadius: 4,
          backgroundColor: alpha(BRAND.bgSurface, 0.5),
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            background: isFailed
              ? `linear-gradient(90deg, ${BRAND.error}, ${BRAND.accent})`
              : isComplete
              ? `linear-gradient(90deg, ${BRAND.success}, ${BRAND.secondaryLight})`
              : `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`,
          },
        }}
      />
      <Typography variant="caption" sx={{ color: BRAND.textMuted, mt: 0.5, display: 'block' }}>
        {completedSteps}/{totalSteps} steps — {progress}%
      </Typography>
    </Paper>
  );
}

// Research Progress Tracker
const RESEARCH_STEPS = [
  { key: 'init', label: 'Initializing', icon: <PsychologyIcon sx={{ fontSize: 16 }} /> },
  { key: 'browser', label: 'Opening Browser', icon: <OpenInBrowserIcon sx={{ fontSize: 16 }} /> },
  { key: 'search', label: 'Searching Google', icon: <SearchIcon sx={{ fontSize: 16 }} /> },
  { key: 'reading', label: 'Reading Results', icon: <DescriptionIcon sx={{ fontSize: 16 }} /> },
  { key: 'clicking', label: 'Visiting Pages', icon: <LanguageIcon sx={{ fontSize: 16 }} /> },
  { key: 'extracting', label: 'Extracting Data', icon: <DataObjectIcon sx={{ fontSize: 16 }} /> },
  { key: 'compiling', label: 'Compiling Report', icon: <DescriptionIcon sx={{ fontSize: 16 }} /> },
  { key: 'done', label: 'Complete', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
];

function ResearchTracker({ researchState }) {
  const { active, query, currentStep, steps, screenshot, extractedData, error } = researchState;

  if (!active && steps.length === 0) return null;

  const stepIndex = RESEARCH_STEPS.findIndex(s => s.key === currentStep);
  const progress = active ? Math.max(((stepIndex + 1) / RESEARCH_STEPS.length) * 100, 10) : (error ? 0 : 100);

  return (
    <Paper sx={{
      p: 2.5, mb: 2,
      border: `1px solid ${alpha(active ? '#10b981' : error ? BRAND.error : BRAND.success, 0.2)}`,
      background: alpha(active ? '#10b981' : error ? BRAND.error : BRAND.success, 0.04),
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: active
            ? `linear-gradient(135deg, #10b981, #06b6d4)`
            : error
            ? `linear-gradient(135deg, ${BRAND.error}, ${BRAND.accent})`
            : `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondaryLight})`,
          animation: active ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%,100%': { boxShadow: `0 0 0 0 ${alpha('#10b981', 0.3)}` },
            '50%': { boxShadow: `0 0 0 8px ${alpha('#10b981', 0)}` },
          },
        }}>
          <SearchIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: BRAND.textPrimary }}>
            Research: {query || 'Desktop Search'}
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
            {active ? 'In progress...' : error ? 'Failed' : 'Completed'}
          </Typography>
        </Box>
        {active && (
          <Chip
            icon={<FiberManualRecordIcon sx={{
              fontSize: '6px !important',
              color: `#10b981 !important`,
              animation: 'blink 1s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
            }} />}
            label="Researching"
            size="small"
            sx={{
              background: alpha('#10b981', 0.1),
              color: '#10b981',
              fontWeight: 600, fontSize: '0.7rem',
            }}
          />
        )}
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant={active ? 'indeterminate' : 'determinate'}
        value={progress}
        sx={{
          height: 6, borderRadius: 3, mb: 2,
          backgroundColor: alpha(BRAND.bgSurface, 0.5),
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background: error
              ? `linear-gradient(90deg, ${BRAND.error}, ${BRAND.accent})`
              : `linear-gradient(90deg, #10b981, #06b6d4)`,
          },
        }}
      />

      {/* Step indicators */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
        {RESEARCH_STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const isDone = stepIndex > i || (!active && !error);
          const color = isActive ? '#10b981' : isDone ? BRAND.success : BRAND.textMuted;
          return (
            <Chip
              key={step.key}
              icon={React.cloneElement(step.icon, { sx: { fontSize: '12px !important', color: `${color} !important` } })}
              label={step.label}
              size="small"
              sx={{
                height: 22, fontSize: '0.62rem', fontWeight: isActive ? 700 : 500,
                background: isActive ? alpha('#10b981', 0.15) : isDone ? alpha(BRAND.success, 0.08) : 'transparent',
                color: color,
                border: isActive ? `1px solid ${alpha('#10b981', 0.3)}` : `1px solid ${alpha(BRAND.border, 0.3)}`,
                transition: 'all 0.3s',
              }}
            />
          );
        })}
      </Box>

      {/* Step log */}
      {steps.length > 0 && (
        <Box sx={{
          maxHeight: 120, overflow: 'auto',
          background: alpha(BRAND.bg, 0.5),
          borderRadius: 1, p: 1,
          border: `1px solid ${alpha(BRAND.border, 0.3)}`,
        }}>
          {steps.slice(-6).map((step, i) => (
            <Typography key={i} variant="caption" sx={{
              display: 'block', color: BRAND.textSecondary, fontSize: '0.7rem',
              fontFamily: 'monospace', lineHeight: 1.6,
            }}>
              <Box component="span" sx={{ color: '#10b981', mr: 0.5 }}>▸</Box>
              {step}
            </Typography>
          ))}
        </Box>
      )}

      {/* Screenshot preview */}
      {screenshot && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <PhotoCameraIcon sx={{ fontSize: 14, color: BRAND.textMuted }} />
            <Typography variant="caption" sx={{ color: BRAND.textMuted, fontSize: '0.65rem' }}>
              Live screenshot
            </Typography>
          </Box>
          <Box sx={{
            borderRadius: 1, overflow: 'hidden',
            border: `1px solid ${alpha(BRAND.border, 0.3)}`,
            maxHeight: 160,
          }}>
            <img
              src={screenshot}
              alt="Research screenshot"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </Box>
        </Box>
      )}

      {/* Extracted data preview */}
      {extractedData && (
        <Box sx={{
          mt: 1.5, p: 1.5,
          background: alpha('#10b981', 0.05),
          border: `1px solid ${alpha('#10b981', 0.15)}`,
          borderRadius: 1,
        }}>
          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600, display: 'block', mb: 0.5 }}>
            Extracted Data Preview
          </Typography>
          <Typography variant="caption" sx={{
            color: BRAND.textSecondary, fontSize: '0.7rem',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
            maxHeight: 80, overflow: 'auto', display: 'block',
          }}>
            {typeof extractedData === 'string' ? extractedData.substring(0, 300) : JSON.stringify(extractedData, null, 2).substring(0, 300)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// Department Routing History Panel
function RoutingHistoryPanel({ routeHistory }) {
  const [expanded, setExpanded] = useState(false);
  if (!routeHistory || routeHistory.length === 0) return null;

  const display = expanded ? routeHistory : routeHistory.slice(0, 5);

  return (
    <Paper sx={{ p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RouteIcon sx={{ color: BRAND.accent, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Department Routing
          </Typography>
        </Box>
        <Chip
          label={`${routeHistory.length} routes`}
          size="small"
          sx={{
            height: 20, fontSize: '0.65rem',
            background: alpha(BRAND.accent, 0.1),
            color: BRAND.accent,
          }}
        />
      </Box>
      {display.map((route, i) => {
        const color = DEPT_COLORS[route.department] || BRAND.textMuted;
        const conf = ((route.confidence || 0) * 100).toFixed(0);
        return (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 0.8,
            borderBottom: i < display.length - 1 ? `1px solid ${alpha(BRAND.border, 0.3)}` : 'none',
          }}>
            <Avatar sx={{
              width: 22, height: 22,
              background: alpha(color, 0.15), color,
            }}>
              {DEPT_ICONS_SMALL[route.department] || <AceSpadeIcon sx={{ fontSize: 12 }} />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{
                color: BRAND.textPrimary, fontSize: '0.72rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {route.message || '—'}
              </Typography>
            </Box>
            <Chip label={`${conf}%`} size="small" sx={{
              height: 18, fontSize: '0.6rem', fontWeight: 600, minWidth: 38,
              background: alpha(
                route.confidence > 0.7 ? BRAND.success : route.confidence > 0.4 ? BRAND.warning : BRAND.error, 0.1
              ),
              color: route.confidence > 0.7 ? BRAND.success : route.confidence > 0.4 ? BRAND.warning : BRAND.error,
            }} />
            <Chip label={route.department?.toUpperCase()} size="small" sx={{
              height: 18, fontSize: '0.58rem', fontWeight: 700,
              background: alpha(color, 0.1), color,
            }} />
          </Box>
        );
      })}
      {routeHistory.length > 5 && (
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 1, color: BRAND.textMuted, fontSize: '0.7rem' }}
        >
          {expanded ? 'Show less' : `Show all ${routeHistory.length}`}
        </Button>
      )}
    </Paper>
  );
}

function LiveActivity() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [sopEvents, setSopEvents] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [routeHistory, setRouteHistory] = useState([]);
  const [researchState, setResearchState] = useState({
    active: false, query: '', currentStep: '', steps: [],
    screenshot: null, extractedData: null, error: null,
  });
  const eventsEndRef = useRef(null);
  const maxEvents = 100;

  useEffect(() => {
    // Fetch initial route history
    fetch('/api/departments/history').then(r => r.json()).then(data => {
      if (data.success) setRouteHistory((data.data || []).reverse());
    }).catch(() => {});

    const eventSource = new EventSource('/api/events/stream');

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping' || data.type === 'connected') return;

        const newEvent = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: data.type,
          data: data.data || {},
          timestamp: data.timestamp || new Date().toISOString(),
        };

        setEvents(prev => {
          const updated = [...prev, newEvent];
          return updated.slice(-maxEvents);
        });

        // Track SOP events separately
        if (data.type?.startsWith('sop:')) {
          setSopEvents(prev => {
            if (data.type === 'sop:started') return [newEvent];
            return [...prev, newEvent];
          });
        }

        // Track department routing
        if (data.type === 'department:routed') {
          setRouteHistory(prev => [{
            message: data.data?.message,
            department: data.data?.department,
            confidence: data.data?.confidence,
            timestamp: Date.now(),
          }, ...prev].slice(0, 20));
        }

        // Track research progress
        if (data.type === 'research:started') {
          setResearchState({
            active: true,
            query: data.data?.query || 'Research task',
            currentStep: 'init',
            steps: ['Research started: ' + (data.data?.query || '')],
            screenshot: null,
            extractedData: null,
            error: null,
          });
        }
        if (data.type === 'progress:update' && researchState.active) {
          const msg = data.data?.message || '';
          let step = researchState.currentStep;
          if (msg.toLowerCase().includes('browser') || msg.toLowerCase().includes('chrome')) step = 'browser';
          else if (msg.toLowerCase().includes('search') || msg.toLowerCase().includes('google')) step = 'search';
          else if (msg.toLowerCase().includes('read') || msg.toLowerCase().includes('result')) step = 'reading';
          else if (msg.toLowerCase().includes('click') || msg.toLowerCase().includes('visit')) step = 'clicking';
          else if (msg.toLowerCase().includes('extract') || msg.toLowerCase().includes('data')) step = 'extracting';
          else if (msg.toLowerCase().includes('compil') || msg.toLowerCase().includes('report')) step = 'compiling';

          setResearchState(prev => ({
            ...prev,
            currentStep: step,
            steps: [...prev.steps, msg].slice(-20),
          }));
        }
        if (data.type === 'research:completed') {
          setResearchState(prev => ({
            ...prev,
            active: false,
            currentStep: 'done',
            steps: [...prev.steps, 'Research completed successfully'],
            extractedData: data.data?.summary || data.data?.result || null,
          }));
        }
        if (data.type === 'research:failed') {
          setResearchState(prev => ({
            ...prev,
            active: false,
            error: data.data?.error || 'Research failed',
            steps: [...prev.steps, `Error: ${data.data?.error || 'Unknown error'}`],
          }));
        }
      } catch (e) { /* ignore parse errors */ }
    };

    eventSource.onerror = () => setConnected(false);

    // Fetch system status
    fetch('/api/status').then(r => r.json()).then(data => {
      if (data.success) setSystemStatus(data.data);
    }).catch(() => {});

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const actionEvents = events.filter(e =>
    !['ping', 'connected'].includes(e.type)
  );

  const recentThinking = events.filter(e =>
    ['brain:thinking', 'progress:update'].includes(e.type)
  ).slice(-1)[0];

  // Dept routing stats
  const deptCounts = {};
  routeHistory.forEach(r => {
    deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
  });

  return (
    <Box sx={{ maxWidth: 1200 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.secondary, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.secondary, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.primary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.secondary, 0.3)}`,
          }}>
            <MonitorHeartIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Live Activity
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Watch Ace work in real-time — department routing, research progress, and system activity
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Chip
              icon={<FiberManualRecordIcon sx={{
                fontSize: '8px !important',
                color: `${connected ? BRAND.success : BRAND.error} !important`,
              }} />}
              label={connected ? 'Live' : 'Disconnected'}
              size="small"
              sx={{
                background: alpha(connected ? BRAND.success : BRAND.error, 0.1),
                color: connected ? BRAND.success : BRAND.error,
                fontWeight: 600,
              }}
            />
            <Chip
              label={`${actionEvents.length} events`}
              size="small"
              sx={{
                background: alpha(BRAND.primary, 0.1),
                color: BRAND.primaryLight,
              }}
            />
            <Button
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={() => { setEvents([]); setSopEvents([]); }}
              sx={{ color: BRAND.textMuted }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Active Status */}
        <Grid size={{ xs: 12 }}>
          {recentThinking && (
            <Paper sx={{
              p: 2, mb: 0,
              display: 'flex', alignItems: 'center', gap: 2,
              border: `1px solid ${alpha(BRAND.primaryLight, 0.15)}`,
              background: alpha(BRAND.primaryLight, 0.04),
            }}>
              <Avatar sx={{
                width: 36, height: 36,
                background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                animation: 'pulse 2s infinite',
                '@keyframes pulse': { '0%,100%': { boxShadow: `0 0 0 0 ${alpha(BRAND.primary, 0.3)}` }, '50%': { boxShadow: `0 0 0 8px ${alpha(BRAND.primary, 0)}` } },
              }}>
                <PsychologyIcon sx={{ fontSize: 20 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: BRAND.primaryLight, fontWeight: 600 }}>
                  Ace is thinking...
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem' }}>
                  {recentThinking.data?.message || ''}
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>

        {/* Left Column: Progress trackers + Status */}
        <Grid size={{ xs: 12, md: 5 }}>
          {/* Research Progress Tracker */}
          <ResearchTracker researchState={researchState} />

          {/* SOP Progress */}
          <SOPProgress sopEvents={sopEvents} />

          {/* Department Routing History */}
          <RoutingHistoryPanel routeHistory={routeHistory} />

          {/* System Status */}
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 2 }}>
              System Status
            </Typography>
            {[
              { label: 'Connection', value: connected ? 'Connected' : 'Disconnected', color: connected ? BRAND.success : BRAND.error },
              { label: 'Events Tracked', value: `${actionEvents.length}`, color: BRAND.primary },
              { label: 'Brain', value: (systemStatus?.brain && typeof systemStatus.brain === 'string') ? systemStatus.brain : 'Active', color: BRAND.secondary },
              { label: 'Routes Today', value: `${routeHistory.length}`, color: BRAND.accent },
            ].map(item => (
              <Box key={item.label} sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: 1, borderBottom: `1px solid ${alpha(BRAND.border, 0.5)}`,
                '&:last-child': { borderBottom: 'none' },
              }}>
                <Typography variant="body2" sx={{ color: BRAND.textSecondary, fontSize: '0.8rem' }}>
                  {item.label}
                </Typography>
                <Chip
                  label={item.value}
                  size="small"
                  sx={{
                    height: 22, fontSize: '0.7rem', fontWeight: 600,
                    background: alpha(item.color, 0.1),
                    color: item.color,
                  }}
                />
              </Box>
            ))}

            {/* Department routing mini-stats */}
            {Object.keys(deptCounts).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1 }}>
                  Routing Distribution
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                    <Chip
                      key={dept}
                      label={`${dept.toUpperCase()}: ${count}`}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.6rem', fontWeight: 600,
                        background: alpha(DEPT_COLORS[dept] || BRAND.primary, 0.1),
                        color: DEPT_COLORS[dept] || BRAND.primary,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Event Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2, height: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Event Stream
              </Typography>
              <Chip
                icon={<FiberManualRecordIcon sx={{
                  fontSize: '6px !important',
                  color: `${BRAND.success} !important`,
                  animation: connected ? 'pulse 1.5s infinite' : 'none',
                }} />}
                label="Live"
                size="small"
                sx={{
                  height: 20, fontSize: '0.65rem',
                  background: alpha(BRAND.success, 0.08),
                  color: BRAND.success,
                }}
              />
            </Box>
            <Box sx={{
              flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
            }}>
              {actionEvents.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <MonitorHeartIcon sx={{ fontSize: 40, color: BRAND.textMuted, mb: 1 }} />
                    <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
                      Waiting for activity...
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                      Events will appear here as Ace works
                    </Typography>
                  </Box>
                </Box>
              ) : (
                actionEvents.map(event => (
                  <EventItem key={event.id} event={event} />
                ))
              )}
              <div ref={eventsEndRef} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default LiveActivity;
