import { useState, useRef } from 'react';
import { Box, Typography, TextField, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import AceSpadeIcon from './AceSpadeIcon';

export default function WelcomeScreen({ onSend, onAttach }) {
  const [input, setInput] = useState('');
  const fileRef = useRef(null);

  // Check for returning user
  const storedUser = JSON.parse(localStorage.getItem('ace_user') || 'null');
  const userName = storedUser?.name;
  const isReturning = !!userName;

  // Time-aware greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleSend = () => {
    if (input.trim()) {
      onSend?.(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = isReturning
    ? [
        'Find me new leads',
        "What's in my pipeline?",
        'Research my competitors',
      ]
    : [
        'I need help finding leads',
        'Research my competitors',
        'What can you do for my business?',
      ];

  return (
    <Box sx={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
    }}>
      {/* Icon */}
      <AceSpadeIcon sx={{ fontSize: 28, color: '#8B7EC8', mb: 2, opacity: 0.7 }} />

      {/* Greeting */}
      <Typography sx={{
        fontSize: { xs: '1.3rem', md: '1.7rem' },
        fontWeight: 600,
        color: '#E8E6F0',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        mb: 0.5,
      }}>
        {isReturning ? `${timeGreeting}, ${userName}` : 'Hey, tell me about your business'}
      </Typography>

      <Typography sx={{
        fontSize: { xs: '0.85rem', md: '0.9rem' },
        color: '#726E90',
        textAlign: 'center',
        mb: 3,
        maxWidth: 400,
      }}>
        {isReturning
          ? "What are we working on today?"
          : "I'll help you find leads, research competitors, and grow."
        }
      </Typography>

      {/* Input bar */}
      <Box sx={{ width: '100%', maxWidth: 480, mb: 2.5 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          background: '#16151E',
          border: '1px solid #2A2840',
          borderRadius: 6,
          px: 1.5,
          py: 0.5,
          transition: 'border-color 0.15s',
          '&:focus-within': { borderColor: '#8B7EC8' },
        }}>
          <IconButton size="small" onClick={() => fileRef.current?.click()}
            sx={{ color: '#726E90', '&:hover': { color: '#B0ACCA' }, display: { xs: 'none', md: 'flex' } }}>
            <AddIcon sx={{ fontSize: 20 }} />
          </IconButton>
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
            placeholder={isReturning ? 'What do you need?' : 'My business is...'}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            autoFocus
            sx={{
              mx: 1,
              '& .MuiInputBase-input': {
                fontSize: '0.95rem',
                color: '#E8E6F0',
                py: 1,
                '&::placeholder': { color: '#726E90', opacity: 1 },
              },
            }}
          />
          <IconButton size="small" onClick={handleSend}
            disabled={!input.trim()}
            sx={{
              width: 34, height: 34,
              color: input.trim() ? '#fff' : '#726E90',
              background: input.trim() ? '#8B7EC8' : 'transparent',
              '&:hover': { background: input.trim() ? '#6B5FA8' : 'rgba(139,126,200,0.06)' },
              '&.Mui-disabled': { color: '#726E90' },
              transition: 'all 0.15s ease',
            }}>
            <SendIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Suggestions */}
      <Box sx={{
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 480,
      }}>
        {suggestions.map((text) => (
          <Box
            key={text}
            onClick={() => onSend?.(text)}
            sx={{
              px: 1.8,
              py: 0.8,
              borderRadius: 4,
              border: '1px solid #2A2840',
              color: '#B0ACCA',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#8B7EC8', color: '#E8E6F0' },
            }}
          >
            {text}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
