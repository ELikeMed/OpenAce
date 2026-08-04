import React, { useRef } from 'react';
import { Box, TextField, IconButton, Tooltip, Chip, Typography, alpha } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CloseIcon from '@mui/icons-material/Close';
import BoltIcon from '@mui/icons-material/Bolt';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { BRAND } from '../theme';

const MODES = [
  { id: 'quick', label: 'Quick', icon: <BoltIcon sx={{ fontSize: 14 }} />, color: BRAND.secondary },
  { id: 'agent', label: 'Agent', icon: <SmartToyIcon sx={{ fontSize: 14 }} />, color: BRAND.primary },
];

export default function InputArea({
  value,
  onChange,
  onSend,
  onStop,
  onAttach,
  images = [],
  onRemoveImage,
  isThinking,
  mode = 'agent',
  onModeChange,
  listening,
  onToggleMic,
  placeholder,
}) {
  const fileRef = useRef(null);
  const currentMode = MODES.find(m => m.id === mode) || MODES[1];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isThinking) onSend();
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onAttach?.([file]);
        break;
      }
    }
  };

  return (
    <Box sx={{
      px: { xs: 2, md: 4 },
      pb: 2,
      pt: 1,
      maxWidth: 800,
      mx: 'auto',
      width: '100%',
    }}>
      {/* Image previews */}
      {images.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <Box key={i} sx={{ position: 'relative', width: 56, height: 56 }}>
              <Box component="img" src={img.preview || img}
                sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: 'cover', border: `1px solid ${BRAND.border}` }}
              />
              <IconButton size="small"
                onClick={() => onRemoveImage?.(i)}
                sx={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18,
                  background: BRAND.bgCard, border: `1px solid ${BRAND.border}`,
                  '&:hover': { background: BRAND.error },
                }}>
                <CloseIcon sx={{ fontSize: 10, color: BRAND.textPrimary }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Main input container */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        background: BRAND.bgCard,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 3,
        transition: 'border-color 0.2s',
        '&:focus-within': { borderColor: BRAND.borderLight },
      }}>
        {/* Text field */}
        <TextField
          multiline
          maxRows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder || 'Ask anything, or task an agent...'}
          variant="standard"
          fullWidth
          InputProps={{ disableUnderline: true }}
          sx={{
            px: 2, pt: 1.5,
            '& .MuiInputBase-input': {
              fontSize: '0.92rem',
              color: BRAND.textPrimary,
              lineHeight: 1.5,
              '&::placeholder': { color: BRAND.textMuted, opacity: 1 },
            },
          }}
        />

        {/* Bottom toolbar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5, py: 1,
          gap: 0.5,
        }}>
          {/* Attach */}
          <Tooltip title="Attach file">
            <IconButton size="small" onClick={() => fileRef.current?.click()}
              sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.textSecondary } }}>
              <AddIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => onAttach?.(Array.from(e.target.files))}
          />

          {/* Mode chip */}
          <Chip
            icon={currentMode.icon}
            label={currentMode.label}
            size="small"
            onClick={() => onModeChange?.(mode === 'quick' ? 'agent' : 'quick')}
            sx={{
              height: 26,
              fontSize: '0.72rem',
              fontWeight: 600,
              background: alpha(currentMode.color, 0.12),
              color: currentMode.color,
              border: `1px solid ${alpha(currentMode.color, 0.2)}`,
              cursor: 'pointer',
              '& .MuiChip-icon': { color: currentMode.color },
              '&:hover': { background: alpha(currentMode.color, 0.2) },
            }}
          />

          <Box sx={{ flex: 1 }} />

          {/* Mic */}
          {onToggleMic && (
            <Tooltip title={listening ? 'Stop listening' : 'Voice input'}>
              <IconButton size="small" onClick={onToggleMic}
                sx={{
                  color: listening ? BRAND.error : BRAND.textMuted,
                  '&:hover': { color: listening ? BRAND.error : BRAND.textSecondary },
                }}>
                {listening ? <MicOffIcon sx={{ fontSize: 20 }} /> : <MicIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
          )}

          {/* Send / Stop */}
          {isThinking ? (
            <IconButton size="small" onClick={onStop}
              sx={{
                width: 32, height: 32,
                background: BRAND.error,
                color: '#fff',
                '&:hover': { background: alpha(BRAND.error, 0.8) },
              }}>
              <StopCircleIcon sx={{ fontSize: 18 }} />
            </IconButton>
          ) : (
            <IconButton size="small" onClick={onSend}
              disabled={!value.trim()}
              sx={{
                width: 32, height: 32,
                background: value.trim() ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})` : 'transparent',
                color: value.trim() ? '#fff' : BRAND.textMuted,
                boxShadow: value.trim() ? `0 2px 10px ${alpha(BRAND.primary, 0.4)}` : 'none',
                '&:hover': { background: value.trim() ? BRAND.primary : alpha(BRAND.primary, 0.1) },
                '&.Mui-disabled': { color: BRAND.textMuted, background: 'transparent' },
                transition: 'all 0.2s ease',
              }}>
              <SendIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Footer text */}
      <Typography sx={{
        textAlign: 'center', mt: 1,
        fontSize: '0.65rem', color: alpha(BRAND.textMuted, 0.5),
      }}>
        Ace can make mistakes. Verify important information.
      </Typography>
    </Box>
  );
}
