import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, TextField, Button, Paper, Typography, Avatar, alpha, IconButton, Chip,
  Checkbox, Select, MenuItem, CircularProgress, LinearProgress, Tooltip, Snackbar,
  Divider, Menu,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AceSpadeIcon from './components/AceSpadeIcon';
import PersonIcon from '@mui/icons-material/Person';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import AceWelcome from './components/AceWelcome';
import SchoolIcon from '@mui/icons-material/School';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import VideocamIcon from '@mui/icons-material/Videocam';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import BuildIcon from '@mui/icons-material/Build';
import CodeIcon from '@mui/icons-material/Code';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EmailIcon from '@mui/icons-material/Email';
import MouseIcon from '@mui/icons-material/Mouse';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import DownloadIcon from '@mui/icons-material/Download';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ConversationSidebar from './components/ConversationSidebar';
import NewProcessDialog from './components/NewProcessDialog';
import WelcomeScreen from './components/WelcomeScreen';
import TypingIndicator from './components/TypingIndicator';
import ActivityLog from './components/ActivityLog';
import { BRAND } from './theme';

const PRIORITY_COLORS = {
  high:   { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  medium: { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  low:    { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
};

function stripMarkdownForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')                  // code blocks
    .replace(/`([^`]+)`/g, '$1')                     // inline code
    .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')       // bold/italic
    .replace(/^#{1,6}\s+/gm, '')                     // headers
    .replace(/^\s*[-*]\s+/gm, '')                    // bullet points
    .replace(/^\s*\d+\.\s+/gm, '')                   // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')          // links → text only
    .replace(/https?:\/\/[^\s]+/g, '')                // bare URLs
    .replace(/\n{3,}/g, '\n\n')                      // collapse whitespace
    .trim();
}

// ═══ Friendly tool labels for non-tech users ═══
const TOOL_LABELS = {
  web_search:           { label: 'Searched the web',      icon: PublicIcon,         color: BRAND.info },
  read_webpage:         { label: 'Read a webpage',        icon: PublicIcon,         color: BRAND.info },
  recall_research:      { label: 'Checked past research', icon: SearchIcon,         color: BRAND.info },
  get_site_memory:      { label: 'Recalled site info',    icon: SearchIcon,         color: BRAND.info },
  open_browser:         { label: 'Opened browser',        icon: PublicIcon,         color: BRAND.secondary },
  browser_click:        { label: 'Clicked on page',       icon: MouseIcon,          color: BRAND.secondary },
  browser_type:         { label: 'Typed on page',         icon: MouseIcon,          color: BRAND.secondary },
  take_screenshot:      { label: 'Took screenshot',       icon: CameraAltIcon,      color: BRAND.secondary },
  scroll_page:          { label: 'Scrolled page',         icon: MouseIcon,          color: BRAND.secondary },
  read_screen:          { label: 'Read the screen',       icon: CameraAltIcon,      color: BRAND.secondary },
  extract_page_data:    { label: 'Extracted page data',   icon: SearchIcon,         color: BRAND.secondary },
  go_back:              { label: 'Went back',             icon: MouseIcon,          color: BRAND.secondary },
  browse_and_extract:   { label: 'Browsed & extracted',   icon: PublicIcon,         color: BRAND.secondary },
  send_email:           { label: 'Sent email',            icon: EmailIcon,          color: BRAND.accent },
  send_sms:             { label: 'Sent text message',     icon: EmailIcon,          color: BRAND.accent },
  make_call:            { label: 'Made a call',           icon: VolumeUpIcon,       color: BRAND.accent },
  dispatch_phone_call:  { label: 'Started phone call',    icon: VolumeUpIcon,       color: BRAND.accent },
  save_leads:           { label: 'Saved leads',           icon: TrackChangesIcon,   color: BRAND.success },
  get_pipeline:         { label: 'Checked pipeline',      icon: TrackChangesIcon,   color: BRAND.success },
  move_lead:            { label: 'Moved lead',            icon: TrackChangesIcon,   color: BRAND.success },
  manage_contacts:      { label: 'Updated contacts',      icon: PersonIcon,         color: BRAND.primaryLight },
  schedule_task:        { label: 'Scheduled task',        icon: ScheduleIcon,       color: BRAND.warning },
  list_calendar_events: { label: 'Checked calendar',      icon: ScheduleIcon,       color: BRAND.warning },
  create_calendar_event:{ label: 'Created event',         icon: ScheduleIcon,       color: BRAND.warning },
  delete_calendar_event:{ label: 'Deleted event',         icon: ScheduleIcon,       color: BRAND.warning },
  deploy_project:       { label: 'Deployed project',      icon: RocketLaunchIcon,   color: BRAND.success },
  post_social_media:    { label: 'Posted to social',      icon: PublicIcon,         color: BRAND.accent },
  schedule_social_post: { label: 'Scheduled post',        icon: ScheduleIcon,       color: BRAND.accent },
  create_content_plan:  { label: 'Created content plan',  icon: AssignmentIcon,     color: BRAND.accent },
  select_media_for_content: { label: 'Selected media',    icon: CameraAltIcon,      color: BRAND.accent },
  search_workload:      { label: 'Searched your files',   icon: SearchIcon,         color: BRAND.primaryLight },
  list_workload_sources:{ label: 'Listed your files',     icon: SearchIcon,         color: BRAND.primaryLight },
  list_media:           { label: 'Browsed media',         icon: CameraAltIcon,      color: BRAND.primaryLight },
  list_sops:            { label: 'Listed processes',      icon: AssignmentIcon,     color: BRAND.primaryLight },
  update_sop:           { label: 'Updated process',       icon: AssignmentIcon,     color: BRAND.primaryLight },
  create_sop:           { label: 'Created process',       icon: AssignmentIcon,     color: BRAND.primaryLight },
  run_sop:              { label: 'Ran process',           icon: PlayArrowIcon,      color: BRAND.success },
  create_project:       { label: 'Created project',       icon: CodeIcon,           color: BRAND.primaryLight },
  write_project_file:   { label: 'Wrote code',            icon: CodeIcon,           color: BRAND.primaryLight },
  list_projects:        { label: 'Listed projects',       icon: CodeIcon,           color: BRAND.primaryLight },
  create_form:          { label: 'Created form',          icon: AssignmentIcon,     color: BRAND.secondary },
  list_forms:           { label: 'Listed forms',          icon: AssignmentIcon,     color: BRAND.secondary },
  get_form_submissions: { label: 'Checked submissions',   icon: AssignmentIcon,     color: BRAND.secondary },
  save_note:            { label: 'Saved a note',          icon: AssignmentIcon,     color: BRAND.primaryLight },
  recall_notes:         { label: 'Recalled notes',        icon: SearchIcon,         color: BRAND.primaryLight },
};

function getToolInfo(toolName) {
  const info = TOOL_LABELS[toolName];
  if (info) return info;
  // Fallback: humanize the snake_case name
  return {
    label: toolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: BuildIcon,
    color: BRAND.primaryLight,
  };
}

// ═══ Code Block with Syntax Highlighting + Copy ═══
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ position: 'relative', my: 1.5, borderRadius: '10px', overflow: 'hidden', border: `1px solid ${alpha(BRAND.border, 0.5)}` }}>
      {/* Header bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.5,
        background: alpha('#000', 0.3),
        borderBottom: `1px solid ${alpha(BRAND.border, 0.3)}`,
      }}>
        <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {lang || 'code'}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy code'} placement="top">
          <IconButton size="small" onClick={handleCopy} sx={{
            width: 24, height: 24,
            color: copied ? BRAND.success : BRAND.textMuted,
            '&:hover': { color: BRAND.textPrimary, background: alpha(BRAND.primary, 0.1) },
            transition: 'all 0.2s ease',
          }}>
            {copied ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <SyntaxHighlighter
        style={oneDark}
        language={lang || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '12px 16px',
          background: alpha('#0D1117', 0.9),
          fontSize: '0.85rem',
          lineHeight: 1.6,
          borderRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </Box>
  );
}

// ═══ Markdown Renderer — Replaces plain text with rich formatting ═══
// ═══ Auto-linkify emails and phone numbers in text ═══
const LINK_PATTERNS = [
  // Email addresses
  { regex: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, href: (m) => `mailto:${m}`, label: (m) => m },
  // Phone numbers — (555) 123-4567, 555-123-4567, +1-555-123-4567, etc.
  { regex: /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g, href: (m) => `tel:${m.replace(/[^\d+]/g, '')}`, label: (m) => m },
];

function AutoLinkText({ children }) {
  if (typeof children !== 'string') return children;
  // Build a combined regex
  const combined = new RegExp(
    LINK_PATTERNS.map(p => p.regex.source).join('|'), 'g'
  );
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = combined.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    const matched = match[0];
    // Figure out which pattern matched
    const pattern = LINK_PATTERNS.find(p => new RegExp(p.regex.source).test(matched));
    if (pattern) {
      parts.push(
        <Box key={match.index} component="a" href={pattern.href(matched)} target="_blank" rel="noopener noreferrer"
          sx={{
            color: BRAND.info,
            textDecoration: 'none',
            borderBottom: `1px dotted ${alpha(BRAND.info, 0.4)}`,
            transition: 'all 0.15s ease',
            '&:hover': { color: BRAND.primaryLight, borderBottomStyle: 'solid' },
          }}
        >
          {pattern.label(matched)}
        </Box>
      );
    } else {
      parts.push(matched);
    }
    lastIndex = match.index + matched.length;
  }
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : children;
}

const markdownComponents = {
  p: ({ children }) => {
    // Auto-linkify emails and phone numbers in text nodes
    const processed = Array.isArray(children) ? children.map((child, i) =>
      typeof child === 'string' ? <AutoLinkText key={i}>{child}</AutoLinkText> : child
    ) : typeof children === 'string' ? <AutoLinkText>{children}</AutoLinkText> : children;
    return (
      <Typography component="div" sx={{ fontSize: '1.06rem', lineHeight: 1.7, mb: 1, '&:last-child': { mb: 0 }, color: 'inherit', wordBreak: 'break-word' }}>
        {processed}
      </Typography>
    );
  },
  h1: ({ children }) => (
    <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, mb: 1, mt: 1.5, color: 'inherit', borderBottom: `1px solid ${alpha(BRAND.border, 0.3)}`, pb: 0.5 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 0.75, mt: 1.5, color: 'inherit', borderBottom: `1px solid ${alpha(BRAND.border, 0.2)}`, pb: 0.5 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, mb: 0.5, mt: 1, color: 'inherit' }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5, mt: 1, color: 'inherit' }}>{children}</Typography>
  ),
  h5: ({ children }) => (
    <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5, color: 'inherit' }}>{children}</Typography>
  ),
  h6: ({ children }) => (
    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5, color: BRAND.textSecondary }}>{children}</Typography>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700, color: 'inherit' }}>{children}</Box>
  ),
  em: ({ children }) => (
    <Box component="em" sx={{ fontStyle: 'italic', color: 'inherit' }}>{children}</Box>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 2.5, mb: 1, mt: 0.5, '& li': { mb: 0.4 }, '& li::marker': { color: BRAND.secondary } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 2.5, mb: 1, mt: 0.5, '& li': { mb: 0.4 }, '& li::marker': { color: BRAND.primaryLight, fontWeight: 600 } }}>
      {children}
    </Box>
  ),
  li: ({ children }) => {
    const processed = Array.isArray(children) ? children.map((child, i) =>
      typeof child === 'string' ? <AutoLinkText key={i}>{child}</AutoLinkText> : child
    ) : typeof children === 'string' ? <AutoLinkText>{children}</AutoLinkText> : children;
    return <Box component="li" sx={{ fontSize: '1.02rem', lineHeight: 1.6, color: 'inherit', pl: 0.5 }}>{processed}</Box>;
  },
  a: ({ href, children }) => (
    <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{
      color: BRAND.info,
      textDecoration: 'none',
      borderBottom: `1px solid ${alpha(BRAND.info, 0.3)}`,
      transition: 'all 0.15s ease',
      '&:hover': { color: BRAND.primaryLight, borderBottomColor: BRAND.primaryLight },
    }}>
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box sx={{
      borderLeft: `3px solid ${BRAND.primaryLight}`,
      pl: 2, py: 0.5, my: 1,
      background: alpha(BRAND.primary, 0.05),
      borderRadius: '0 8px 8px 0',
      '& p': { mb: 0.5 },
    }}>
      {children}
    </Box>
  ),
  hr: () => (
    <Divider sx={{ my: 1.5, borderColor: alpha(BRAND.border, 0.3) }} />
  ),
  code: ({ className, children, ...props }) => {
    // Fenced code blocks have a className like "language-js"
    const isBlock = className || (typeof children === 'string' && children.includes('\n'));
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    // Inline code
    return (
      <Box component="code" sx={{
        px: 0.75, py: 0.15,
        borderRadius: '5px',
        background: alpha(BRAND.primary, 0.12),
        color: BRAND.primaryLight,
        fontSize: '0.9em',
        fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
        fontWeight: 500,
      }}>
        {children}
      </Box>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <Box sx={{ overflowX: 'auto', my: 1.5, borderRadius: '8px', border: `1px solid ${alpha(BRAND.border, 0.4)}` }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
        {children}
      </Box>
    </Box>
  ),
  thead: ({ children }) => (
    <Box component="thead" sx={{ background: alpha(BRAND.primary, 0.08), '& th': { fontWeight: 700, color: BRAND.textPrimary } }}>
      {children}
    </Box>
  ),
  tbody: ({ children }) => (
    <Box component="tbody" sx={{ '& tr:nth-of-type(even)': { background: alpha(BRAND.bgElevated, 0.4) } }}>
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box component="th" sx={{ px: 1.5, py: 0.75, textAlign: 'left', borderBottom: `1px solid ${alpha(BRAND.border, 0.3)}`, fontSize: '0.85rem' }}>
      {children}
    </Box>
  ),
  td: ({ children }) => {
    const processed = Array.isArray(children) ? children.map((child, i) =>
      typeof child === 'string' ? <AutoLinkText key={i}>{child}</AutoLinkText> : child
    ) : typeof children === 'string' ? <AutoLinkText>{children}</AutoLinkText> : children;
    return (
      <Box component="td" sx={{ px: 1.5, py: 0.75, borderBottom: `1px solid ${alpha(BRAND.border, 0.15)}`, color: BRAND.textSecondary, fontSize: '0.9rem' }}>
        {processed}
      </Box>
    );
  },
};

// ═══ Message Action Bar — Hover-reveal copy, speak, thumbs ═══
function MessageActions({ text, onSpeak, onStopSpeaking, isSpeaking, visible }) {
  const [copied, setCopied] = useState(false);
  const [thumbs, setThumbs] = useState(null); // 'up' | 'down' | null

  const handleCopy = () => {
    navigator.clipboard.writeText(stripMarkdownForSpeech(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{
      display: 'flex', gap: 0.25, mt: 0.5, px: 0.5,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top">
        <IconButton size="small" onClick={handleCopy} sx={{
          width: 28, height: 28,
          color: copied ? BRAND.success : alpha(BRAND.textMuted, 0.5),
          '&:hover': { color: BRAND.primaryLight, background: alpha(BRAND.primary, 0.08) },
          transition: 'all 0.15s ease',
        }}>
          {copied ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
      {onSpeak && (
        <Tooltip title={isSpeaking ? 'Stop' : 'Read aloud'} placement="top">
          <IconButton size="small" onClick={() => isSpeaking ? onStopSpeaking() : onSpeak()} sx={{
            width: 28, height: 28,
            color: isSpeaking ? BRAND.secondary : alpha(BRAND.textMuted, 0.5),
            '&:hover': { color: isSpeaking ? BRAND.secondary : BRAND.primaryLight, background: alpha(BRAND.primary, 0.08) },
            transition: 'all 0.15s ease',
          }}>
            {isSpeaking ? <StopCircleIcon sx={{ fontSize: 15 }} /> : <VolumeUpIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Good response" placement="top">
        <IconButton size="small" onClick={() => setThumbs(t => t === 'up' ? null : 'up')} sx={{
          width: 28, height: 28,
          color: thumbs === 'up' ? BRAND.success : alpha(BRAND.textMuted, 0.5),
          '&:hover': { color: BRAND.success, background: alpha(BRAND.success, 0.08) },
          transition: 'all 0.15s ease',
        }}>
          {thumbs === 'up' ? <ThumbUpIcon sx={{ fontSize: 14 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Bad response" placement="top">
        <IconButton size="small" onClick={() => setThumbs(t => t === 'down' ? null : 'down')} sx={{
          width: 28, height: 28,
          color: thumbs === 'down' ? BRAND.error : alpha(BRAND.textMuted, 0.5),
          '&:hover': { color: BRAND.error, background: alpha(BRAND.error, 0.08) },
          transition: 'all 0.15s ease',
        }}>
          {thumbs === 'down' ? <ThumbDownIcon sx={{ fontSize: 14 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ═══ Selection Toolbar — Floating copy/quote on text select ═══
function SelectionToolbar({ containerRef, onQuote }) {
  const [pos, setPos] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPos(null);
        return;
      }
      // Check if selection is within our container
      const container = containerRef?.current;
      if (!container) return;
      const anchorInside = container.contains(sel.anchorNode);
      if (!anchorInside) { setPos(null); return; }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setSelectedText(sel.toString());
      setPos({
        top: rect.top - containerRect.top - 40,
        left: rect.left - containerRect.left + rect.width / 2 - 60,
      });
    };

    document.addEventListener('selectionchange', handleSelect);
    return () => document.removeEventListener('selectionchange', handleSelect);
  }, [containerRef]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => { setCopied(false); setPos(null); }, 1500);
    window.getSelection()?.removeAllRanges();
  };

  const handleQuote = () => {
    onQuote(selectedText);
    setPos(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!pos) return null;

  return (
    <Box sx={{
      position: 'absolute',
      top: pos.top,
      left: Math.max(8, pos.left),
      zIndex: 100,
      display: 'flex', gap: 0.25,
      background: BRAND.bgElevated,
      border: `1px solid ${alpha(BRAND.border, 0.6)}`,
      borderRadius: '8px',
      boxShadow: `0 4px 16px ${alpha('#000', 0.4)}`,
      p: 0.25,
      animation: 'fadeInScale 0.15s ease',
      '@keyframes fadeInScale': {
        from: { opacity: 0, transform: 'scale(0.9) translateY(4px)' },
        to: { opacity: 1, transform: 'scale(1) translateY(0)' },
      },
    }}>
      <Tooltip title={copied ? 'Copied!' : 'Copy selection'} placement="top">
        <IconButton size="small" onClick={handleCopy} sx={{
          width: 30, height: 30,
          color: copied ? BRAND.success : BRAND.textSecondary,
          '&:hover': { color: BRAND.primaryLight, background: alpha(BRAND.primary, 0.1) },
        }}>
          {copied ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Quote in reply" placement="top">
        <IconButton size="small" onClick={handleQuote} sx={{
          width: 30, height: 30,
          color: BRAND.textSecondary,
          '&:hover': { color: BRAND.primaryLight, background: alpha(BRAND.primary, 0.1) },
        }}>
          <FormatQuoteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ═══ Export Conversation Menu ═══
function ExportMenu({ messages, anchorEl, open, onClose }) {
  const getConversationText = (format = 'text') => {
    return messages
      .filter(m => m.sender !== 'Ace Activity')
      .map(m => {
        const sender = m.sender || 'Unknown';
        const text = format === 'markdown' ? m.text : stripMarkdownForSpeech(m.text);
        return `${sender}:\n${text}`;
      })
      .join('\n\n---\n\n');
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(getConversationText('text'));
    onClose();
  };

  const handleDownload = (format) => {
    const ext = format === 'markdown' ? 'md' : 'txt';
    const content = getConversationText(format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ace-conversation-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}
      slotProps={{ paper: { sx: {
        background: BRAND.bgElevated,
        border: `1px solid ${alpha(BRAND.border, 0.5)}`,
        borderRadius: '10px',
        minWidth: 180,
        boxShadow: `0 8px 24px ${alpha('#000', 0.4)}`,
      }}}}
    >
      <MenuItem onClick={handleCopyAll} sx={{ fontSize: '0.85rem', gap: 1.5, color: BRAND.textSecondary, '&:hover': { color: BRAND.textPrimary, background: alpha(BRAND.primary, 0.08) } }}>
        <ContentCopyIcon sx={{ fontSize: 16 }} /> Copy all
      </MenuItem>
      <MenuItem onClick={() => handleDownload('text')} sx={{ fontSize: '0.85rem', gap: 1.5, color: BRAND.textSecondary, '&:hover': { color: BRAND.textPrimary, background: alpha(BRAND.primary, 0.08) } }}>
        <DownloadIcon sx={{ fontSize: 16 }} /> Download as .txt
      </MenuItem>
      <MenuItem onClick={() => handleDownload('markdown')} sx={{ fontSize: '0.85rem', gap: 1.5, color: BRAND.textSecondary, '&:hover': { color: BRAND.textPrimary, background: alpha(BRAND.primary, 0.08) } }}>
        <DownloadIcon sx={{ fontSize: 16 }} /> Download as .md
      </MenuItem>
    </Menu>
  );
}

function PendingActionsCard({ actions, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => actions.map(() => true));
  const [assignees, setAssignees] = useState(() => actions.map(() => 'ace'));
  const [loading, setLoading] = useState(false);

  const toggle = (i) => setSelected(s => s.map((v, idx) => idx === i ? !v : v));
  const setAssignee = (i, val) => setAssignees(a => a.map((v, idx) => idx === i ? val : v));

  const checkedCount = selected.filter(Boolean).length;

  const handleConfirm = async () => {
    setLoading(true);
    const confirmed = actions
      .filter((_, i) => selected[i])
      .map((action) => {
        const globalIdx = actions.indexOf(action);
        return { ...action, assigned_to: assignees[globalIdx] };
      });
    await onConfirm(confirmed);
  };

  return (
    <Box sx={{
      mt: 1.5,
      border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
      borderRadius: '12px',
      overflow: 'hidden',
      background: alpha(BRAND.bgCard, 0.6),
      backdropFilter: 'blur(10px)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.25,
        background: alpha(BRAND.primary, 0.08),
        borderBottom: `1px solid ${alpha(BRAND.primary, 0.15)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600 }}>
          📋 Ace wants to add <span style={{ color: BRAND.primaryLight }}>{checkedCount}</span> task{checkedCount !== 1 ? 's' : ''} to your pipeline:
        </Typography>
      </Box>

      {/* Action list */}
      <Box sx={{ maxHeight: 240, overflowY: 'auto', py: 0.5 }}>
        {actions.map((action, i) => {
          const pc = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.medium;
          return (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1,
              px: 2, py: 0.75,
              opacity: selected[i] ? 1 : 0.4,
              transition: 'opacity 0.15s',
              '&:hover': { background: alpha(BRAND.primary, 0.04) },
            }}>
              <Checkbox
                checked={selected[i]}
                onChange={() => toggle(i)}
                size="small"
                sx={{ p: 0, mt: 0.2, color: alpha(BRAND.primary, 0.5), '&.Mui-checked': { color: BRAND.primary } }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, lineHeight: 1.4 }}>
                  {action.title}
                </Typography>
                {action.description && (
                  <Typography sx={{
                    fontSize: '0.7rem', color: BRAND.textMuted, mt: 0.25,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {action.description}
                  </Typography>
                )}
                {action.priority && (
                  <Box sx={{
                    display: 'inline-block', mt: 0.4,
                    px: 0.75, py: 0.1,
                    borderRadius: '4px',
                    background: pc.bg, color: pc.text,
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>
                    {action.priority}
                  </Box>
                )}
              </Box>
              <Select
                value={assignees[i]}
                onChange={(e) => setAssignee(i, e.target.value)}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.7rem', minWidth: 80,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(BRAND.border, 0.8) },
                  '& .MuiSelect-select': { py: 0.4, px: 1 },
                }}
              >
                <MenuItem value="ace" sx={{ fontSize: '0.8rem' }}>Ace</MenuItem>
                <MenuItem value="me" sx={{ fontSize: '0.8rem' }}>Me</MenuItem>
                <MenuItem value="team" sx={{ fontSize: '0.8rem' }}>Team</MenuItem>
              </Select>
            </Box>
          );
        })}
      </Box>

      {/* Footer buttons */}
      <Box sx={{
        display: 'flex', gap: 1.5, px: 2, py: 1.25,
        borderTop: `1px solid ${alpha(BRAND.border, 0.5)}`,
      }}>
        <Button
          variant="contained"
          size="small"
          disabled={loading || checkedCount === 0}
          onClick={handleConfirm}
          sx={{
            flex: 1,
            background: loading ? undefined : 'linear-gradient(135deg, #22c55e, #16a34a)',
            fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(34,197,94,0.3)' },
          }}
        >
          {loading ? 'Adding…' : `✅ Add ${checkedCount} to Pipeline`}
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          onClick={onCancel}
          sx={{
            fontSize: '0.75rem', borderRadius: '8px',
            textTransform: 'none',
            borderColor: alpha(BRAND.border, 0.8),
            color: BRAND.textMuted,
            '&:hover': { borderColor: BRAND.primary, color: BRAND.primaryLight },
          }}
        >
          Dismiss
        </Button>
      </Box>
    </Box>
  );
}

function InteractiveQuestion({ question, answered, selectedId, onSelect }) {
  const [customText, setCustomText] = useState('');

  return (
    <Box sx={{
      mt: 1.5,
      border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
      borderRadius: '12px',
      overflow: 'hidden',
      background: alpha(BRAND.bgCard, 0.6),
      backdropFilter: 'blur(10px)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1,
        background: alpha(BRAND.primary, 0.08),
        borderBottom: `1px solid ${alpha(BRAND.primary, 0.15)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <AutoAwesomeIcon sx={{ fontSize: 14, color: BRAND.primaryLight }} />
        <Typography sx={{ fontSize: '0.78rem', color: BRAND.textPrimary, fontWeight: 600 }}>
          Choose an option
        </Typography>
      </Box>

      {/* Option buttons */}
      <Box sx={{ py: 1, px: 1.5 }}>
        {question.options.map((opt) => {
          const isSelected = answered && selectedId === opt.id;
          const isDisabled = answered && selectedId !== opt.id;
          return (
            <Box
              key={opt.id}
              onClick={() => !answered && onSelect(opt.id, opt.label)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 1.25, mb: 0.75,
                borderRadius: '10px',
                cursor: answered ? 'default' : 'pointer',
                border: `1px solid ${isSelected ? BRAND.primary : alpha(BRAND.border, 0.6)}`,
                background: isSelected
                  ? alpha(BRAND.primary, 0.12)
                  : alpha(BRAND.bgElevated, 0.4),
                opacity: isDisabled ? 0.35 : 1,
                transition: 'all 0.2s ease',
                ...(!answered && {
                  '&:hover': {
                    background: alpha(BRAND.primary, 0.1),
                    borderColor: alpha(BRAND.primary, 0.5),
                    transform: 'translateX(4px)',
                  },
                }),
              }}
            >
              {/* Number badge / check icon */}
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected
                  ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`
                  : alpha(BRAND.primary, 0.15),
                color: isSelected ? '#fff' : BRAND.primaryLight,
                fontSize: '0.75rem', fontWeight: 700,
                flexShrink: 0,
              }}>
                {isSelected ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : opt.id}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600, lineHeight: 1.4,
                }}>
                  {opt.label}
                </Typography>
                {opt.description && (
                  <Typography sx={{
                    fontSize: '0.7rem', color: BRAND.textMuted, mt: 0.2,
                  }}>
                    {opt.description}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Custom input */}
      {question.allowCustom && !answered && (
        <Box sx={{
          px: 2, pb: 1.5,
          display: 'flex', gap: 1, alignItems: 'center',
        }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Or type a custom response..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customText.trim()) {
                onSelect('custom', customText.trim());
                setCustomText('');
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                fontSize: '0.8rem',
                background: alpha(BRAND.bgSurface, 0.5),
              },
            }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!customText.trim()}
            onClick={() => { onSelect('custom', customText.trim()); setCustomText(''); }}
            sx={{
              minWidth: 'auto', px: 2,
              fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px',
              textTransform: 'none',
              background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
              boxShadow: 'none',
            }}
          >
            Send
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// SOP EXECUTION CARD — Live step-by-step progress
// ═══════════════════════════════════════════════════════

// ═══ TeachingCard — Guided SOP step builder ═══

function TeachingCard({ teaching, onUpdate, onSave, onCancel }) {
  const [focusIdx, setFocusIdx] = useState(-1);
  const [lastEditedIdx, setLastEditedIdx] = useState(-1);
  const [varName, setVarName] = useState('');
  const [showVarInput, setShowVarInput] = useState(false);
  const stepRefs = useRef([]);
  const phase = teaching?.phase || 'setup';

  // Auto-focus new step row
  useEffect(() => {
    if (focusIdx >= 0 && stepRefs.current[focusIdx]) {
      stepRefs.current[focusIdx].focus();
      setFocusIdx(-1);
    }
  }, [focusIdx, teaching?.steps?.length]);

  if (!teaching) return null;

  const cardSx = {
    mt: 1.5,
    border: `1px solid ${alpha(BRAND.accent, 0.25)}`,
    borderRadius: '12px',
    overflow: 'hidden',
    background: alpha(BRAND.bgCard, 0.6),
    backdropFilter: 'blur(10px)',
  };

  const headerSx = {
    display: 'flex', alignItems: 'center', gap: 1,
    px: 2, py: 1.25,
    background: alpha(BRAND.accent, 0.08),
    borderBottom: `1px solid ${alpha(BRAND.accent, 0.15)}`,
  };

  // ── Phase: Setup ──
  if (phase === 'setup') {
    return (
      <Box sx={cardSx}>
        <Box sx={headerSx}>
          <SchoolIcon sx={{ fontSize: 18, color: BRAND.accent }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: BRAND.textPrimary }}>
            Teach Ace a New Process
          </Typography>
        </Box>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: BRAND.textSecondary, mb: 0.5 }}>
              What should I call this process?
            </Typography>
            <TextField
              fullWidth size="small" placeholder='e.g., "Post on Instagram", "Search for leads"'
              value={teaching.name || ''}
              onChange={(e) => onUpdate({ name: e.target.value })}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem', borderRadius: '8px',
                  background: alpha(BRAND.bgSurface, 0.5),
                  '& fieldset': { borderColor: alpha(BRAND.border, 0.5) },
                  '&:hover fieldset': { borderColor: alpha(BRAND.accent, 0.4) },
                  '&.Mui-focused fieldset': { borderColor: BRAND.accent },
                },
                '& .MuiOutlinedInput-input': { color: BRAND.textPrimary },
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && teaching.name?.trim()) {
                  onUpdate({ phase: 'building' });
                }
              }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: BRAND.textSecondary, mb: 0.5 }}>
              What phrases should trigger it? <span style={{ color: BRAND.textMuted }}>(comma-separated)</span>
            </Typography>
            <TextField
              fullWidth size="small" placeholder='e.g., "post on insta", "share on instagram"'
              value={teaching.triggers || ''}
              onChange={(e) => onUpdate({ triggers: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.8rem', borderRadius: '8px',
                  background: alpha(BRAND.bgSurface, 0.5),
                  '& fieldset': { borderColor: alpha(BRAND.border, 0.5) },
                  '&:hover fieldset': { borderColor: alpha(BRAND.accent, 0.4) },
                  '&.Mui-focused fieldset': { borderColor: BRAND.accent },
                },
                '& .MuiOutlinedInput-input': { color: BRAND.textPrimary },
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
            <Typography
              onClick={onCancel}
              sx={{ fontSize: '0.7rem', color: BRAND.textMuted, cursor: 'pointer', py: 0.75, px: 1, '&:hover': { color: BRAND.textSecondary } }}
            >Cancel</Typography>
            <Button
              size="small"
              disabled={!teaching.name?.trim()}
              onClick={() => onUpdate({ phase: 'building' })}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: '0.7rem', textTransform: 'none', borderRadius: '8px',
                background: `linear-gradient(135deg, ${BRAND.accent}, #E84393)`,
                color: '#fff', px: 2,
                '&:hover': { background: `linear-gradient(135deg, #E84393, ${BRAND.accent})` },
                '&.Mui-disabled': { opacity: 0.4, color: '#fff' },
              }}
            >Next</Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Phase: Step Builder ──
  if (phase === 'building') {
    const steps = teaching.steps || [{ text: '' }];
    const nonEmptyCount = steps.filter(s => s.text?.trim()).length;

    const updateStep = (idx, text) => {
      const newSteps = steps.map((s, i) => i === idx ? { ...s, text } : s);
      onUpdate({ steps: newSteps });
    };

    const removeStep = (idx) => {
      if (steps.length <= 1) return;
      onUpdate({ steps: steps.filter((_, i) => i !== idx) });
    };

    const addStepAfter = (idx) => {
      const newSteps = [...steps];
      newSteps.splice(idx + 1, 0, { text: '' });
      onUpdate({ steps: newSteps });
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

    return (
      <Box sx={cardSx}>
        <Box sx={headerSx}>
          <SchoolIcon sx={{ fontSize: 18, color: BRAND.accent }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: BRAND.textPrimary }}>
            {teaching.name}
          </Typography>
          <Chip label="Building steps" size="small" sx={{
            ml: 'auto', height: 20, fontSize: '0.6rem',
            background: alpha(BRAND.accent, 0.15), color: BRAND.accent,
          }} />
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontSize: '0.7rem', color: BRAND.textSecondary, mb: 1.5 }}>
            Describe each step in plain English. Press Enter after each step.
          </Typography>

          {/* Step rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {steps.map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {/* Number badge */}
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.text?.trim() ? alpha(BRAND.accent, 0.2) : alpha(BRAND.border, 0.3),
                  border: `1px solid ${step.text?.trim() ? alpha(BRAND.accent, 0.3) : alpha(BRAND.border, 0.3)}`,
                }}>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: step.text?.trim() ? BRAND.accent : BRAND.textMuted }}>
                    {idx + 1}
                  </Typography>
                </Box>

                {/* Step text input */}
                <TextField
                  fullWidth size="small"
                  placeholder={idx === 0 ? 'e.g., Go to https://google.com' : idx === 1 ? 'e.g., Type {{search_query}} in search field' : 'Next step...'}
                  value={step.text || ''}
                  onChange={(e) => { updateStep(idx, e.target.value); setLastEditedIdx(idx); }}
                  onKeyDown={(e) => handleStepKeyDown(e, idx)}
                  onFocus={() => setLastEditedIdx(idx)}
                  inputRef={(el) => { stepRefs.current[idx] = el; }}
                  autoFocus={idx === 0 && steps.length === 1}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.78rem', borderRadius: '8px',
                      background: alpha(BRAND.bgSurface, 0.4),
                      '& fieldset': { borderColor: alpha(BRAND.border, 0.3) },
                      '&:hover fieldset': { borderColor: alpha(BRAND.accent, 0.3) },
                      '&.Mui-focused fieldset': { borderColor: BRAND.accent },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: BRAND.textPrimary, py: 0.75, px: 1.25,
                    },
                  }}
                />

                {/* Delete button */}
                {steps.length > 1 && (
                  <IconButton size="small" onClick={() => removeStep(idx)}
                    sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: BRAND.error } }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>

          {/* Add step + fill-in-the-blank helpers */}
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button size="small"
              onClick={() => addStepAfter(steps.length - 1)}
              sx={{ fontSize: '0.65rem', textTransform: 'none', color: BRAND.accent, alignSelf: 'flex-start', '&:hover': { background: alpha(BRAND.accent, 0.08) } }}
            >+ Add step</Button>

            {/* Fill-in-the-blank: common options + custom */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={{ fontSize: '0.6rem', color: BRAND.textMuted }}>
                If part of a step changes each time, tap a blank to insert it:
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
                    label={`[${v.label}]`}
                    size="small"
                    onClick={() => {
                      const targetIdx = lastEditedIdx >= 0 ? lastEditedIdx
                        : steps.findLastIndex(s => s.text?.trim()) >= 0
                          ? steps.findLastIndex(s => s.text?.trim())
                          : steps.length - 1;
                      const current = steps[targetIdx]?.text || '';
                      const insertion = `{{${v.key}}}`;
                      const newText = current ? `${current} ${insertion}` : insertion;
                      updateStep(targetIdx, newText);
                      setFocusIdx(targetIdx);
                    }}
                    sx={{
                      height: 22, fontSize: '0.6rem', cursor: 'pointer',
                      background: alpha(BRAND.info, 0.08),
                      border: `1px dashed ${alpha(BRAND.info, 0.3)}`,
                      color: BRAND.info,
                      '&:hover': { background: alpha(BRAND.info, 0.18), borderStyle: 'solid' },
                    }}
                  />
                ))}

                {/* Custom variable input */}
                {!showVarInput ? (
                  <Chip
                    label="+ custom blank"
                    size="small"
                    onClick={() => setShowVarInput(true)}
                    sx={{
                      height: 22, fontSize: '0.6rem', cursor: 'pointer',
                      background: 'transparent',
                      border: `1px dashed ${alpha(BRAND.textMuted, 0.3)}`,
                      color: BRAND.textMuted,
                      '&:hover': { background: alpha(BRAND.textMuted, 0.08), color: BRAND.textSecondary },
                    }}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      size="small" autoFocus
                      placeholder="e.g., company, email, url"
                      value={varName}
                      onChange={(e) => setVarName(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && varName.trim()) {
                          const targetIdx = lastEditedIdx >= 0 ? lastEditedIdx
                            : steps.findLastIndex(s => s.text?.trim()) >= 0
                              ? steps.findLastIndex(s => s.text?.trim())
                              : steps.length - 1;
                          const current = steps[targetIdx]?.text || '';
                          const newText = current ? `${current} {{${varName.trim()}}}` : `{{${varName.trim()}}}`;
                          updateStep(targetIdx, newText);
                          setFocusIdx(targetIdx);
                          setVarName('');
                          setShowVarInput(false);
                        }
                        if (e.key === 'Escape') { setVarName(''); setShowVarInput(false); }
                      }}
                      sx={{
                        width: 140,
                        '& .MuiOutlinedInput-root': {
                          fontSize: '0.65rem', borderRadius: '6px', height: 24,
                          background: alpha(BRAND.bgSurface, 0.5),
                          '& fieldset': { borderColor: alpha(BRAND.info, 0.3) },
                          '&.Mui-focused fieldset': { borderColor: BRAND.info },
                        },
                        '& .MuiOutlinedInput-input': { color: BRAND.info, py: 0.25, px: 0.75 },
                      }}
                    />
                    <Typography
                      onClick={() => { setVarName(''); setShowVarInput(false); }}
                      sx={{ fontSize: '0.6rem', color: BRAND.textMuted, cursor: 'pointer' }}
                    >cancel</Typography>
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.55rem', color: BRAND.textMuted, fontStyle: 'italic' }}>
                Example: "Type property managers in [city / location]" — Ace will ask for the city when you run it
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Typography
              onClick={() => onUpdate({ phase: 'setup' })}
              sx={{ fontSize: '0.7rem', color: BRAND.textMuted, cursor: 'pointer', py: 0.75, px: 1, '&:hover': { color: BRAND.textSecondary } }}
            >Back</Typography>
            <Button
              size="small"
              disabled={nonEmptyCount < 2}
              onClick={onSave}
              sx={{
                fontSize: '0.7rem', textTransform: 'none', borderRadius: '8px',
                background: `linear-gradient(135deg, ${BRAND.accent}, #E84393)`,
                color: '#fff', px: 2,
                '&:hover': { background: `linear-gradient(135deg, #E84393, ${BRAND.accent})` },
                '&.Mui-disabled': { opacity: 0.4, color: '#fff' },
              }}
            >Preview & Save</Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Phase: Reviewing ──
  if (phase === 'reviewing') {
    const { qualityResult, parsedSteps } = teaching;
    const stepScores = qualityResult?.stepScores || [];
    const weakCount = qualityResult?.weakSteps?.length || 0;

    return (
      <Box sx={cardSx}>
        <Box sx={headerSx}>
          <SchoolIcon sx={{ fontSize: 18, color: BRAND.accent }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: BRAND.textPrimary }}>
            Review: {teaching.name}
          </Typography>
          {qualityResult && (
            <Chip
              label={`Quality: ${qualityResult.overallScore}%`}
              size="small"
              sx={{
                ml: 'auto', height: 20, fontSize: '0.6rem', fontWeight: 600,
                background: alpha(qualityResult.overallScore >= 70 ? BRAND.success : qualityResult.overallScore >= 40 ? BRAND.warning : BRAND.error, 0.15),
                color: qualityResult.overallScore >= 70 ? BRAND.success : qualityResult.overallScore >= 40 ? BRAND.warning : BRAND.error,
              }}
            />
          )}
        </Box>
        <Box sx={{ p: 2 }}>
          {/* Step quality list */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {(parsedSteps || []).map((step, idx) => {
              const scoreData = stepScores[idx] || {};
              const isWeak = scoreData.score < 50;
              const stepColor = scoreData.score >= 70 ? BRAND.success : scoreData.score >= 40 ? BRAND.warning : BRAND.error;

              return (
                <Box key={idx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {/* Status icon */}
                    {isWeak ? (
                      <ErrorOutlineIcon sx={{ fontSize: 16, color: BRAND.warning, flexShrink: 0 }} />
                    ) : (
                      <CheckCircleIcon sx={{ fontSize: 16, color: BRAND.success, flexShrink: 0 }} />
                    )}
                    {/* Step description */}
                    <Typography sx={{ fontSize: '0.75rem', color: BRAND.textPrimary, flex: 1 }}>
                      {step.description || `${step.action}: ${step.target || step.text || step.url || step.key || ''}`}
                    </Typography>
                    {/* Score badge */}
                    <Typography sx={{ fontSize: '0.6rem', color: stepColor, fontWeight: 600, flexShrink: 0 }}>
                      {scoreData.score}/100
                    </Typography>
                  </Box>
                  {/* Weak step suggestions */}
                  {isWeak && scoreData.suggestions?.length > 0 && (
                    <Box sx={{ ml: 3, mt: 0.25 }}>
                      {scoreData.suggestions.map((s, si) => (
                        <Typography key={si} sx={{ fontSize: '0.6rem', color: BRAND.warning, fontStyle: 'italic' }}>
                          {s}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Typography
              onClick={() => onUpdate({ phase: 'building' })}
              sx={{ fontSize: '0.7rem', color: BRAND.textMuted, cursor: 'pointer', py: 0.75, px: 1, '&:hover': { color: BRAND.textSecondary } }}
            >Edit Steps</Typography>
            <Button
              size="small"
              onClick={onSave}
              sx={{
                fontSize: '0.7rem', textTransform: 'none', borderRadius: '8px',
                background: weakCount > 0
                  ? `linear-gradient(135deg, ${BRAND.warning}, #E67E22)`
                  : `linear-gradient(135deg, ${BRAND.success}, #00B894)`,
                color: '#fff', px: 2,
                '&:hover': { opacity: 0.9 },
              }}
            >{weakCount > 0 ? `Save Anyway (${weakCount} weak)` : 'Save Process'}</Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Phase: Saving ──
  if (phase === 'saving') {
    return (
      <Box sx={cardSx}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} sx={{ color: BRAND.accent }} />
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary }}>
            Saving process...
          </Typography>
        </Box>
      </Box>
    );
  }

  // ── Phase: Done ──
  if (phase === 'done') {
    const triggerText = teaching.savedSop?.triggers?.[0] || teaching.name?.toLowerCase();
    return (
      <Box sx={cardSx}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CheckCircleIcon sx={{ fontSize: 22, color: BRAND.success }} />
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: BRAND.textPrimary }}>
              Process saved!
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: BRAND.textMuted }}>
              Try saying: "{triggerText}"
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Phase: Error ──
  if (phase === 'error') {
    return (
      <Box sx={cardSx}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ErrorOutlineIcon sx={{ fontSize: 22, color: BRAND.error }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', color: BRAND.error }}>
              Could not save: {teaching.error}
            </Typography>
          </Box>
          <Typography
            onClick={() => onUpdate({ phase: 'building' })}
            sx={{ fontSize: '0.7rem', color: BRAND.accent, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >Try Again</Typography>
        </Box>
      </Box>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════

const STEP_STATUS_STYLES = {
  pending: { color: '#8888A8', icon: null },
  running: { color: '#FFA726', icon: null }, // uses CircularProgress
  done: { color: '#4ade80', icon: CheckCircleIcon },
  failed: { color: '#FF7675', icon: ErrorOutlineIcon },
};

function SOPExecutionCard({ execution, onStepCorrect }) {
  if (!execution) return null;
  const { sopName, steps, status } = execution;
  const completedCount = steps.filter(s => s.status === 'done').length;
  const failedCount = steps.filter(s => s.status === 'failed').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const headerColor = status === 'completed' ? '#4ade80'
    : status === 'failed' ? '#FF7675'
    : '#FFA726';
  const headerLabel = status === 'completed' ? 'Completed'
    : status === 'failed' ? `Failed at step ${steps.findIndex(s => s.status === 'failed') + 1}`
    : 'Running';

  return (
    <Box sx={{
      mt: 1.5,
      border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
      borderRadius: '12px',
      overflow: 'hidden',
      background: alpha(BRAND.bgCard, 0.6),
      backdropFilter: 'blur(10px)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.25,
        background: alpha(headerColor, 0.08),
        borderBottom: `1px solid ${alpha(headerColor, 0.15)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <PlayArrowIcon sx={{ fontSize: 16, color: headerColor }} />
        <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600, flex: 1 }}>
          {sopName}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {status === 'running' && (
            <FiberManualRecordIcon sx={{
              fontSize: 10, color: '#4ade80',
              animation: 'sopPulse 1.5s infinite',
              '@keyframes sopPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }} />
          )}
          <Typography sx={{ fontSize: '0.7rem', color: headerColor, fontWeight: 600 }}>
            {headerLabel}
          </Typography>
        </Box>
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 3,
          background: alpha(BRAND.border, 0.3),
          '& .MuiLinearProgress-bar': {
            background: failedCount > 0
              ? `linear-gradient(90deg, #4ade80 ${progress - 5}%, #FF7675)`
              : `linear-gradient(90deg, ${BRAND.primary}, #4ade80)`,
          },
        }}
      />

      {/* Steps */}
      <Box sx={{ py: 0.5, maxHeight: 280, overflowY: 'auto' }}>
        {steps.map((step, i) => {
          const style = STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.pending;
          const StatusIcon = style.icon;
          const isClickable = step.status === 'done' && onStepCorrect && (status === 'completed' || status === 'failed');
          return (
            <Tooltip
              key={i}
              title={isClickable ? "That wasn't right — Show Ace How" : ''}
              placement="left"
              arrow
            >
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 0.6,
                opacity: step.status === 'pending' ? 0.45 : 1,
                transition: 'all 0.2s',
                cursor: isClickable ? 'pointer' : 'default',
                '&:hover': isClickable ? {
                  background: alpha('#FF7675', 0.06),
                  '& .step-correct-hint': { opacity: 1 },
                } : {},
              }}
              onClick={isClickable ? () => onStepCorrect(execution.sopId, step.stepNum, step.description || step.action) : undefined}
              >
                {/* Step number */}
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.status === 'done' ? alpha('#4ade80', 0.15)
                    : step.status === 'failed' ? alpha('#FF7675', 0.15)
                    : step.status === 'running' ? alpha('#FFA726', 0.15)
                    : alpha(BRAND.border, 0.3),
                  fontSize: '0.65rem', fontWeight: 700, color: style.color,
                  flexShrink: 0,
                }}>
                  {step.stepNum}
                </Box>

                {/* Description */}
                <Typography sx={{
                  fontSize: '0.75rem', color: BRAND.textSecondary, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {step.description || step.action}
                </Typography>

                {/* "Show Ace How" hint on hover */}
                {isClickable && (
                  <CameraAltIcon className="step-correct-hint" sx={{
                    fontSize: 14, color: alpha('#FF7675', 0.6),
                    opacity: 0, transition: 'opacity 0.2s', flexShrink: 0, mr: 0.5,
                  }} />
                )}

                {/* Status icon */}
                <Box sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step.status === 'running' && (
                    <CircularProgress size={14} thickness={5} sx={{ color: '#FFA726' }} />
                  )}
                  {StatusIcon && <StatusIcon sx={{ fontSize: 16, color: style.color }} />}
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Footer summary */}
      <Box sx={{
        px: 2, py: 0.75,
        borderTop: `1px solid ${alpha(BRAND.border, 0.3)}`,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted }}>
          {completedCount}/{steps.length} steps done
        </Typography>
        {failedCount > 0 && (
          <Typography sx={{ fontSize: '0.65rem', color: '#FF7675' }}>
            {failedCount} failed
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// SHOW ME CARD — "Step got stuck, want to show me?"
// ═══════════════════════════════════════════════════════

function ShowMeCard({ showMe, showMeState, onReady, onStart, onDone, onSkip }) {
  if (!showMe) return null;
  const { stepNum, description, error, screenshot } = showMe;

  // State 6: Skipped
  if (showMeState === 'skipped') {
    return (
      <Box sx={{
        mt: 1.5, px: 2, py: 1.5,
        border: `1px solid ${alpha(BRAND.border, 0.3)}`,
        borderRadius: '12px',
        background: alpha(BRAND.bgCard, 0.3),
        opacity: 0.5,
      }}>
        <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted }}>
          Skipped — you can show me anytime
        </Typography>
      </Box>
    );
  }

  // State 5: Saved
  if (showMeState === 'saved') {
    return (
      <Box sx={{
        mt: 1.5, px: 2, py: 1.5,
        border: `1px solid ${alpha('#4ade80', 0.3)}`,
        borderRadius: '12px',
        background: alpha('#4ade80', 0.06),
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <CheckCircleIcon sx={{ fontSize: 20, color: '#4ade80' }} />
        <Typography sx={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600 }}>
          Got it! I'll use this next time.
        </Typography>
      </Box>
    );
  }

  // State 4: Saving
  if (showMeState === 'saving') {
    return (
      <Box sx={{
        mt: 1.5, px: 2, py: 2,
        border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
        borderRadius: '12px',
        background: alpha(BRAND.bgCard, 0.6),
        display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center',
      }}>
        <CircularProgress size={18} sx={{ color: BRAND.primaryLight }} />
        <Typography sx={{ fontSize: '0.8rem', color: BRAND.textSecondary }}>
          Analyzing your demonstration...
        </Typography>
      </Box>
    );
  }

  // State 3a: Recording (full)
  if (showMeState === 'recording') {
    return (
      <Box sx={{
        mt: 1.5, px: 2, py: 1.5,
        border: `1px solid ${alpha('#f44336', 0.3)}`,
        borderRadius: '12px',
        background: alpha('#f44336', 0.06),
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FiberManualRecordIcon sx={{
            fontSize: 12, color: '#f44336',
            animation: 'recPulse 1s infinite',
            '@keyframes recPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.2 },
            },
          }} />
          <Typography sx={{ fontSize: '0.8rem', color: '#f44336', fontWeight: 600 }}>
            Recording... I'm watching your screen
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 1.5 }}>
          A floating control window should be open. Press <strong>Cmd+Shift+D</strong> or click Done there when finished.
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={onDone}
          sx={{
            background: 'linear-gradient(135deg, #4ade80, #22c55e)',
            fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px',
            textTransform: 'none', boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(34,197,94,0.3)' },
          }}
        >
          Done Recording
        </Button>
      </Box>
    );
  }

  // State 3b: Click-through mode
  if (showMeState === 'click_through') {
    return (
      <Box sx={{
        mt: 1.5, px: 2, py: 1.5,
        border: `1px solid ${alpha(BRAND.secondary, 0.3)}`,
        borderRadius: '12px',
        background: alpha(BRAND.secondary, 0.06),
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FiberManualRecordIcon sx={{
            fontSize: 12, color: BRAND.secondary,
            animation: 'recPulse 1s infinite',
          }} />
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.secondary, fontWeight: 600 }}>
            Click-through mode
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 1.5 }}>
          Click on each thing you want me to learn, in order. The floating window tracks your actions.
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={onDone}
          sx={{
            background: 'linear-gradient(135deg, #4ade80, #22c55e)',
            fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px',
            textTransform: 'none', boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(34,197,94,0.3)' },
          }}
        >
          Done — I've shown everything
        </Button>
      </Box>
    );
  }

  // State 2: Get ready — choose recording mode
  if (showMeState === 'get_ready') {
    return (
      <Box sx={{
        mt: 1.5,
        border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
        borderRadius: '12px',
        overflow: 'hidden',
        background: alpha(BRAND.bgCard, 0.6),
        backdropFilter: 'blur(10px)',
      }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600, mb: 1 }}>
            Get to the right spot on your screen, then pick how you want to show me:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => onStart('recording')}
              startIcon={<VideocamIcon sx={{ fontSize: 18 }} />}
              sx={{
                background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                fontSize: '0.78rem', fontWeight: 700, borderRadius: '10px',
                textTransform: 'none', py: 1.2, boxShadow: 'none',
                '&:hover': { boxShadow: '0 4px 14px rgba(34,197,94,0.3)' },
              }}
            >
              Watch Me Do It
            </Button>
            <Button
              variant="outlined"
              onClick={() => onStart('click_through')}
              startIcon={<CameraAltIcon sx={{ fontSize: 18 }} />}
              sx={{
                fontSize: '0.78rem', fontWeight: 600, borderRadius: '10px',
                textTransform: 'none', py: 1,
                borderColor: alpha(BRAND.primary, 0.4),
                color: BRAND.primaryLight,
                '&:hover': { borderColor: BRAND.primary, background: alpha(BRAND.primary, 0.08) },
              }}
            >
              Let Me Point It Out
            </Button>
          </Box>

          <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted, mt: 1 }}>
            A small floating window will appear so you can control the recording from anywhere
          </Typography>
        </Box>
      </Box>
    );
  }

  // State 1: Prompt (default)
  return (
    <Box sx={{
      mt: 1.5,
      border: `1px solid ${alpha(BRAND.accent, 0.25)}`,
      borderRadius: '12px',
      overflow: 'hidden',
      background: alpha(BRAND.bgCard, 0.6),
      backdropFilter: 'blur(10px)',
    }}>
      <Box sx={{
        px: 2, py: 1.25,
        background: alpha(BRAND.accent, 0.08),
        borderBottom: `1px solid ${alpha(BRAND.accent, 0.15)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
        }}>
          <CameraAltIcon sx={{ fontSize: 14, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600 }}>
          Step {stepNum} needs your help
        </Typography>
      </Box>

      <Box sx={{ px: 2, py: 1.5 }}>
        {description && (
          <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary, mb: 0.5 }}>
            {description}
          </Typography>
        )}
        {error && (
          <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted, mb: 1.5, fontStyle: 'italic' }}>
            What went wrong: {error}
          </Typography>
        )}

        {/* Failure screenshot — shows what Ace was looking at when the step failed */}
        {screenshot && (
          <Box sx={{
            mb: 1.5, borderRadius: '8px', overflow: 'hidden',
            border: `1px solid ${alpha(BRAND.border, 0.3)}`,
          }}>
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="What Ace saw when the step failed"
              style={{ width: '100%', display: 'block' }}
            />
            <Typography sx={{
              fontSize: '0.65rem', color: BRAND.textMuted, px: 1, py: 0.5,
              background: alpha(BRAND.bgCard, 0.8),
            }}>
              This is what I was looking at when the step failed
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={onReady}
            sx={{
              background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.primary})`,
              fontSize: '0.78rem', fontWeight: 700, borderRadius: '10px',
              textTransform: 'none', px: 2.5, py: 0.8,
              boxShadow: 'none',
              '&:hover': { boxShadow: `0 4px 14px ${alpha(BRAND.accent, 0.4)}` },
            }}
          >
            Show Ace How
          </Button>
          <Typography
            onClick={onSkip}
            sx={{
              fontSize: '0.7rem', color: BRAND.textMuted,
              cursor: 'pointer',
              '&:hover': { color: BRAND.textSecondary, textDecoration: 'underline' },
            }}
          >
            Skip for now
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// SOP HEALTH CARD — Reliability summary in chat
// ═══════════════════════════════════════════════════════

function getHealthColor(reliability) {
  if (reliability >= 0.8) return '#4ade80';
  if (reliability >= 0.5) return '#FFA726';
  return '#FF7675';
}

function SOPHealthCard({ sopHealth, onShowMe }) {
  if (!sopHealth) return null;
  const { sopId, sopName, learning, steps } = sopHealth;
  const successRate = learning?.successRate ?? 1;
  const totalRuns = learning?.totalRuns ?? 0;
  const stepInsights = learning?.stepInsights || {};

  const strugglingSteps = steps?.reduce((acc, step, i) => {
    const insight = stepInsights[i + 1];
    if (insight && insight.reliability < 0.5) acc.push({ ...step, _idx: i });
    return acc;
  }, []) || [];

  return (
    <Box sx={{
      mt: 1.5,
      border: `1px solid ${alpha(getHealthColor(successRate), 0.25)}`,
      borderRadius: '12px',
      overflow: 'hidden',
      background: alpha(BRAND.bgCard, 0.6),
      backdropFilter: 'blur(10px)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.25,
        background: alpha(getHealthColor(successRate), 0.08),
        borderBottom: `1px solid ${alpha(getHealthColor(successRate), 0.15)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Typography sx={{ fontSize: '0.8rem', color: BRAND.textPrimary, fontWeight: 600, flex: 1 }}>
          {sopName}
        </Typography>
        <Tooltip title={`${totalRuns} runs total`}>
          <Typography sx={{
            fontSize: '0.75rem', fontWeight: 700,
            color: getHealthColor(successRate),
          }}>
            {Math.round(successRate * 100)}% reliable
          </Typography>
        </Tooltip>
      </Box>

      {/* Step health dots */}
      {steps && steps.length > 0 && (
        <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {steps.map((s, i) => {
            const insight = stepInsights[i + 1];
            const rel = insight?.reliability ?? 1;
            return (
              <Tooltip key={i} title={`Step ${i + 1}: ${s.description || s.action} — ${Math.round(rel * 100)}%`}>
                <Box sx={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: getHealthColor(rel),
                  opacity: 0.85,
                }} />
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* Struggling steps */}
      {strugglingSteps.length > 0 && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted, mb: 0.5 }}>
            {strugglingSteps.length} step{strugglingSteps.length !== 1 ? 's' : ''} need help:
          </Typography>
          {strugglingSteps.map((s, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3 }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#FF7675', flex: 1 }}>
                  Step {s._idx + 1}: {s.description || s.action}
                </Typography>
                <Typography
                  onClick={() => onShowMe(sopId, s._idx + 1, s.description || s.action)}
                  sx={{
                    fontSize: '0.65rem', color: BRAND.accent,
                    cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Show Ace How
                </Typography>
              </Box>
          ))}
        </Box>
      )}

      {/* Footer */}
      <Box sx={{
        px: 2, py: 0.75,
        borderTop: `1px solid ${alpha(BRAND.border, 0.3)}`,
      }}>
        <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted }}>
          {totalRuns} run{totalRuns !== 1 ? 's' : ''} recorded
        </Typography>
      </Box>
    </Box>
  );
}

function MessageBubble({ msg, msgIndex, onConfirmActions, onCancelActions, onQuestionAnswer, onShowMeReady, onShowMeStart, onShowMeDone, onShowMeSkip, onHealthShowMe, onStepCorrect, onTeachingUpdate, onTeachingSave, onTeachingCancel, onSpeak, onStopSpeaking, isSpeakingThis }) {
  const isUser = msg.sender === 'You';
  const isSystem = msg.sender === 'System';
  const isThinking = msg.sender?.includes('Thinking') || msg.sender?.includes('Thought');
  const isAce = !isUser && !isSystem && !isThinking;
  const [hovered, setHovered] = useState(false);

  const getBubbleStyle = () => {
    if (isUser) return {
      background: alpha(BRAND.primary, 0.12),
      color: BRAND.textPrimary,
      borderRadius: '18px 18px 4px 18px',
    };
    if (isSystem) return {
      background: alpha(BRAND.warning, 0.06),
      color: BRAND.textSecondary,
      borderRadius: '12px',
      border: `1px solid ${alpha(BRAND.warning, 0.1)}`,
      fontSize: '0.85rem',
    };
    if (isThinking) return {
      background: 'transparent',
      color: BRAND.textMuted,
      fontSize: '0.85rem',
    };
    return {
      background: 'transparent',
      color: BRAND.textPrimary,
    };
  };

  const getAvatar = () => {
    if (isUser) return (
      <Avatar sx={{
        width: 28, height: 28,
        background: BRAND.primary,
        fontSize: '0.75rem', fontWeight: 700,
      }}>
        <PersonIcon sx={{ fontSize: 16 }} />
      </Avatar>
    );
    if (isSystem) return (
      <Avatar sx={{
        width: 28, height: 28,
        background: alpha(BRAND.warning, 0.15),
        color: BRAND.warning,
      }}>
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </Avatar>
    );
    if (isThinking) return (
      <Avatar sx={{
        width: 28, height: 28,
        background: alpha(BRAND.textMuted, 0.08),
        color: BRAND.textMuted,
      }}>
        <AceSpadeIcon sx={{ fontSize: 14 }} />
      </Avatar>
    );
    // Ace avatar — spade icon (Clubs model)
    return (
      <Box sx={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <AceSpadeIcon sx={{ fontSize: 18, color: BRAND.primary }} />
      </Box>
    );
  };

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 1,
        mb: 1.5,
        px: { xs: 1.5, md: 2 },
        maxWidth: 800,
        mx: 'auto',
        width: '100%',
        animation: 'fadeInUp 0.2s ease',
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {getAvatar()}
      <Box sx={{ maxWidth: '85%', minWidth: 0 }}>
        <Typography variant="caption" sx={{
          display: 'block',
          color: BRAND.textMuted,
          fontSize: '0.8rem',
          mb: 0.5,
          px: 0.5,
          textAlign: isUser ? 'right' : 'left',
        }}>
          {msg.sender}
        </Typography>
        <Box sx={{
          px: isUser ? 2 : 0.5, py: isUser ? 1.5 : 0.5, ...getBubbleStyle(),
          ...(isSpeakingThis && {
            boxShadow: `0 0 12px ${alpha(BRAND.secondary, 0.2)}`,
            borderColor: alpha(BRAND.secondary, 0.3),
            transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
          }),
        }}>
          {/* Attached images */}
          {msg.images && msg.images.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, mb: msg.text ? 1 : 0, flexWrap: 'wrap' }}>
              {msg.images.map((src, i) => (
                <Box key={i} sx={{
                  width: 120, height: 90, borderRadius: '8px',
                  overflow: 'hidden', cursor: 'pointer',
                  border: `1px solid ${alpha('#fff', 0.15)}`,
                }} onClick={() => window.open(src, '_blank')}>
                  <img src={src} alt={`Attachment ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ))}
            </Box>
          )}
          {msg.text && (
            isAce ? (
              <Box sx={{ '& > *:first-of-type': { mt: 0 }, '& > *:last-child': { mb: 0 }, wordBreak: 'break-word' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {/* The model sometimes writes a download as image syntax — ![Download](…)
                      — which renders as a broken image instead of something tappable.
                      Demote those to ordinary links so the file is always reachable. */}
                  {msg.text.replace(
                    /!\[([^\]]*)\]\((\/(?:api\/documents|projects|forms)\/[^)]+)\)/g,
                    // An empty label leaves a link with nothing to tap, so name it.
                    (_m, label, href) => `[${label || (href.includes('/api/documents/') ? 'Download' : 'Open')}](${href})`
                  )}
                </ReactMarkdown>
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                fontSize: '1.06rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.text}
              </Typography>
            )
          )}
        </Box>

        {/* Tools used — friendly labels */}
        {msg.toolsUsed?.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, px: 0.5 }}>
            {/* Deduplicate and show friendly labels */}
            {[...new Set(msg.toolsUsed)].map((tool, i) => {
              const info = getToolInfo(tool);
              const ToolIcon = info.icon;
              const count = msg.toolsUsed.filter(t => t === tool).length;
              return (
                <Chip key={i}
                  label={count > 1 ? `${info.label} (${count}x)` : info.label}
                  size="small"
                  sx={{
                    fontSize: '0.68rem', height: 22, fontWeight: 500,
                    bgcolor: alpha(info.color, 0.08),
                    color: alpha(info.color, 0.9),
                    border: `1px solid ${alpha(info.color, 0.15)}`,
                    '& .MuiChip-icon': { fontSize: 13, color: alpha(info.color, 0.7) },
                  }}
                  icon={<ToolIcon />}
                />
              );
            })}
          </Box>
        )}

        {/* Message action bar — hover reveal on Ace messages */}
        {isAce && msg.text && (
          <MessageActions
            text={msg.text}
            onSpeak={onSpeak ? () => onSpeak(msg.text, msgIndex) : null}
            onStopSpeaking={onStopSpeaking}
            isSpeaking={isSpeakingThis}
            visible={hovered || isSpeakingThis}
          />
        )}

        {/* Confirmation card for pending pipeline actions */}
        {msg.pendingActions && !msg.actionsConfirmed && (
          <PendingActionsCard
            actions={msg.pendingActions}
            onConfirm={onConfirmActions}
            onCancel={onCancelActions}
          />
        )}

        {/* Success summary after confirmation */}
        {msg.actionsConfirmed && msg.actionsResult && (
          <Box sx={{
            mt: 1, display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.75,
            borderRadius: '8px',
            background: alpha('#22c55e', 0.08),
            border: `1px solid ${alpha('#22c55e', 0.2)}`,
          }}>
            <CheckCircleIcon sx={{ fontSize: 14, color: '#4ade80' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#4ade80' }}>
              {msg.actionsResult.success
                ? `Added ${msg.actionsResult.results?.filter(r => r.success).length || 0} item(s) to pipeline`
                : msg.actionsResult.error || 'Some actions failed'}
            </Typography>
          </Box>
        )}

        {/* Interactive question card */}
        {msg.question && (
          <InteractiveQuestion
            question={msg.question}
            answered={msg.questionAnswered || false}
            selectedId={msg.questionSelectedId}
            onSelect={onQuestionAnswer}
          />
        )}

        {/* SOP Execution progress card */}
        {msg.sopExecution && (
          <SOPExecutionCard execution={msg.sopExecution} onStepCorrect={onStepCorrect} />
        )}

        {/* Live Recording Preview — shows steps as they're captured */}
        {msg.isRecordingPreview && isTraining && (
          <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(244,67,54,0.08)', borderRadius: 2, border: '1px solid rgba(244,67,54,0.2)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%', bgcolor: '#f44336',
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              }} />
              <Typography variant="caption" sx={{ color: '#f44336', fontWeight: 600 }}>
                Recording... {recordingSteps.length} step{recordingSteps.length !== 1 ? 's' : ''} captured
              </Typography>
            </Box>
            {recordingSteps.length > 0 && (
              <Box sx={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {recordingSteps.slice(-6).map((step, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem' }}>
                    <Chip
                      label={step.type === 'click' ? 'Click' : step.type === 'key' ? 'Key' : step.type === 'scroll' ? 'Scroll' : step.type}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: step.type === 'click' ? 'rgba(33,150,243,0.15)' : step.type === 'key' ? 'rgba(76,175,80,0.15)' : 'rgba(158,158,158,0.15)',
                        color: step.type === 'click' ? '#2196f3' : step.type === 'key' ? '#4caf50' : '#9e9e9e',
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {step.type === 'click' ? `(${step.x}, ${step.y})` :
                       step.type === 'key' ? (step.key || '?') :
                       step.type === 'scroll' ? (step.direction || 'down') : ''}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Show Me How card */}
        {msg.showMe && (
          <ShowMeCard
            showMe={msg.showMe}
            showMeState={msg.showMeState || 'prompt'}
            onReady={onShowMeReady}
            onStart={(mode) => onShowMeStart(mode)}
            onDone={onShowMeDone}
            onSkip={onShowMeSkip}
          />
        )}

        {/* SOP Health summary card */}
        {msg.sopHealth && (
          <SOPHealthCard
            sopHealth={msg.sopHealth}
            onShowMe={(sopId, stepNum, desc) => onHealthShowMe(sopId, stepNum, desc)}
          />
        )}

        {/* Teaching Card — Guided SOP builder */}
        {msg.teaching && (
          <TeachingCard
            teaching={msg.teaching}
            onUpdate={(updates) => onTeachingUpdate(msgIndex, updates)}
            onSave={() => onTeachingSave(msgIndex)}
            onCancel={() => onTeachingCancel(msgIndex)}
          />
        )}

        {/* Selected answer summary */}
        {msg.questionAnswered && msg.questionSelectedId && (
          <Box sx={{
            mt: 1, display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.75,
            borderRadius: '8px',
            background: alpha(BRAND.primary, 0.08),
            border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
          }}>
            <CheckCircleIcon sx={{ fontSize: 14, color: BRAND.primaryLight }} />
            <Typography sx={{ fontSize: '0.75rem', color: BRAND.primaryLight }}>
              {msg.questionSelectedLabel || 'Option selected'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// ACTIVITY LOG — persistent tool execution timeline
// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
// CONVERSATION HELPERS
// ═══════════════════════════════════════════════════════

function generateConversationId() {
  return 'chat_' + crypto.randomUUID().split('-')[0];
}

// ═══════════════════════════════════════════════════════
// MODULE-LEVEL MESSAGE CACHE
// Survives React unmount/remount cycles (tab switches).
// Stores full message objects including question cards,
// pendingActions, sopExecution, etc.
// ═══════════════════════════════════════════════════════
const messageCache = new Map(); // conversationId → messages[]

// ═══════════════════════════════════════════════════════
// MAIN CHAT COMPONENT
// ═══════════════════════════════════════════════════════

function Chat({ hideSidebar = false }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [attachedDocs, setAttachedDocs] = useState([]);
  const [welcomeProfile, setWelcomeProfile] = useState(null); // shown once, when the account activates
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainPromptMode, setTrainPromptMode] = useState(false);
  const [newProcessOpen, setNewProcessOpen] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [exportAnchor, setExportAnchor] = useState(null);
  const initializedRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  // ═══ Text-to-Speech (TTS) state ═══
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('ace_tts_enabled') === 'true');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);
  const [ttsSupported, setTtsSupported] = useState(false);
  const ttsUtteranceRef = useRef(null);
  const serverAudioRef = useRef(null);   // <audio> currently playing server-rendered speech
  const serverVoiceRef = useRef(false);  // whether the server can render speech at all
  const [activeAction, setActiveAction] = useState(null);
  const textFieldRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [bizProfile, setBizProfile] = useState(null);
  const [projectToast, setProjectToast] = useState(null); // { name } — shows "Project ready in Studio!"

  // Fetch active business profile for personalized suggestions
  useEffect(() => {
    fetch('/api/businesses/active')
      .then(r => r.json())
      .then(res => { if (res.success && res.data?.name) setBizProfile(res.data); })
      .catch(() => {});
  }, []);

  // ═══ Action chips — clear intent shortcuts ═══
  const actionChips = [
    { id: 'browse', label: 'Browse', icon: <PublicIcon sx={{ fontSize: 16 }} />, prefix: '[OPEN BROWSER] ', placeholder: 'google.com, zillow.com, linkedin.com...' },
    { id: 'search', label: 'Search', icon: <SearchIcon sx={{ fontSize: 16 }} />, prefix: '[WEB SEARCH] ', placeholder: 'seller financing real estate in Miami...' },
    { id: 'sop', label: 'Run SOP', icon: <AssignmentIcon sx={{ fontSize: 16 }} />, prefix: '[RUN SOP] ', placeholder: 'login to Facebook, repost meetup...' },
    { id: 'code', label: 'Code', icon: <CodeIcon sx={{ fontSize: 16 }} />, prefix: '', placeholder: 'Build a landing page, update my website, create a contact form...' },
    { id: 'email', label: 'Email', icon: <EmailIcon sx={{ fontSize: 16 }} />, prefix: '[SEND EMAIL] ', placeholder: 'john@example.com about the proposal...' },
  ];

  // ═══ Cache messages whenever they change ═══
  // This ensures cards, pendingActions, question fields survive tab switches
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      messageCache.set(activeConversationId, messages);
    }
  }, [messages, activeConversationId]);

  // ═══ Console "Ask Ace" — receive errors from Console tab ═══
  const pendingDebugRef = useRef(null);
  useEffect(() => {
    const handle = (e) => {
      const msg = e.detail?.message;
      if (!msg) return;
      // Store pending message and set input text — handleSend will fire via the effect below
      pendingDebugRef.current = msg;
      setInputText(msg);
    };
    window.addEventListener('ace:debug-error', handle);
    return () => window.removeEventListener('ace:debug-error', handle);
  }, []);

  // Prefill chat input from other pages (e.g., Integrations "Train Ace" button, Sidebar tools)
  useEffect(() => {
    const handle = (e) => {
      const msg = e.detail?.message || e.detail?.text;
      if (msg) setInputText(msg);
    };
    window.addEventListener('ace:prefill-chat', handle);
    return () => window.removeEventListener('ace:prefill-chat', handle);
  }, []);


  // Auto-send when pending debug message is set
  useEffect(() => {
    if (pendingDebugRef.current && inputText === pendingDebugRef.current && !isThinking) {
      pendingDebugRef.current = null;
      // Small delay to ensure React state is settled
      setTimeout(() => {
        const sendBtn = document.querySelector('[data-send-button]');
        if (sendBtn) sendBtn.click();
      }, 100);
    }
  }, [inputText, isThinking]);

  // ═══ Speech Recognition (voice-to-text) setup ═══
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          recognitionRef.current._finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      const base = recognitionRef.current?._baseText || '';
      const separator = base && !base.endsWith(' ') ? ' ' : '';
      setInputText(base + separator + recognitionRef.current._finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      console.warn('[Chat] Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current?._shouldRestart) {
        try { recognition.start(); } catch (e) { /* already started */ }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognitionRef.current._baseText = '';
    recognitionRef.current._finalTranscript = '';
    recognitionRef.current._shouldRestart = false;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current._shouldRestart = false;
        recognition.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // ═══ Text-to-Speech (TTS) setup ═══
  useEffect(() => {
    // Ask once whether the server can speak; if it can, its voice is used in preference.
    fetch('/api/speak/voice')
      .then(r => r.json())
      .then(r => { serverVoiceRef.current = !!r?.data?.available; })
      .catch(() => { serverVoiceRef.current = false; });

    const supported = 'speechSynthesis' in window;
    setTtsSupported(supported);
    if (supported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Persist TTS preference
  useEffect(() => {
    localStorage.setItem('ace_tts_enabled', ttsEnabled ? 'true' : 'false');
  }, [ttsEnabled]);

  // Chrome bug: speech pauses after ~15s. Keep-alive timer resumes it.
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // ═══ TTS core functions ═══
  const stopSpeaking = useCallback(() => {
    // Stop both sources — speech may be coming from the server's audio element rather than
    // the browser's synthesiser, and cancelling only one leaves it playing.
    if (serverAudioRef.current) {
      serverAudioRef.current.pause();
      serverAudioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMsgIdx(null);
    ttsUtteranceRef.current = null;
  }, []);

  // The server renders speech with a real Apple voice. The browser's own synthesis falls
  // back to Apple's "compact" voices on iOS, which are the robotic ones, so this is used
  // whenever the server can do it and browser speech is kept only as a fallback.
  const speakViaServer = useCallback(async (cleanText, messageIndex) => {
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText }),
    });
    if (!res.ok) throw new Error(`speak failed: ${res.status}`);

    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    serverAudioRef.current = audio;

    const done = () => {
      setIsSpeaking(false); setSpeakingMsgIdx(null);
      serverAudioRef.current = null;
      URL.revokeObjectURL(url);
    };
    audio.onplay = () => { setIsSpeaking(true); setSpeakingMsgIdx(messageIndex); };
    audio.onended = done;
    audio.onerror = done;

    await audio.play();
  }, []);

  const speakText = useCallback((text, messageIndex = null) => {
    const cleanText = stripMarkdownForSpeech(text);
    if (!cleanText) return;

    // Stop whatever is already playing, from either source.
    if (serverAudioRef.current) { serverAudioRef.current.pause(); serverAudioRef.current = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    if (serverVoiceRef.current) {
      speakViaServer(cleanText, messageIndex).catch((e) => {
        // One failure should not leave the button dead for the rest of the session.
        console.warn('[TTS] server voice failed, using browser voice:', e.message);
        serverVoiceRef.current = false;
        speakInBrowser(cleanText, messageIndex);
      });
      return;
    }

    speakInBrowser(cleanText, messageIndex);
  }, [speakViaServer]);

  const speakInBrowser = useCallback((cleanText, messageIndex = null) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;   // Slightly slower = more natural cadence
    utterance.pitch = 0.9;   // Slightly deeper = more masculine tone

    // Pick best voice by name priority — browser strips "(Premium)" so match by name directly
    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    const PREFERRED_VOICES = ['Jamie', 'Evan', 'Tom', 'Aaron', 'Nicky', 'Eddy', 'Reed', 'Rocko', 'Daniel'];
    let preferred = null;
    for (const name of PREFERRED_VOICES) {
      preferred = enVoices.find(v => v.name === name || v.name.startsWith(name + ' '));
      if (preferred) break;
    }
    if (!preferred) {
      preferred = enVoices.find(v => v.name.includes('Google US English'))
        || enVoices.find(v => v.localService)
        || enVoices[0] || voices[0];
    }
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onstart = () => { setIsSpeaking(true); setSpeakingMsgIdx(messageIndex); };
    utterance.onend = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); ttsUtteranceRef.current = null; };
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') console.warn('[TTS] Error:', e.error);
      setIsSpeaking(false); setSpeakingMsgIdx(null); ttsUtteranceRef.current = null;
    };

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [ttsSupported]);

  // ═══ Image helpers ═══
  // Images go to the vision model as before. Anything else — a PDF, a Word file, a
  // spreadsheet export — is read on the server and its text travels with the message, so
  // attaching a document actually puts it in front of Ace instead of being ignored.
  const handleFileSelect = useCallback((files) => {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) continue;
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedImages(prev => [...prev, {
            base64: e.target.result,
            name: file.name,
            preview: e.target.result,
          }]);
        };
        reader.readAsDataURL(file);
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        setAttachedDocs(prev => [...prev, { name: file.name, error: 'Too large to read (20MB max)' }]);
        continue;
      }

      const pending = { name: file.name, loading: true };
      setAttachedDocs(prev => [...prev, pending]);

      fetch('/api/attachments/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-filename': encodeURIComponent(file.name),
        },
        body: file,
      })
        .then(r => r.json())
        .then(r => {
          setAttachedDocs(prev => prev.map(d => d.name !== file.name ? d : (
            r.success
              ? { name: file.name, text: r.data.text, chars: r.data.chars }
              : { name: file.name, error: r.error || 'Could not read this file' }
          )));
        })
        .catch(() => {
          setAttachedDocs(prev => prev.map(d => d.name !== file.name ? d
            : { name: file.name, error: 'Could not read this file' }));
        });
    }
  }, []);

  const removeImage = useCallback((index) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ═══ Scroll to bottom when chat tab becomes visible again ═══
  // Uses IntersectionObserver to detect when our container goes from hidden to visible
  const chatContainerRef = useRef(null);
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Small delay to let layout settle after display change
          setTimeout(scrollToBottom, 50);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ═══ Fetch conversation list from server ═══
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.success) {
        setConversations(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch conversations', e);
    }
  }, []);

  // ═══ Load messages for a specific conversation ═══
  // Prefers module-level cache (preserves cards/pendingActions),
  // falls back to server (text-only).
  const loadConversation = useCallback(async (chatId) => {
    // Check module-level cache first — has full message objects with cards
    const cached = messageCache.get(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      return;
    }

    // Fall back to server — only has text/sender (no interactive cards)
    try {
      const res = await fetch(`/api/conversations/${chatId}`);
      const data = await res.json();
      if (data.success) {
        const clientMessages = data.data.map(m => ({
          sender: m.role === 'user' ? 'You' : 'Ace',
          text: m.content,
          timestamp: m.timestamp,
        }));
        setMessages(clientMessages);
      }
    } catch (e) {
      console.error('Failed to load conversation', e);
    }
  }, []);

  // ═══ Initialize — load conversations and restore active one ═══
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      await fetchConversations();

      // Restore last active conversation
      const savedId = localStorage.getItem('ace_active_conversation');
      if (savedId) {
        setActiveConversationId(savedId);
        await loadConversation(savedId);
      } else {
        // Migrate old localStorage data if it exists
        const oldHistory = localStorage.getItem('ace_chat_history');
        if (oldHistory) {
          try {
            const parsed = JSON.parse(oldHistory);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setActiveConversationId('desktop');
              setMessages(parsed);
              localStorage.setItem('ace_active_conversation', 'desktop');
              localStorage.removeItem('ace_chat_history');
              return;
            }
          } catch (e) { /* corrupt — start fresh */ }
        }
        // No saved state — start a new conversation
        const newId = generateConversationId();
        setActiveConversationId(newId);
        localStorage.setItem('ace_active_conversation', newId);
      }
    })();
  }, [fetchConversations, loadConversation]);

  // ═══ SSE for real-time updates ═══
  useEffect(() => {
    const eventSource = new EventSource('/api/events/stream');

    eventSource.onmessage = (event) => {
      const eventData = JSON.parse(event.data);
      const { type, data } = eventData;
      let message = null;

      switch (type) {
        case 'brain:thinking':
        case 'progress:update':
          if (data?.message?.trim()) {
            message = { sender: 'Ace (Thinking)', text: data.message };
          }
          break;
        case 'brain:thought:complete':
          if (data?.thought?.trim()) {
            message = { sender: 'Ace (Thought)', text: data.thought };
          }
          break;
        case 'chat:response:sent':
          if (data?.message?.trim()) {
            message = { sender: 'Ace', text: data.message };
          }
          break;
        // ── SOP Execution live events ──
        case 'sop:started': {
          const sopExec = {
            sopId: data.sopId, sopName: data.sopName || data.sopId, status: 'running',
            totalSteps: data.stepCount || 0,
            steps: Array.from({ length: data.stepCount || 0 }, (_, i) => ({
              stepNum: i + 1, action: '', description: `Step ${i + 1}`, status: 'pending',
            })),
          };
          setMessages(prev => [...prev, { sender: 'Ace', text: `Running process: **${sopExec.sopName}**`, sopExecution: sopExec }]);
          break;
        }
        case 'sop:step:started': {
          setMessages(prev => prev.map(m => {
            if (!m.sopExecution || m.sopExecution.sopId !== data.sopId) return m;
            const steps = m.sopExecution.steps.map(s =>
              s.stepNum === data.stepNum ? { ...s, status: 'running', action: data.action, description: data.description || s.description } : s
            );
            return { ...m, sopExecution: { ...m.sopExecution, steps } };
          }));
          break;
        }
        case 'sop:step:completed': {
          setMessages(prev => prev.map(m => {
            if (!m.sopExecution || m.sopExecution.sopId !== data.sopId) return m;
            const steps = m.sopExecution.steps.map(s =>
              s.stepNum === data.stepNum ? { ...s, status: 'done', action: data.action } : s
            );
            return { ...m, sopExecution: { ...m.sopExecution, steps } };
          }));
          break;
        }
        case 'sop:step:failed': {
          setMessages(prev => {
            const updated = prev.map(m => {
              if (!m.sopExecution || m.sopExecution.sopId !== data.sopId) return m;
              const steps = m.sopExecution.steps.map(s =>
                s.stepNum === data.stepNum ? { ...s, status: 'failed', error: data.error } : s
              );
              return { ...m, sopExecution: { ...m.sopExecution, steps } };
            });
            // Insert a ShowMe card for the failed step (with screenshot if available)
            return [...updated, {
              sender: 'Ace',
              text: '',
              showMe: { sopId: data.sopId, stepNum: data.stepNum, description: data.description, error: data.error, screenshot: data.screenshot || null },
              showMeState: 'prompt',
            }];
          });
          break;
        }
        case 'sop:completed': {
          setMessages(prev => prev.map(m => {
            if (!m.sopExecution || m.sopExecution.sopId !== data.sopId) return m;
            return { ...m, sopExecution: { ...m.sopExecution, status: 'completed' } };
          }));
          break;
        }
        case 'sop:failed': {
          setMessages(prev => prev.map(m => {
            if (!m.sopExecution || m.sopExecution.sopId !== data.sopId) return m;
            return { ...m, sopExecution: { ...m.sopExecution, status: 'failed' } };
          }));
          break;
        }

        // ── Routine/Automation results live in chat ──
        case 'routine:completed': {
          const routineMsg = {
            sender: 'Ace',
            text: `📅 **${data.routineName || 'Routine'} — Complete**\n\n${data.result || 'Routine finished successfully.'}`,
            isRoutineResult: true,
            routineId: data.routineId,
          };
          setMessages(prev => [...prev, routineMsg]);
          break;
        }
        case 'pipeline:action': {
          const pipelineMsg = {
            sender: 'Ace',
            text: `📋 **${data.routineName || 'Pipeline Grooming'}**\n\n${data.summary || 'Pipeline check completed.'}${data.actionableCount ? `\n\n${data.actionableCount} lead(s) needed attention.` : ''}`,
            isRoutineResult: true,
          };
          setMessages(prev => [...prev, pipelineMsg]);
          break;
        }

        // ── Desktop Training live step preview ──
        case 'desktop:train:step': {
          if (data) {
            setRecordingSteps(prev => {
              const step = {
                type: data.type,
                x: data.x,
                y: data.y,
                key: data.key,
                direction: data.direction,
                stepNumber: data.stepNumber || prev.length + 1,
                timestamp: data.timestamp || Date.now(),
              };
              // Keep only last 20 steps to prevent memory bloat
              const updated = [...prev, step];
              return updated.length > 20 ? updated.slice(-20) : updated;
            });
          }
          break;
        }
        case 'desktop:train:started':
          setRecordingSteps([]);
          break;
        case 'desktop:train:complete':
          // Recording done — steps will be cleared when training stops
          break;

        case 'connected':
        case 'ping':
          break;
        default:
          break;
      }

      if (message) {
        setMessages(prev => [...prev, message]);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  // ═══ Conversation management ═══
  const handleNewConversation = useCallback(() => {
    const newId = generateConversationId();
    setActiveConversationId(newId);
    setMessages([]);
    localStorage.setItem('ace_active_conversation', newId);
  }, []);

  const handleSelectConversation = useCallback(async (chatId) => {
    if (isSpeaking) stopSpeaking();
    setActiveConversationId(chatId);
    localStorage.setItem('ace_active_conversation', chatId);
    await loadConversation(chatId);
  }, [loadConversation, isSpeaking, stopSpeaking]);

  const handleDeleteConversation = useCallback(async (chatId) => {
    try {
      await fetch(`/api/conversations/${chatId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.chatId !== chatId));
      if (chatId === activeConversationId) {
        handleNewConversation();
      }
    } catch (e) {
      console.error('Failed to delete conversation', e);
    }
  }, [activeConversationId, handleNewConversation]);

  // ═══ Sidebar integration — App-level Sidebar drives conversation selection ═══
  useEffect(() => {
    const onNewChat = () => handleNewConversation();
    const onSelectConv = (e) => {
      const id = e.detail?.id;
      if (id) handleSelectConversation(id);
    };
    window.addEventListener('ace:new-chat', onNewChat);
    window.addEventListener('ace:select-conversation', onSelectConv);
    return () => {
      window.removeEventListener('ace:new-chat', onNewChat);
      window.removeEventListener('ace:select-conversation', onSelectConv);
    };
  }, [handleNewConversation, handleSelectConversation]);

  // Notify App.jsx of conversation list changes so the Sidebar stays in sync
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ace:conversations-updated', {
      detail: { conversations, activeId: activeConversationId },
    }));
  }, [conversations, activeConversationId]);

  // ═══ Action/question handlers ═══
  const handleConfirmActions = useCallback(async (msgIndex, confirmedActions) => {
    try {
      const res = await fetch('/api/execute-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: confirmedActions }),
      });
      const result = await res.json();
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, actionsConfirmed: true, actionsResult: result } : m
      ));
      if (result.success) {
        window.dispatchEvent(new CustomEvent('ace:pipeline-updated'));
      }
    } catch (err) {
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex
          ? { ...m, actionsConfirmed: true, actionsResult: { success: false, error: err.message } }
          : m
      ));
    }
  }, []);

  const handleCancelActions = useCallback((msgIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, actionsConfirmed: true } : m
    ));
  }, []);

  const handleQuestionAnswer = useCallback(async (msgIndex, optionId, optionLabel) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, questionAnswered: true, questionSelectedId: optionId, questionSelectedLabel: optionLabel } : m
    ));
    setMessages(prev => [...prev, { sender: 'You', text: optionLabel }]);
    setIsThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: optionLabel, conversationId: activeConversationId }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.success && result.data) {
        const botMessage = result.data.message || result.data.response || result.data.data?.message || 'No response from Ace.';
        const pendingActions = Array.isArray(result.data.pendingActions) && result.data.pendingActions.length > 0
          ? result.data.pendingActions : null;
        const question = result.data.question || null;
        setMessages(prev => [...prev, {
          sender: 'Ace', text: botMessage, pendingActions, actionsConfirmed: false,
          question, questionAnswered: false,
        }]);
      } else {
        throw new Error(result.error || 'Invalid response');
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'System', text: `Error: ${error.message}` }]);
    } finally {
      setIsThinking(false);
      fetchConversations();
    }
  }, [activeConversationId, fetchConversations]);

  // ═══ Show Me How — Recording handlers ═══
  const recordingPopupRef = useRef(null);

  const handleShowMeReady = useCallback((msgIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, showMeState: 'get_ready' } : m
    ));
  }, []);

  const handleShowMeStart = useCallback(async (msgIndex, mode) => {
    const msg = messages[msgIndex];
    if (!msg?.showMe) return;
    const { sopId, stepNum } = msg.showMe;

    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, showMeState: mode } : m
    ));

    try {
      await fetch(`/api/sops/${sopId}/steps/${stepNum}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      // Dispatch event for global recording overlay
      window.dispatchEvent(new CustomEvent('ace:recording-start', {
        detail: { sopId, stepNum, mode },
      }));
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  }, [messages]);

  const handleShowMeDone = useCallback(async (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg?.showMe) return;
    const { sopId, stepNum } = msg.showMe;

    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, showMeState: 'saving' } : m
    ));

    try {
      await fetch(`/api/sops/${sopId}/steps/${stepNum}/record-stop`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('ace:recording-stop'));
    } catch (e) {
      console.error('Failed to stop recording:', e);
    }

    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, showMeState: 'saved' } : m
    ));
  }, [messages]);

  const handleShowMeSkip = useCallback((msgIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, showMeState: 'skipped' } : m
    ));
  }, []);

  const handleHealthShowMe = useCallback((sopId, stepNum, description) => {
    // Insert a new ShowMe card in chat for this step
    setMessages(prev => [...prev, {
      sender: 'Ace',
      text: '',
      showMe: { sopId, stepNum, description, error: 'This step has low reliability' },
      showMeState: 'prompt',
    }]);
  }, []);

  const handleStepCorrect = useCallback((sopId, stepNum, description) => {
    // User clicked a "completed" step to say it wasn't right — insert ShowMe card
    setMessages(prev => [...prev, {
      sender: 'Ace',
      text: '',
      showMe: { sopId, stepNum, description, error: "That didn't look right — show me how to do this step" },
      showMeState: 'prompt',
    }]);
  }, []);

  // ═══ Teaching Card — Guided SOP builder handlers ═══
  const handleTeachingUpdate = useCallback((msgIndex, updates) => {
    setMessages(prev => prev.map((msg, i) =>
      i === msgIndex ? { ...msg, teaching: { ...msg.teaching, ...updates } } : msg
    ));
  }, []);

  const handleTeachingSave = useCallback(async (msgIndex) => {
    const msg = messages[msgIndex];
    if (!msg?.teaching) return;
    const { name, triggers, steps, phase } = msg.teaching;

    // Phase: building → call preview endpoint first
    if (phase === 'building') {
      handleTeachingUpdate(msgIndex, { phase: 'saving' });
      try {
        const stepTexts = (steps || []).filter(s => s.text?.trim()).map(s => s.text.trim());
        const resp = await fetch('/api/training/guided-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: stepTexts }),
        });
        const data = await resp.json();
        if (data.success) {
          handleTeachingUpdate(msgIndex, {
            phase: 'reviewing',
            parsedSteps: data.data.parsedSteps,
            qualityResult: data.data.qualityResult,
          });
        } else {
          handleTeachingUpdate(msgIndex, { phase: 'error', error: data.error || 'Preview failed' });
        }
      } catch (e) {
        handleTeachingUpdate(msgIndex, { phase: 'error', error: e.message });
      }
      return;
    }

    // Phase: reviewing (or any non-building phase) → call save endpoint
    handleTeachingUpdate(msgIndex, { phase: 'saving' });
    try {
      const stepTexts = (steps || []).filter(s => s.text?.trim()).map(s => s.text.trim());
      const triggerList = (triggers || '').split(',').map(t => t.trim()).filter(Boolean);
      const resp = await fetch('/api/training/guided-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, triggers: triggerList, steps: stepTexts }),
      });
      const data = await resp.json();
      if (data.success) {
        handleTeachingUpdate(msgIndex, { phase: 'done', savedSop: data.data });
      } else {
        handleTeachingUpdate(msgIndex, { phase: 'error', error: data.error || 'Save failed' });
      }
    } catch (e) {
      handleTeachingUpdate(msgIndex, { phase: 'error', error: e.message });
    }
  }, [messages, handleTeachingUpdate]);

  const handleTeachingCancel = useCallback((msgIndex) => {
    setMessages(prev => prev.filter((_, i) => i !== msgIndex));
  }, []);

  // ═══ Desktop Training — Train button handlers ═══
  const handleTrainClick = () => {
    if (isTraining) {
      // Currently recording — stop it
      handleTrainStop();
    } else {
      // Open the unified New Process dialog
      setNewProcessOpen(true);
    }
  };

  const handleTrainStart = async (name) => {
    try {
      const resp = await fetch('/api/desktop-train/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await resp.json();
      if (data.success) {
        setIsTraining(true);
        setTrainPromptMode(false);
        setRecordingSteps([]);
        setMessages(prev => [...prev, {
          role: 'ace',
          text: `🎓 Got it! I'm watching your screen now. Show me how to: **"${name}"**\n\nDo your thing — I'm capturing every click and keystroke. Click **Stop** when done.`,
          isRecordingPreview: true,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'ace',
          text: `⚠️ Could not start training: ${data.error || 'Unknown error'}`,
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'ace',
        text: `⚠️ Training error: ${e.message}`,
      }]);
    }
  };

  const handleTrainStop = async () => {
    try {
      setMessages(prev => [...prev, {
        role: 'ace',
        text: '🎓 Analyzing your demonstration... give me a moment.',
      }]);
      const resp = await fetch('/api/desktop-train/stop', { method: 'POST' });
      const data = await resp.json();
      setIsTraining(false);
      setRecordingSteps([]);
      if (data.success && data.data?.sop) {
        const sop = data.data.sop;
        setMessages(prev => [...prev, {
          role: 'ace',
          text: `🎓 **Learned!** Saved "${sop.name}" with **${sop.steps.length} steps**. I can replay this anytime you ask.`,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'ace',
          text: `⚠️ Training analysis failed: ${data.data?.error || data.error || 'Not enough frames captured'}`,
        }]);
      }
    } catch (e) {
      setIsTraining(false);
      setMessages(prev => [...prev, {
        role: 'ace',
        text: `⚠️ Training stop error: ${e.message}`,
      }]);
    }
  };

  const handleTrainSubmit = () => {
    const name = inputText.trim();
    if (!name) return;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: `🎓 Teach: ${name}` }]);
    handleTrainStart(name);
  };

  // ═══ Voice-to-text mic toggle ═══
  const handleMicToggle = useCallback(() => {
    if (!recognitionRef.current || !speechSupported) return;

    if (isListening) {
      recognitionRef.current._shouldRestart = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (isSpeaking) stopSpeaking();
      recognitionRef.current._baseText = inputText;
      recognitionRef.current._finalTranscript = '';
      recognitionRef.current._shouldRestart = true;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('[Chat] Could not start speech recognition:', e.message);
      }
    }
  }, [isListening, inputText, speechSupported]);

  // ═══ Action chip toggle ═══
  const handleActionChip = useCallback((chip) => {
    if (activeAction?.id === chip.id) {
      setActiveAction(null);
    } else {
      setActiveAction(chip);
      setTimeout(() => textFieldRef.current?.focus(), 50);
    }
  }, [activeAction]);

  // ═══ Send message (streaming — shows real-time progress) ═══
  // Direct send — used by setup cards and programmatic sends (bypasses input state)
  const sendMessageDirect = useCallback(async (text) => {
    if (!text?.trim()) return;
    if (isSpeaking) stopSpeaking();

    const rawText = text.trim();
    setMessages(prev => [...prev, { sender: 'You', text: rawText }]);
    setInputText('');
    setIsThinking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          conversationId: activeConversationId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'thinking' && event.content) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.sender === 'Ace Activity') {
                  const steps = [...(last.activitySteps || [])];
                  if (!steps.includes(event.content)) steps.push(event.content);
                  return [...prev.slice(0, -1), { ...last, activitySteps: steps }];
                }
                return [...prev, { sender: 'Ace Activity', activitySteps: [event.content] }];
              });
            }
            if (event.type === 'response') {
              const data = event.content || {};
              const botMessage = data.message || data.response || data.data?.message || 'No response from Ace.';
              const pendingActions = Array.isArray(data.pendingActions) && data.pendingActions.length > 0 ? data.pendingActions : null;
              const question = data.question || null;
              const toolsUsed = data.toolsUsed || [];
              setMessages(prev => {
                const updated = prev.map(m => m.sender === 'Ace Activity' && !m.complete ? { ...m, complete: true } : m);
                return [...updated, { sender: 'Ace', text: botMessage, pendingActions, actionsConfirmed: false, question, questionAnswered: false, toolsUsed, usage: data.metadata?.usage || data.data?.metadata?.usage || null }];
              });
              if (ttsEnabled && botMessage && botMessage !== 'No response from Ace.') {
                setTimeout(() => speakText(botMessage), 300);
              }
              const createdProject = data?.data?.projectName || data?.projectName;
              if (createdProject) {
                window.dispatchEvent(new CustomEvent('ace:project-created', { detail: { projectName: createdProject } }));
                setProjectToast({ name: createdProject });
              }
            }
            if (event.type === 'account_created') {
              localStorage.setItem('ace_token', event.token);
              localStorage.setItem('ace_user', JSON.stringify(event.profile));
              // Becoming a customer is the single most important moment in the product and
              // it used to pass with nothing but a console line. Mark it, once — the flag
              // is stored so a refresh does not replay the celebration.
              if (!localStorage.getItem('ace_welcomed')) {
                localStorage.setItem('ace_welcomed', '1');
                setWelcomeProfile(event.profile || {});
              }
            }
            if (event.type === 'profile_updated') {
              // Update stored profile
              const existing = JSON.parse(localStorage.getItem('ace_user') || '{}');
              localStorage.setItem('ace_user', JSON.stringify({ ...existing, ...event.profile }));
            }
            if (event.type === 'error') {
              setMessages(prev => {
                const updated = prev.map(m => m.sender === 'Ace Activity' && !m.complete ? { ...m, complete: true } : m);
                return [...updated, { sender: 'System', text: `Error: ${event.content}` }];
              });
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages(prev => {
          const updated = prev.map(m => m.sender === 'Ace Activity' && !m.complete ? { ...m, complete: true } : m);
          return [...updated, { sender: 'Ace', text: 'Stopped.' }];
        });
      } else {
        setMessages(prev => {
          const updated = prev.map(m => m.sender === 'Ace Activity' && !m.complete ? { ...m, complete: true } : m);
          return [...updated, { sender: 'System', text: `Error: ${error.message}` }];
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsThinking(false);
      fetchConversations();
    }
  }, [activeConversationId, isSpeaking, ttsEnabled]);

  const handleSend = async () => {
    const hasText = inputText.trim().length > 0;
    const hasImages = attachedImages.length > 0;
    const hasDocs = attachedDocs.some(d => d.text);
    if (!hasText && !hasImages && !hasDocs) return;
    if (isSpeaking) stopSpeaking();

    // Prepend action prefix if an action chip is active (user doesn't see it)
    const rawText = inputText.trim();
    const messageToSend = activeAction ? activeAction.prefix + rawText : rawText;
    const imagesToSend = [...attachedImages];
    const docsToSend = attachedDocs.filter(d => d.text);

    // The document text is prepended to what actually reaches Ace, while the bubble on
    // screen shows only the filename — nobody wants ten pages of a PDF echoed back at them.
    // The model's context window is small, so a long document has to be trimmed rather than
    // sent whole — sending everything produced an empty reply. Say so plainly instead of
    // silently answering from a fraction of the file.
    const PER_DOC_LIMIT = 18000;
    const docContext = docsToSend
      .map(d => {
        const body = d.text.length > PER_DOC_LIMIT
          ? `${d.text.slice(0, PER_DOC_LIMIT)}\n\n[Only the first ${PER_DOC_LIMIT.toLocaleString()} characters of ${d.name} are shown here, out of ${d.text.length.toLocaleString()}. Say so if the answer might be further in, and offer to look at a specific section.]`
          : d.text;
        return `[Attached document: ${d.name}]\n${body}`;
      })
      .join('\n\n');

    setMessages(prev => [...prev, {
      sender: 'You',
      text: rawText || (imagesToSend.length > 0 ? `Sent ${imagesToSend.length} image(s)` : ''),
      images: imagesToSend.map(img => img.preview),
      docs: docsToSend.map(d => d.name),
      actionMode: activeAction?.label || null,
    }]);
    setInputText('');
    setAttachedImages([]);
    setAttachedDocs([]);
    setActiveAction(null);
    if (recognitionRef.current && isListening) {
      recognitionRef.current._shouldRestart = false;
      recognitionRef.current.stop();
      setIsListening(false);
    }
    setIsThinking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Document text rides with the message so Ace reads what was attached.
          message: docContext ? `${docContext}\n\n${messageToSend}` : messageToSend,
          conversationId: activeConversationId,
          images: imagesToSend.map(img => img.base64),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      // Read SSE stream for real-time progress
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'thinking' && event.content) {
              // Accumulate activity steps in a persistent timeline
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.sender === 'Ace Activity') {
                  const steps = [...(last.activitySteps || [])];
                  if (!steps.includes(event.content)) steps.push(event.content);
                  return [...prev.slice(0, -1), { ...last, activitySteps: steps }];
                }
                return [...prev, {
                  sender: 'Ace Activity',
                  activitySteps: [event.content],
                }];
              });
            }

            if (event.type === 'response') {
              const data = event.content || {};
              const botMessage = data.message || data.response || data.data?.message || 'No response from Ace.';
              const pendingActions = Array.isArray(data.pendingActions) && data.pendingActions.length > 0
                ? data.pendingActions : null;
              const question = data.question || null;

              // Mark activity as complete (keep it visible), add final response
              const toolsUsed = data.toolsUsed || [];
              setMessages(prev => {
                const updated = prev.map(m =>
                  m.sender === 'Ace Activity' && !m.complete
                    ? { ...m, complete: true }
                    : m
                );
                return [...updated, {
                  sender: 'Ace',
                  text: botMessage,
                  pendingActions,
                  actionsConfirmed: false,
                  question,
                  questionAnswered: false,
                  toolsUsed,
                }];
              });

              // Auto-speak: read Ace's response aloud if TTS is enabled
              if (ttsEnabled && botMessage && botMessage !== 'No response from Ace.') {
                setTimeout(() => speakText(botMessage), 300);
              }

              const createdProject = data?.data?.projectName || data?.projectName;
              if (createdProject) {
                window.dispatchEvent(new CustomEvent('ace:project-created', {
                  detail: { projectName: createdProject }
                }));
                setProjectToast({ name: createdProject });
              }
            }

            if (event.type === 'error') {
              setMessages(prev => {
                const updated = prev.map(m =>
                  m.sender === 'Ace Activity' && !m.complete
                    ? { ...m, complete: true }
                    : m
                );
                return [...updated, { sender: 'System', text: `Error: ${event.content}` }];
              });
            }
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // User clicked Stop — mark activity complete, show stopped message
        setMessages(prev => {
          const updated = prev.map(m =>
            m.sender === 'Ace Activity' && !m.complete
              ? { ...m, complete: true }
              : m
          );
          return [...updated, { sender: 'Ace', text: 'Stopped.' }];
        });
      } else {
        console.error("Error sending message:", error);
        setMessages(prev => {
          const updated = prev.map(m =>
            m.sender === 'Ace Activity' && !m.complete
              ? { ...m, complete: true }
              : m
          );
          return [...updated, { sender: 'System', text: `Error: ${error.message}` }];
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsThinking(false);
      fetchConversations();
    }
  };

  const handleStop = async () => {
    // 1. Abort the SSE fetch on the frontend
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 2. Tell the backend to stop the tool loop
    try {
      await fetch('/api/chat/stop', { method: 'POST' });
    } catch (e) {
      // Best effort — the abort already handles the frontend
    }
  };

  // ═══ Welcome Screen — Feature Cards (existing) ═══
  const quickActions = bizProfile ? [
    `Find me ${bizProfile.targetAudience || bizProfile.industry || 'potential customers'} leads in ${bizProfile.location || 'my area'}`,
    'What leads are in my pipeline and who should I contact first?',
    `Research my competitors${bizProfile.industry ? ' in ' + bizProfile.industry.split(',')[0].trim() : ''} and find opportunities`,
    `Draft a cold outreach email for ${bizProfile.name || 'my business'} to send to new leads`,
  ] : [
    'Find me leads for my business',
    'What leads are in my pipeline?',
    'Research my competitors and find opportunities',
    'Draft a cold outreach email to send to new leads',
  ];

  const featureCards = [
    { icon: '💬', title: 'Chat', desc: 'Ask Ace anything — research, email, browse the web, find leads' },
    { icon: '📊', title: 'Pipeline', desc: 'Track your leads & deals from first contact to close' },
    { icon: '📋', title: 'Processes', desc: 'Teach Ace step-by-step processes it can repeat for you' },
    { icon: '⏰', title: 'Routines', desc: 'Schedule daily tasks — Ace works even when you\'re away' },
    { icon: '🎯', title: 'Goals', desc: 'Set targets like "find 10 leads/day" and track progress' },
  ];

  // ═══ Get Ace Running — Guided Setup Steps ═══
  const [completedSetup, setCompletedSetup] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ace_setup_completed') || '[]'); }
    catch { return []; }
  });

  const markSetupDone = (id) => {
    setCompletedSetup(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('ace_setup_completed', JSON.stringify(next));
      return next;
    });
  };

  const setupSteps = [
    {
      id: 'leads',
      icon: <SearchIcon sx={{ fontSize: 20 }} />,
      gradient: `linear-gradient(135deg, ${BRAND.secondary}, #00B4D8)`,
      title: 'Find Your First Leads',
      desc: 'Tell Ace your target market and watch it research, find, and save quality leads to your pipeline.',
      cta: 'Find leads',
      action: () => {
        markSetupDone('leads');
        sendMessageDirect('I want you to find leads for my business. Ask me about my ideal customer and then go find them.');
      },
    },
    {
      id: 'mission',
      icon: <TrackChangesIcon sx={{ fontSize: 20 }} />,
      gradient: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
      title: 'Set a Revenue Goal',
      desc: 'Set a target like "10 new leads per week" — Ace tracks progress and works toward it daily.',
      cta: 'Set a goal',
      action: () => {
        markSetupDone('mission');
        sendMessageDirect('Help me set a revenue goal. Ask me about my targets and create a goal we can track together.');
      },
    },
    {
      id: 'routine',
      icon: <ScheduleIcon sx={{ fontSize: 20 }} />,
      gradient: `linear-gradient(135deg, #F39C12, #E67E22)`,
      title: 'Automate Your Pipeline',
      desc: 'Schedule Ace to research leads, send follow-ups, and groom your pipeline every morning — even while you sleep.',
      cta: 'Create routine',
      action: () => {
        markSetupDone('routine');
        sendMessageDirect('I want to set up daily routines so you work my pipeline automatically. Walk me through what makes sense for my business.');
      },
    },
    {
      id: 'teach',
      icon: <SchoolIcon sx={{ fontSize: 20 }} />,
      gradient: `linear-gradient(135deg, ${BRAND.accent}, #E84393)`,
      title: 'Teach Ace a Process',
      desc: 'Describe any workflow step by step — posting on social media, searching a website, filling out forms — and Ace learns to repeat it.',
      cta: 'Start teaching',
      action: () => {
        markSetupDone('teach');
        setMessages(prev => [...prev, {
          sender: 'Ace',
          text: "Let's build a new process step by step. Describe each action in plain English and I'll learn it.",
          teaching: {
            phase: 'setup', name: '', triggers: '',
            steps: [{ text: '' }],
            parsedSteps: [], qualityResult: null, savedSop: null, error: null,
          },
        }]);
      },
    },
  ];

  return (
    <Box ref={chatContainerRef} sx={{ height: hideSidebar ? '100vh' : 'calc(100vh - 140px)', display: 'flex', flexDirection: 'row' }}>
      {welcomeProfile && (
        <AceWelcome profile={welcomeProfile} onClose={() => setWelcomeProfile(null)} />
      )}
      {/* Conversation Sidebar — hidden when App-level Sidebar handles navigation */}
      {!hideSidebar && (
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
      )}

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Paper sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
        }}>
          {/* Export button — top right of chat */}
          {messages.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, pt: 0.75, pb: 0 }}>
              <Tooltip title="Export conversation" placement="left">
                <IconButton size="small" onClick={(e) => setExportAnchor(e.currentTarget)} sx={{
                  width: 30, height: 30,
                  color: alpha(BRAND.textMuted, 0.5),
                  '&:hover': { color: BRAND.textSecondary, background: alpha(BRAND.primary, 0.06) },
                }}>
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <ExportMenu
                messages={messages}
                anchorEl={exportAnchor}
                open={Boolean(exportAnchor)}
                onClose={() => setExportAnchor(null)}
              />
            </Box>
          )}
          <Box
            ref={messagesContainerRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
            sx={{
              flex: 1, overflow: 'auto', py: 2, position: 'relative',
              ...(dragOver && {
                '&::after': {
                  content: '"Drop images here"',
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alpha(BRAND.primary, 0.1),
                  border: `2px dashed ${BRAND.primary}`,
                  borderRadius: '12px',
                  color: BRAND.primary,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  zIndex: 10,
                },
              }),
            }}
          >
            {messages.length === 0 && (
              <WelcomeScreen
                onSend={(text) => { setInputText(text); setTimeout(() => { const btn = document.querySelector('[data-send-button]'); if (btn) btn.click(); }, 100); }}
                onAttach={(files) => handleFileSelect(files)}
              />
            )}
            {messages.map((msg, index) => (
              msg.sender === 'Ace Activity' ? (
                <ActivityLog
                  key={index}
                  steps={msg.activitySteps || []}
                  complete={msg.complete || false}
                />
              ) : (
                <MessageBubble
                  key={index}
                  msg={msg}
                  msgIndex={index}
                  onConfirmActions={(confirmed) => handleConfirmActions(index, confirmed)}
                  onCancelActions={() => handleCancelActions(index)}
                  onQuestionAnswer={(optionId, optionLabel) => handleQuestionAnswer(index, optionId, optionLabel)}
                  onShowMeReady={() => handleShowMeReady(index)}
                  onShowMeStart={(mode) => handleShowMeStart(index, mode)}
                  onShowMeDone={() => handleShowMeDone(index)}
                  onShowMeSkip={() => handleShowMeSkip(index)}
                  onHealthShowMe={handleHealthShowMe}
                  onStepCorrect={handleStepCorrect}
                  onTeachingUpdate={handleTeachingUpdate}
                  onTeachingSave={handleTeachingSave}
                  onTeachingCancel={handleTeachingCancel}
                  onSpeak={speakText}
                  onStopSpeaking={stopSpeaking}
                  isSpeakingThis={speakingMsgIdx === index}
                />
              )
            ))}
            {isThinking && (
              <Box sx={{ display: 'flex', gap: 1, px: { xs: 1.5, md: 2 }, mb: 1.5, maxWidth: 800, mx: 'auto', width: '100%' }}>
                <Avatar sx={{ width: 28, height: 28, background: BRAND.primary }}>
                  <AceSpadeIcon sx={{ fontSize: 14 }} />
                </Avatar>
                <Box sx={{ px: 0.5, py: 0.5 }}>
                  <TypingIndicator />
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
            {/* Selection toolbar — appears when user highlights text in messages */}
            <SelectionToolbar
              containerRef={messagesContainerRef}
              onQuote={(text) => {
                const quoted = text.split('\n').map(l => `> ${l}`).join('\n');
                setInputText(prev => prev ? `${prev}\n${quoted}\n` : `${quoted}\n`);
              }}
            />
          </Box>

          {/* Input Area */}
          <Box sx={{
            px: { xs: 1.5, md: 2 },
            py: 1,
            display: messages.length === 0 ? 'none' : 'block',
            maxWidth: 830,
            mx: 'auto',
            width: '100%',
          }}>
            {/* Image preview strip */}
            {attachedDocs.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, px: 0.5, flexWrap: 'wrap' }}>
                {attachedDocs.map((doc, i) => (
                  <Box key={`${doc.name}-${i}`} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 1.2, py: 0.6, borderRadius: 2,
                    border: `1px solid ${doc.error ? alpha('#b42318', 0.5) : BRAND.border}`,
                    background: alpha(BRAND.surface, 0.6),
                    fontSize: '0.78rem',
                    color: doc.error ? '#e5847d' : BRAND.textMuted,
                    maxWidth: 260,
                  }}>
                    <DescriptionIcon sx={{ fontSize: 15 }} />
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </Box>
                    <Box sx={{ color: BRAND.textMuted, opacity: 0.8, whiteSpace: 'nowrap' }}>
                      {doc.loading ? 'reading…' : doc.error ? 'unreadable' : `${Math.round((doc.chars || 0) / 1000)}k chars`}
                    </Box>
                    <IconButton size="small" onClick={() => setAttachedDocs(prev => prev.filter((_, j) => j !== i))}
                      sx={{ width: 18, height: 18, color: BRAND.textMuted }}>
                      <CloseIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {attachedImages.length > 0 && (
              <Box sx={{
                display: 'flex', gap: 1, mb: 1.5, px: 0.5,
                overflowX: 'auto',
                '&::-webkit-scrollbar': { height: 4 },
              }}>
                {attachedImages.map((img, i) => (
                  <Box key={i} sx={{
                    position: 'relative', flexShrink: 0,
                    width: 72, height: 72, borderRadius: '10px',
                    overflow: 'hidden',
                    border: `1px solid ${BRAND.border}`,
                  }}>
                    <img src={img.preview} alt={img.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <IconButton size="small" onClick={() => removeImage(i)}
                      sx={{
                        position: 'absolute', top: 2, right: 2,
                        width: 18, height: 18,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        '&:hover': { background: 'rgba(0,0,0,0.8)' },
                      }}>
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* Action mode indicator */}
            {activeAction && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5,
                animation: 'fadeInUp 0.2s ease',
              }}>
                <Chip
                  label={activeAction.label}
                  icon={activeAction.icon}
                  onDelete={() => setActiveAction(null)}
                  sx={{
                    fontSize: '0.85rem', height: 30, fontWeight: 600,
                    background: alpha(BRAND.primary, 0.15),
                    border: `1px solid ${alpha(BRAND.primary, 0.3)}`,
                    color: BRAND.primaryLight,
                    '& .MuiChip-icon': { color: BRAND.primaryLight },
                    '& .MuiChip-deleteIcon': { color: alpha(BRAND.primaryLight, 0.6), '&:hover': { color: BRAND.primaryLight } },
                  }}
                />
                <Typography sx={{ fontSize: '0.8rem', color: BRAND.textMuted }}>
                  Type your request and press Enter
                </Typography>
              </Box>
            )}

            {/* Action shortcuts — hidden on mobile for clean UX */}
            {!activeAction && (
              <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                {actionChips.map((chip) => (
                  <Chip
                    key={chip.id}
                    label={chip.label}
                    icon={chip.icon}
                    onClick={() => handleActionChip(chip)}
                    sx={{
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      height: 34,
                      px: 0.5,
                      background: alpha(BRAND.bgSurface, 0.5),
                      border: `1px solid ${alpha(BRAND.border, 0.5)}`,
                      color: BRAND.textSecondary,
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      '& .MuiChip-icon': { color: BRAND.textMuted },
                      '&:hover': {
                        background: alpha(BRAND.primary, 0.1),
                        borderColor: alpha(BRAND.primary, 0.3),
                        color: BRAND.primaryLight,
                        '& .MuiChip-icon': { color: BRAND.primaryLight },
                      },
                    }}
                  />
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.rtf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />
              {/* Attach button */}
              <Tooltip title="Attach an image or document" placement="top">
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    width: 44, height: 44,
                    color: BRAND.textMuted,
                    '&:hover': { color: BRAND.primary, background: alpha(BRAND.primary, 0.08) },
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
              <TextField
                inputRef={textFieldRef}
                fullWidth
                multiline
                maxRows={4}
                variant="outlined"
                placeholder={trainPromptMode ? "What do you want to teach me?" : activeAction ? activeAction.placeholder : "Message Ace..."}
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); if (isSpeaking && e.target.value) stopSpeaking(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (trainPromptMode) {
                      handleTrainSubmit();
                    } else {
                      handleSend();
                    }
                  }
                  if (e.key === 'Escape' && trainPromptMode) {
                    setTrainPromptMode(false);
                    setInputText('');
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (items) {
                    for (const item of items) {
                      if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        handleFileSelect([item.getAsFile()]);
                        return;
                      }
                    }
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    fontSize: '1rem',
                    background: trainPromptMode
                      ? alpha('#FF9800', 0.08)
                      : alpha(BRAND.bgSurface, 0.5),
                    borderColor: trainPromptMode ? '#FF9800' : undefined,
                  },
                }}
              />
              {/* Mic / Voice-to-text button — hidden on mobile */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Tooltip title={
                !speechSupported
                  ? 'Voice input not supported in this browser'
                  : isListening
                    ? 'Stop listening'
                    : 'Speak to Ace'
              } placement="top">
                <span>
                  <IconButton
                    onClick={handleMicToggle}
                    disabled={!speechSupported}
                    sx={{
                      width: 44, height: 44,
                      color: isListening ? BRAND.secondary : BRAND.textMuted,
                      background: isListening ? alpha(BRAND.secondary, 0.15) : 'transparent',
                      animation: isListening ? 'micPulse 1.5s infinite' : 'none',
                      '&:hover': {
                        color: isListening ? BRAND.secondary : BRAND.primary,
                        background: isListening
                          ? alpha(BRAND.secondary, 0.2)
                          : alpha(BRAND.primary, 0.08),
                      },
                      '&.Mui-disabled': {
                        color: alpha(BRAND.textMuted, 0.3),
                      },
                      '@keyframes micPulse': {
                        '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(BRAND.secondary, 0.4)}` },
                        '50%': { boxShadow: `0 0 0 8px ${alpha(BRAND.secondary, 0)}` },
                      },
                    }}
                  >
                    {isListening ? <MicIcon sx={{ fontSize: 22 }} /> : <MicOffIcon sx={{ fontSize: 22 }} />}
                  </IconButton>
                </span>
              </Tooltip>
              {/* TTS / Auto-speak toggle */}
              <Tooltip title={
                !ttsSupported
                  ? 'Text-to-speech not supported in this browser'
                  : isSpeaking ? 'Stop speaking'
                  : ttsEnabled ? 'Auto-speak ON (click to disable)'
                  : 'Auto-speak OFF (click to enable)'
              } placement="top">
                <span>
                  <IconButton
                    onClick={() => isSpeaking ? stopSpeaking() : setTtsEnabled(prev => !prev)}
                    disabled={!ttsSupported}
                    sx={{
                      width: 44, height: 44,
                      color: isSpeaking
                        ? BRAND.secondary
                        : ttsEnabled ? BRAND.primaryLight : BRAND.textMuted,
                      background: isSpeaking
                        ? alpha(BRAND.secondary, 0.15)
                        : ttsEnabled ? alpha(BRAND.primary, 0.08) : 'transparent',
                      animation: isSpeaking ? 'speakPulse 1.5s infinite' : 'none',
                      '&:hover': {
                        color: isSpeaking ? BRAND.secondary : BRAND.primary,
                        background: isSpeaking
                          ? alpha(BRAND.secondary, 0.2)
                          : alpha(BRAND.primary, 0.08),
                      },
                      '&.Mui-disabled': { color: alpha(BRAND.textMuted, 0.3) },
                      '@keyframes speakPulse': {
                        '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(BRAND.secondary, 0.4)}` },
                        '50%': { boxShadow: `0 0 0 8px ${alpha(BRAND.secondary, 0)}` },
                      },
                    }}
                  >
                    {isSpeaking
                      ? <StopCircleIcon sx={{ fontSize: 22 }} />
                      : ttsEnabled
                        ? <VolumeUpIcon sx={{ fontSize: 22 }} />
                        : <VolumeOffIcon sx={{ fontSize: 22 }} />
                    }
                  </IconButton>
                </span>
              </Tooltip>
              {/* Train / Teach button */}
              <Tooltip title={
                isTraining ? 'Stop recording'
                  : trainPromptMode ? 'Cancel teaching'
                  : 'Teach Ace a new procedure'
              } placement="top">
                <IconButton
                  onClick={handleTrainClick}
                  sx={{
                    width: 44, height: 44,
                    color: isTraining ? '#fff' : trainPromptMode ? '#FF9800' : BRAND.textMuted,
                    background: isTraining ? '#f44336' : 'transparent',
                    animation: isTraining ? 'trainPulse 1.5s infinite' : 'none',
                    '&:hover': {
                      color: isTraining ? '#fff' : '#FF9800',
                      background: isTraining ? '#d32f2f' : alpha('#FF9800', 0.08),
                    },
                    '@keyframes trainPulse': {
                      '0%, 100%': { boxShadow: '0 0 0 0 rgba(244,67,54,0.4)' },
                      '50%': { boxShadow: '0 0 0 8px rgba(244,67,54,0)' },
                    },
                  }}
                >
                  {isTraining ? <StopCircleIcon sx={{ fontSize: 24 }} /> : <SchoolIcon sx={{ fontSize: 22 }} />}
                </IconButton>
              </Tooltip>
              </Box>
              {/* Send / Stop button */}
              {isThinking ? (
                <Tooltip title="Stop Ace" placement="top">
                  <IconButton
                    onClick={handleStop}
                    sx={{
                      width: 52, height: 52,
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#fff',
                      boxShadow: `0 4px 15px ${alpha('#ef4444', 0.4)}`,
                      transition: 'all 0.3s ease',
                      animation: 'stopPulse 2s infinite',
                      '@keyframes stopPulse': {
                        '0%, 100%': { boxShadow: `0 4px 15px ${alpha('#ef4444', 0.4)}` },
                        '50%': { boxShadow: `0 4px 25px ${alpha('#ef4444', 0.6)}` },
                      },
                      '&:hover': {
                        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <StopCircleIcon sx={{ fontSize: 26 }} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title={trainPromptMode ? 'Start teaching' : 'Send message'} placement="top">
                  <span>
                    <IconButton
                      data-send-button
                      onClick={trainPromptMode ? handleTrainSubmit : handleSend}
                      disabled={!inputText.trim() && attachedImages.length === 0}
                      sx={{
                        width: 52, height: 52,
                        background: (inputText.trim() || attachedImages.length > 0)
                          ? trainPromptMode
                            ? 'linear-gradient(135deg, #FF9800, #FFB74D)'
                            : `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`
                          : alpha(BRAND.textMuted, 0.1),
                        color: '#fff',
                        boxShadow: (inputText.trim() || attachedImages.length > 0) ? `0 4px 15px ${alpha(BRAND.primary, 0.4)}` : 'none',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: trainPromptMode
                            ? 'linear-gradient(135deg, #F57C00, #FF9800)'
                            : `linear-gradient(135deg, ${BRAND.primaryDark}, ${BRAND.primary})`,
                          transform: 'scale(1.05)',
                        },
                        '&.Mui-disabled': {
                          color: BRAND.textMuted,
                          background: alpha(BRAND.textMuted, 0.1),
                        },
                      }}
                    >
                      <SendIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Project created toast */}
      <Snackbar
        open={!!projectToast}
        autoHideDuration={8000}
        onClose={() => setProjectToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={projectToast ? `Project "${projectToast.name}" is ready!` : ''}
        action={
          <Button
            size="small"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('ace:navigate', { detail: { page: 'studio' } }));
              setProjectToast(null);
            }}
            sx={{ color: BRAND.secondary, fontWeight: 700, textTransform: 'none' }}
          >
            Open in Studio
          </Button>
        }
        slotProps={{ content: {
          sx: {
            background: BRAND.bgCard,
            border: `1px solid ${alpha(BRAND.secondary, 0.3)}`,
            borderRadius: '12px',
            color: BRAND.textPrimary,
            fontWeight: 500,
            boxShadow: `0 8px 24px ${alpha('#000', 0.4)}`,
          }
        } }}
      />
      {/* New Process Dialog — opened from Train button */}
      <NewProcessDialog
        open={newProcessOpen}
        onClose={() => setNewProcessOpen(false)}
        onCreated={(sop) => {
          setNewProcessOpen(false);
          setMessages(prev => [...prev, {
            role: 'ace',
            text: `Saved **"${sop?.name || 'New Process'}"** with ${sop?.steps?.length || '?'} steps. You can run it anytime by asking me.`,
          }]);
        }}
      />
    </Box>
  );
}

export default Chat;
