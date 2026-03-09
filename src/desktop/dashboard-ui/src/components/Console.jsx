import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, IconButton, TextField, Chip, Tooltip,
  ToggleButtonGroup, ToggleButton, InputAdornment, Badge
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BugReportIcon from '@mui/icons-material/BugReport';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { BRAND } from '../theme';

const LEVEL_CONFIG = {
  error: { color: '#FF6B6B', icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} />, label: 'ERR' },
  warn:  { color: '#FDCB6E', icon: <WarningAmberIcon sx={{ fontSize: 14 }} />, label: 'WRN' },
  info:  { color: '#74B9FF', icon: <InfoOutlinedIcon sx={{ fontSize: 14 }} />, label: 'INF' },
  debug: { color: '#A29BFE', icon: <BugReportIcon sx={{ fontSize: 14 }} />, label: 'DBG' },
};

function LogLine({ entry, onAskAce }) {
  const config = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.info;
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const showAskAce = entry.level === 'error' || entry.level === 'warn';

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1,
      py: 0.3,
      px: 1.5,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
      fontSize: '12.5px',
      lineHeight: 1.5,
      borderBottom: `1px solid ${alpha(BRAND.border, 0.3)}`,
      '&:hover': {
        background: alpha(BRAND.primary, 0.04),
        '& .ask-ace-btn': { opacity: 1 },
      },
      ...(entry.level === 'error' && { background: alpha('#FF6B6B', 0.06) }),
      ...(entry.level === 'warn' && { background: alpha('#FDCB6E', 0.03) }),
    }}>
      <Typography sx={{
        color: BRAND.textMuted,
        fontFamily: 'inherit',
        fontSize: 'inherit',
        minWidth: 65,
        flexShrink: 0,
        userSelect: 'none',
      }}>
        {time}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 35, flexShrink: 0, color: config.color }}>
        {config.icon}
      </Box>
      <Typography sx={{
        color: entry.level === 'error' ? '#FF6B6B' : entry.level === 'warn' ? '#FDCB6E' : BRAND.textPrimary,
        fontFamily: 'inherit',
        fontSize: 'inherit',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        flex: 1,
      }}>
        {entry.message}
      </Typography>
      {showAskAce && (
        <Tooltip title="Ask Ace to debug this" placement="left">
          <IconButton
            className="ask-ace-btn"
            size="small"
            onClick={() => onAskAce(entry)}
            sx={{
              opacity: 0,
              transition: 'opacity 0.15s',
              flexShrink: 0,
              color: BRAND.primary,
              p: 0.3,
              '&:hover': {
                background: alpha(BRAND.primary, 0.15),
                color: BRAND.primaryLight,
              },
            }}
          >
            <AutoFixHighIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default function Console() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState(null); // null = all, 'error', 'warn', 'info', 'debug'
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [counts, setCounts] = useState({ info: 0, warn: 0, error: 0, debug: 0 });
  const scrollRef = useRef(null);
  const pausedRef = useRef(false);
  const logsRef = useRef([]);

  // Keep ref in sync with paused state
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Fetch initial logs
  useEffect(() => {
    fetch('/api/logs?count=500')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.logs) {
          setLogs(data.data.logs);
          logsRef.current = data.data.logs;
          if (data.data.stats?.counts) setCounts(data.data.stats.counts);
        }
      })
      .catch(() => {});
  }, []);

  // SSE streaming for live logs
  useEffect(() => {
    const eventSource = new EventSource('/api/events/stream');

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'console:log' && parsed.data) {
          const entry = parsed.data;
          if (pausedRef.current) return;

          logsRef.current = [...logsRef.current.slice(-999), entry];
          setLogs(logsRef.current);
          setCounts(prev => ({
            ...prev,
            [entry.level]: (prev[entry.level] || 0) + 1
          }));
        }
      } catch {}
    };

    return () => eventSource.close();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll — disable auto-scroll if user scrolls up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const handleClear = async () => {
    try { await fetch('/api/logs', { method: 'DELETE' }); } catch {}
    setLogs([]);
    logsRef.current = [];
    setCounts({ info: 0, warn: 0, error: 0, debug: 0 });
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  // Send error to Ace for debugging
  const sendToAce = useCallback((entry) => {
    // Gather surrounding context (5 lines before/after)
    const idx = logs.findIndex(l => l.id === entry.id);
    const start = Math.max(0, idx - 5);
    const end = Math.min(logs.length, idx + 6);
    const context = logs.slice(start, end)
      .map(l => `[${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');

    const debugMessage = `I'm seeing this ${entry.level} in the server console. Can you diagnose and fix it?\n\n\`\`\`\n${context}\n\`\`\``;

    // Dispatch event — App.jsx switches to chat, Chat.jsx sends the message
    window.dispatchEvent(new CustomEvent('ace:debug-error', {
      detail: { message: debugMessage }
    }));
  }, [logs]);

  // Filter logs
  const filteredLogs = logs.filter(entry => {
    if (filter && entry.level !== filter) return false;
    if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, p: 0 }}>
      {/* Header toolbar */}
      <Paper sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        background: alpha(BRAND.bgCard, 0.8),
        borderColor: BRAND.border,
        flexShrink: 0,
      }}>
        <Typography variant="h6" sx={{
          fontWeight: 700,
          fontSize: '1.1rem',
          background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mr: 1,
        }}>
          Console
        </Typography>

        {/* Level filter chips */}
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(e, val) => setFilter(val)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 1.2, py: 0.3, fontSize: '0.75rem', borderColor: alpha(BRAND.border, 0.5) } }}
        >
          <ToggleButton value="error" sx={{ color: LEVEL_CONFIG.error.color, '&.Mui-selected': { background: alpha(LEVEL_CONFIG.error.color, 0.15), color: LEVEL_CONFIG.error.color } }}>
            <Badge badgeContent={counts.error} color="error" max={999} sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
              <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
            </Badge>
            Errors
          </ToggleButton>
          <ToggleButton value="warn" sx={{ color: LEVEL_CONFIG.warn.color, '&.Mui-selected': { background: alpha(LEVEL_CONFIG.warn.color, 0.15), color: LEVEL_CONFIG.warn.color } }}>
            <Badge badgeContent={counts.warn} color="warning" max={999} sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
              <WarningAmberIcon sx={{ fontSize: 16, mr: 0.5 }} />
            </Badge>
            Warnings
          </ToggleButton>
          <ToggleButton value="info" sx={{ color: LEVEL_CONFIG.info.color, '&.Mui-selected': { background: alpha(LEVEL_CONFIG.info.color, 0.15), color: LEVEL_CONFIG.info.color } }}>
            Info
          </ToggleButton>
          <ToggleButton value="debug" sx={{ color: LEVEL_CONFIG.debug.color, '&.Mui-selected': { background: alpha(LEVEL_CONFIG.debug.color, 0.15), color: LEVEL_CONFIG.debug.color } }}>
            Debug
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Filter logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ml: 'auto', width: 220, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.85rem' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: BRAND.textMuted }} /></InputAdornment>,
          }}
        />

        {/* Action buttons */}
        <Tooltip title={paused ? 'Resume' : 'Pause'}>
          <IconButton size="small" onClick={() => setPaused(!paused)} sx={{ color: paused ? BRAND.warning : BRAND.textMuted }}>
            {paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Scroll to bottom">
          <IconButton size="small" onClick={scrollToBottom} sx={{ color: autoScroll ? BRAND.primary : BRAND.textMuted }}>
            <VerticalAlignBottomIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear logs">
          <IconButton size="small" onClick={handleClear} sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Chip
          label={`${filteredLogs.length} lines`}
          size="small"
          sx={{ background: alpha(BRAND.primary, 0.1), color: BRAND.textSecondary, fontSize: '0.75rem', height: 24 }}
        />
      </Paper>

      {/* Log output area */}
      <Paper
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflow: 'auto',
          background: '#0C0C18',
          borderColor: alpha(BRAND.border, 0.5),
          borderRadius: 2,
          minHeight: 0,
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: BRAND.textMuted }}>
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>
              {logs.length === 0 ? 'No logs yet. Start the server to see output here.' : 'No logs match the current filter.'}
            </Typography>
          </Box>
        ) : (
          filteredLogs.map(entry => <LogLine key={entry.id} entry={entry} onAskAce={sendToAce} />)
        )}
      </Paper>

      {/* Status bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 1.5,
        py: 0.5,
        flexShrink: 0,
      }}>
        {paused && (
          <Chip
            icon={<PauseIcon sx={{ fontSize: 14 }} />}
            label="PAUSED"
            size="small"
            sx={{ background: alpha(BRAND.warning, 0.15), color: BRAND.warning, fontWeight: 600, fontSize: '0.7rem', height: 22 }}
          />
        )}
        {!autoScroll && !paused && (
          <Chip
            label="Scroll locked — click arrow to resume"
            size="small"
            onClick={scrollToBottom}
            sx={{ background: alpha(BRAND.info, 0.1), color: BRAND.info, fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
          />
        )}
        <Typography variant="caption" sx={{ color: BRAND.textMuted, ml: 'auto' }}>
          {counts.error > 0 && <span style={{ color: LEVEL_CONFIG.error.color }}>{counts.error} errors</span>}
          {counts.error > 0 && counts.warn > 0 && ' · '}
          {counts.warn > 0 && <span style={{ color: LEVEL_CONFIG.warn.color }}>{counts.warn} warnings</span>}
          {(counts.error > 0 || counts.warn > 0) && ' · '}
          {logs.length} total
        </Typography>
      </Box>
    </Box>
  );
}
