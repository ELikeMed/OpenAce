import { useState, useRef } from 'react';
import { Box, Typography, TextField, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AceSpadeIcon from './AceSpadeIcon';

export default function WelcomeScreen({ onSend, onAttach }) {
  const [input, setInput] = useState('');
  const fileRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem('ace_user') || 'null');
  const userName = storedUser?.name;
  const isReturning = !!userName;

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleSend = () => {
    if (input.trim()) { onSend?.(input.trim()); setInput(''); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const suggestions = isReturning
    ? ['Find me new leads', "What's in my pipeline?", 'Research my competitors']
    : ['I need help finding leads', 'Research my competitors', 'What can you do for my business?'];

  return (
    <Box sx={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
    }}>
      {/* Logo mark */}
      <AceSpadeIcon sx={{ fontSize: 24, color: '#C9A96E', mb: 3, opacity: 0.6 }} />

      {/* Greeting */}
      <Typography sx={{
        fontSize: { xs: '1.5rem', md: '2rem' },
        fontWeight: 300,
        color: '#F0EDE8',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        mb: 0.5,
      }}>
        {isReturning ? `${timeGreeting}, ${userName}` : 'What does your business need?'}
      </Typography>

      {!isReturning && (
        <Typography sx={{
          fontSize: '0.88rem',
          color: '#6B6560',
          textAlign: 'center',
          mb: 4,
          fontWeight: 400,
        }}>
          Find leads. Close deals. Grow your business.
        </Typography>
      )}

      {isReturning && <Box sx={{ mb: 4 }} />}

      {/* Input bar */}
      <Box sx={{ width: '100%', maxWidth: 520, mb: 3 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          background: '#141414',
          border: '1px solid #1E1E1E',
          borderRadius: 3,
          px: 1.5,
          py: 0.5,
          transition: 'border-color 0.2s',
          '&:focus-within': { borderColor: '#C9A96E' },
        }}>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { onAttach?.(Array.from(e.target.files)); e.target.value = ''; }}
          />
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isReturning ? 'What do you need?' : 'Tell me about your business...'}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            autoFocus
            sx={{
              mx: 1,
              '& .MuiInputBase-input': {
                fontSize: '0.95rem',
                color: '#F0EDE8',
                py: 1.2,
                '&::placeholder': { color: '#6B6560', opacity: 1 },
              },
            }}
          />
          <IconButton size="small" onClick={handleSend}
            disabled={!input.trim()}
            sx={{
              width: 32, height: 32,
              borderRadius: 2,
              color: input.trim() ? '#0A0A0A' : '#6B6560',
              background: input.trim() ? '#C9A96E' : 'transparent',
              '&:hover': { background: input.trim() ? '#A88B4A' : 'rgba(201,169,110,0.08)' },
              '&.Mui-disabled': { color: '#6B6560' },
              transition: 'all 0.15s ease',
            }}>
            <ArrowUpwardIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Suggestions */}
      <Box sx={{
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 520,
      }}>
        {suggestions.map((text) => (
          <Box
            key={text}
            onClick={() => onSend?.(text)}
            sx={{
              px: 1.8,
              py: 0.7,
              borderRadius: 2,
              border: '1px solid #1E1E1E',
              color: '#A09A90',
              fontSize: '0.8rem',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#C9A96E', color: '#F0EDE8' },
            }}
          >
            {text}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
