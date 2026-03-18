import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, TextField, Button, Paper, Typography, Avatar, alpha, IconButton, Chip,
  Checkbox, Select, MenuItem, CircularProgress, LinearProgress, Tooltip, Snackbar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AceSpadeIcon from './components/AceSpadeIcon';
import PersonIcon from '@mui/icons-material/Person';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
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
import ConversationSidebar from './components/ConversationSidebar';
import { BRAND } from './theme';

function TypingIndicator() {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, py: 1, px: 0.5 }}>
      {[0, 1, 2].map(i => (
        <Box key={i} sx={{
          width: 7, height: 7, borderRadius: '50%',
          background: BRAND.primary,
          opacity: 0.4,
          animation: 'typing 1.4s infinite',
          animationDelay: `${i * 0.2}s`,
          '@keyframes typing': {
            '0%, 60%, 100%': { opacity: 0.4, transform: 'translateY(0)' },
            '30%': { opacity: 1, transform: 'translateY(-4px)' },
          },
        }} />
      ))}
    </Box>
  );
}

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
  const { stepNum, description, error } = showMe;

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

function MessageBubble({ msg, msgIndex, onConfirmActions, onCancelActions, onQuestionAnswer, onShowMeReady, onShowMeStart, onShowMeDone, onShowMeSkip, onHealthShowMe, onStepCorrect, onSpeak, onStopSpeaking, isSpeakingThis }) {
  const isUser = msg.sender === 'You';
  const isSystem = msg.sender === 'System';
  const isThinking = msg.sender?.includes('Thinking') || msg.sender?.includes('Thought');

  const getBubbleStyle = () => {
    if (isUser) return {
      background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%)`,
      color: '#fff',
      borderRadius: '16px 16px 4px 16px',
      boxShadow: `0 2px 12px ${alpha(BRAND.primary, 0.3)}`,
    };
    if (isSystem) return {
      background: alpha(BRAND.warning, 0.08),
      color: BRAND.warning,
      borderRadius: '16px 16px 16px 4px',
      border: `1px solid ${alpha(BRAND.warning, 0.15)}`,
    };
    if (isThinking) return {
      background: alpha(BRAND.textMuted, 0.06),
      color: BRAND.textMuted,
      borderRadius: '16px 16px 16px 4px',
      border: `1px dashed ${alpha(BRAND.textMuted, 0.15)}`,
      fontStyle: 'italic',
    };
    return {
      background: alpha(BRAND.bgElevated, 0.8),
      color: BRAND.textPrimary,
      borderRadius: '16px 16px 16px 4px',
      border: `1px solid ${BRAND.border}`,
    };
  };

  const getAvatar = () => {
    if (isUser) return (
      <Avatar sx={{
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
      }}>
        <PersonIcon sx={{ fontSize: 22 }} />
      </Avatar>
    );
    if (isSystem) return (
      <Avatar sx={{
        width: 40, height: 40,
        background: alpha(BRAND.warning, 0.15),
        color: BRAND.warning,
      }}>
        <InfoOutlinedIcon sx={{ fontSize: 22 }} />
      </Avatar>
    );
    if (isThinking) return (
      <Avatar sx={{
        width: 40, height: 40,
        background: alpha(BRAND.textMuted, 0.1),
        color: BRAND.textMuted,
      }}>
        <AutoAwesomeIcon sx={{ fontSize: 22 }} />
      </Avatar>
    );
    return (
      <Avatar sx={{
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.secondaryLight})`,
      }}>
        <AceSpadeIcon sx={{ fontSize: 22 }} />
      </Avatar>
    );
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 1.5,
      mb: 2,
      px: 1,
      animation: 'fadeInUp 0.3s ease',
      '@keyframes fadeInUp': {
        from: { opacity: 0, transform: 'translateY(8px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      {getAvatar()}
      <Box sx={{ maxWidth: '85%' }}>
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
          px: 2.5, py: 2, ...getBubbleStyle(),
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
            <Typography variant="body2" sx={{
              fontSize: '1.06rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </Typography>
          )}
        </Box>

        {/* Tools used indicator */}
        {msg.toolsUsed?.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, px: 0.5 }}>
            {msg.toolsUsed.map((tool, i) => (
              <Chip key={i} label={tool.replace(/_/g, ' ')} size="small"
                sx={{
                  fontSize: '0.65rem', height: 20, fontWeight: 500,
                  bgcolor: alpha(BRAND.primary, 0.1),
                  color: alpha(BRAND.primaryLight, 0.8),
                  border: `1px solid ${alpha(BRAND.primary, 0.15)}`,
                  '& .MuiChip-icon': { fontSize: 11, color: alpha(BRAND.primaryLight, 0.6) },
                }}
                icon={<BuildIcon />}
              />
            ))}
          </Box>
        )}

        {/* Per-message speak button — only on Ace messages with text */}
        {!isUser && !isSystem && !isThinking && msg.text && onSpeak && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, px: 0.5 }}>
            <Tooltip title={isSpeakingThis ? 'Stop' : 'Read aloud'} placement="top">
              <IconButton
                size="small"
                onClick={() => isSpeakingThis ? onStopSpeaking() : onSpeak(msg.text, msgIndex)}
                sx={{
                  width: 26, height: 26,
                  color: isSpeakingThis ? BRAND.secondary : alpha(BRAND.textMuted, 0.5),
                  '&:hover': {
                    color: isSpeakingThis ? BRAND.secondary : BRAND.primaryLight,
                    background: alpha(BRAND.primary, 0.08),
                  },
                }}
              >
                {isSpeakingThis
                  ? <StopCircleIcon sx={{ fontSize: 16 }} />
                  : <VolumeUpIcon sx={{ fontSize: 16 }} />
                }
              </IconButton>
            </Tooltip>
          </Box>
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

function ActivityLog({ steps, complete }) {
  return (
    <Box sx={{
      display: 'flex',
      gap: 1.5,
      mb: 2,
      px: 1,
      animation: 'fadeInUp 0.3s ease',
      '@keyframes fadeInUp': {
        from: { opacity: 0, transform: 'translateY(8px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Avatar sx={{
        width: 40, height: 40,
        background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.secondaryLight})`,
      }}>
        <AceSpadeIcon sx={{ fontSize: 22 }} />
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={{
          display: 'block',
          fontSize: '0.8rem',
          color: BRAND.textMuted,
          mb: 0.5,
          px: 0.5,
        }}>
          Ace
        </Typography>
        <Box sx={{
          borderLeft: `2px solid ${complete ? alpha(BRAND.success, 0.4) : alpha(BRAND.primary, 0.4)}`,
          pl: 2,
          py: 0.5,
        }}>
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                {complete || !isLast ? (
                  <CheckCircleIcon sx={{ fontSize: 16, color: BRAND.success }} />
                ) : (
                  <CircularProgress size={14} sx={{ color: BRAND.primary }} />
                )}
                <Typography sx={{
                  fontSize: '0.9rem',
                  color: complete || !isLast ? BRAND.textSecondary : BRAND.textPrimary,
                  fontWeight: isLast && !complete ? 500 : 400,
                }}>
                  {step}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

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

function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainPromptMode, setTrainPromptMode] = useState(false);
  const messagesEndRef = useRef(null);
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

  // Prefill chat input from other pages (e.g., Integrations "Train Ace" button)
  useEffect(() => {
    const handle = (e) => {
      const msg = e.detail?.message;
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
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMsgIdx(null);
    ttsUtteranceRef.current = null;
  }, []);

  const speakText = useCallback((text, messageIndex = null) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    const cleanText = stripMarkdownForSpeech(text);
    if (!cleanText) return;

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
      console.log('[TTS] Using voice:', preferred.name);
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
  const handleFileSelect = useCallback((files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) continue; // 10MB limit
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachedImages(prev => [...prev, {
          base64: e.target.result,
          name: file.name,
          preview: e.target.result,
        }]);
      };
      reader.readAsDataURL(file);
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
            // Insert a ShowMe card for the failed step
            return [...updated, {
              sender: 'Ace',
              text: '',
              showMe: { sopId: data.sopId, stepNum: data.stepNum, description: data.description, error: data.error },
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

  // ═══ Desktop Training — Train button handlers ═══
  const handleTrainClick = () => {
    if (isTraining) {
      // Currently recording — stop it
      handleTrainStop();
    } else if (trainPromptMode) {
      // Already showing prompt — cancel it
      setTrainPromptMode(false);
      setInputText('');
    } else {
      // Show inline prompt to ask what to teach
      setTrainPromptMode(true);
      setInputText('');
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
        setMessages(prev => [...prev, {
          role: 'ace',
          text: `🎓 Got it! I'm watching your screen now. Show me how to: **"${name}"**\n\nDo your thing — I'm recording every 2 seconds. Click the **Stop** button when you're done.`,
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
                return [...updated, { sender: 'Ace', text: botMessage, pendingActions, actionsConfirmed: false, question, questionAnswered: false, toolsUsed }];
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
    if (!hasText && !hasImages) return;
    if (isSpeaking) stopSpeaking();

    // Prepend action prefix if an action chip is active (user doesn't see it)
    const rawText = inputText.trim();
    const messageToSend = activeAction ? activeAction.prefix + rawText : rawText;
    const imagesToSend = [...attachedImages];
    setMessages(prev => [...prev, {
      sender: 'You',
      text: rawText || (imagesToSend.length > 0 ? `Sent ${imagesToSend.length} image(s)` : ''),
      images: imagesToSend.map(img => img.preview),
      actionMode: activeAction?.label || null,
    }]);
    setInputText('');
    setAttachedImages([]);
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
          message: messageToSend,
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
              if (question) console.log('[Chat] Received question with', question.options?.length, 'options');
              if (pendingActions) console.log('[Chat] Received', pendingActions.length, 'pendingActions');

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
      desc: 'Show Ace any workflow once — posting on social media, searching a website, filling out forms — and it learns to repeat it.',
      cta: 'Start teaching',
      action: () => {
        markSetupDone('teach');
        sendMessageDirect('I want to teach you a process I do regularly. Walk me through how teaching works — what kind of things can I teach you and how do we start?');
      },
    },
  ];

  return (
    <Box ref={chatContainerRef} sx={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'row' }}>
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Paper sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: alpha(BRAND.bgCard, 0.5),
          backdropFilter: 'blur(20px)',
          borderRadius: 0,
        }}>
          <Box
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
              <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
                <Avatar sx={{
                  width: 72, height: 72, mx: 'auto', mb: 1.5,
                  background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                  boxShadow: `0 8px 30px ${alpha(BRAND.primary, 0.3)}`,
                }}>
                  <AceSpadeIcon sx={{ fontSize: 36 }} />
                </Avatar>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Ace Is Ready to Close Deals
                </Typography>
                <Typography variant="body2" sx={{ color: BRAND.textMuted, mb: 2, fontSize: '0.95rem', maxWidth: 500, mx: 'auto' }}>
                  Tell Ace who your ideal customer is and watch it find leads, reach out, follow up, and move deals through your pipeline — all from this chat.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => window.dispatchEvent(new CustomEvent('ace:start-tour'))}
                  sx={{
                    mb: 3, fontSize: '0.78rem', textTransform: 'none',
                    borderColor: alpha(BRAND.primary, 0.3),
                    color: BRAND.primaryLight,
                    '&:hover': { borderColor: BRAND.primary, background: alpha(BRAND.primary, 0.08) },
                  }}
                >
                  Take a Tour
                </Button>

                {/* ═══ Get Ace Running — Guided Setup ═══ */}
                {setupSteps.filter(s => !completedSetup.includes(s.id)).length > 0 && (
                  <Box sx={{
                    maxWidth: 680, mx: 'auto', mb: 3,
                    border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: alpha(BRAND.bgCard, 0.5),
                    backdropFilter: 'blur(10px)',
                  }}>
                    {/* Section header */}
                    <Box sx={{
                      px: 2.5, py: 1.5,
                      background: alpha(BRAND.primary, 0.06),
                      borderBottom: `1px solid ${alpha(BRAND.primary, 0.12)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RocketLaunchIcon sx={{ fontSize: 18, color: BRAND.primaryLight }} />
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: BRAND.textPrimary }}>
                          Start Making Money
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.72rem', color: BRAND.textMuted }}>
                        {completedSetup.length} / {setupSteps.length} complete
                      </Typography>
                    </Box>

                    {/* Progress bar */}
                    <LinearProgress
                      variant="determinate"
                      value={(completedSetup.length / setupSteps.length) * 100}
                      sx={{
                        height: 3,
                        backgroundColor: alpha(BRAND.primary, 0.08),
                        '& .MuiLinearProgress-bar': {
                          background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`,
                          borderRadius: 0,
                        },
                      }}
                    />

                    {/* Steps */}
                    <Box sx={{ p: 1 }}>
                      {setupSteps.map((step) => {
                        const done = completedSetup.includes(step.id);
                        return (
                          <Box
                            key={step.id}
                            onClick={() => { if (!done) step.action(); }}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              px: 2, py: 1.25,
                              borderRadius: '10px',
                              cursor: done ? 'default' : 'pointer',
                              opacity: done ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              ...(!done && {
                                '&:hover': {
                                  background: alpha(BRAND.primary, 0.08),
                                  '& .step-cta': { opacity: 1 },
                                },
                              }),
                            }}
                          >
                            {/* Step icon */}
                            <Box sx={{
                              width: 38, height: 38,
                              borderRadius: '10px',
                              background: done ? alpha(BRAND.success, 0.15) : step.gradient,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: done ? BRAND.success : '#fff',
                              flexShrink: 0,
                              boxShadow: done ? 'none' : `0 3px 10px ${alpha('#000', 0.15)}`,
                              transition: 'all 0.3s ease',
                            }}>
                              {done ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : step.icon}
                            </Box>

                            {/* Text */}
                            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <Typography sx={{
                                fontWeight: 600, fontSize: '0.82rem',
                                color: done ? BRAND.textMuted : BRAND.textPrimary,
                                textDecoration: done ? 'line-through' : 'none',
                                lineHeight: 1.3,
                              }}>
                                {step.title}
                              </Typography>
                              <Typography sx={{ fontSize: '0.72rem', color: BRAND.textMuted, lineHeight: 1.4 }}>
                                {step.desc}
                              </Typography>
                            </Box>

                            {/* CTA arrow */}
                            {!done && (
                              <Box
                                className="step-cta"
                                sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.5,
                                  fontSize: '0.72rem', fontWeight: 600,
                                  color: BRAND.primaryLight,
                                  opacity: 0.5,
                                  transition: 'opacity 0.2s',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {step.cta}
                                <ArrowForwardIcon sx={{ fontSize: 13 }} />
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* Quick Start Actions */}
                <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mb: 1 }}>
                  Try asking:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {quickActions.map((action, i) => (
                    <Chip
                      key={i}
                      label={action}
                      onClick={() => { setInputText(action); }}
                      sx={{
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        py: 2.5,
                        background: alpha(BRAND.primary, 0.08),
                        border: `1px solid ${alpha(BRAND.primary, 0.15)}`,
                        color: BRAND.primaryLight,
                        '&:hover': {
                          background: alpha(BRAND.primary, 0.15),
                          border: `1px solid ${alpha(BRAND.primary, 0.3)}`,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
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
                  onSpeak={speakText}
                  onStopSpeaking={stopSpeaking}
                  isSpeakingThis={speakingMsgIdx === index}
                />
              )
            ))}
            {isThinking && (
              <Box sx={{ display: 'flex', gap: 1.5, px: 1, mb: 2 }}>
                <Avatar sx={{
                  width: 40, height: 40,
                  background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.secondaryLight})`,
                }}>
                  <AceSpadeIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Box sx={{
                  px: 2.5, py: 2,
                  background: alpha(BRAND.bgElevated, 0.8),
                  borderRadius: '16px 16px 16px 4px',
                  border: `1px solid ${BRAND.border}`,
                }}>
                  <TypingIndicator />
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box sx={{
            p: 2,
            borderTop: `1px solid ${BRAND.border}`,
            background: alpha(BRAND.bgCard, 0.8),
            backdropFilter: 'blur(20px)',
          }}>
            {/* Image preview strip */}
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

            {/* Action shortcuts */}
            {!activeAction && (
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
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
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              />
              {/* Attach button */}
              <Tooltip title="Attach image" placement="top">
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
              {/* Mic / Voice-to-text button */}
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
    </Box>
  );
}

export default Chat;
