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

  // A first-time visitor tapping "I need help finding leads" asks for work Ace cannot do
  // well yet — it knows nothing about them, so the answer is generic and the impression is
  // that Ace is not much use. These openers instead say who the person is, which is the one
  // thing Ace needs before anything else is useful, and it can ask a focused follow-up from
  // there. Anyone who would rather type still has the input above.
  const suggestions = isReturning
    ? ['Find me new leads', "What's in my pipeline?", 'Research my competitors']
    : [
        'I run a local service business',
        'I sell products online',
        "I'm in real estate",
        "I'm starting something new",
      ];

  return (
    <Box sx={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: { xs: 2.5, md: 2 },
      // Sit slightly above centre on a tall phone; dead centre leaves the content stranded
      // in the middle with large empty bands above and below.
      pb: { xs: 6, md: 0 },
      // Clear of the home indicator and Safari's bottom bar.
      pt: { xs: 2, md: 0 },
    }}>
      {/* Logo mark */}
      <AceSpadeIcon sx={{ fontSize: 24, color: '#C9A96E', mb: { xs: 2, md: 3 }, opacity: 0.6 }} />

      {/* Greeting */}
      <Typography sx={{
        fontSize: { xs: '1.55rem', md: '2rem' },
        fontWeight: 300,
        color: '#F0EDE8',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        lineHeight: 1.2,
        mb: 0.5,
      }}>
        {isReturning ? `${timeGreeting}, ${userName}` : 'What does your business need?'}
      </Typography>

      {!isReturning && (
        <Typography sx={{
          fontSize: '0.88rem',
          color: '#6B6560',
          textAlign: 'center',
          mb: { xs: 3, md: 4 },
          fontWeight: 400,
        }}>
          Find leads. Close deals. Grow your business.
        </Typography>
      )}

      {isReturning && <Box sx={{ mb: 4 }} />}

      {/* Input bar */}
      <Box sx={{ width: '100%', maxWidth: 520, mb: { xs: 2, md: 3 } }}>
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
        gap: { xs: 0.8, md: 1 },
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 520,
        width: '100%',
      }}>
        {suggestions.map((text) => (
          <Box
            key={text}
            onClick={() => onSend?.(text)}
            sx={{
              px: { xs: 1.6, md: 1.8 },
              // ~44px tall on a phone, which is the minimum comfortable tap target.
              py: { xs: 1.1, md: 0.7 },
              borderRadius: 2,
              border: '1px solid #1E1E1E',
              color: '#A09A90',
              fontSize: { xs: '0.82rem', md: '0.8rem' },
              fontWeight: 400,
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.25,
              transition: 'all 0.15s ease',
              '&:active': { borderColor: '#C9A96E', color: '#F0EDE8' },
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
