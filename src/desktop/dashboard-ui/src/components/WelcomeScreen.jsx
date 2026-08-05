import { useState, useRef } from 'react';
import { Box, Typography, TextField, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import AceSpadeIcon from './AceSpadeIcon';

export default function WelcomeScreen({ onSend, onAttach }) {
  const [input, setInput] = useState('');
  const fileRef = useRef(null);

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

  const suggestions = [
    'Help me find new leads',
    'Research my competitors',
    'Help me grow my business',
  ];

  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      mt: { xs: -8, md: -4 },
    }}>
      {/* Icon + Greeting */}
      <AceSpadeIcon sx={{ fontSize: 28, color: '#8B7EC8', mb: 2, opacity: 0.7 }} />

      <Typography sx={{
        fontSize: { xs: '1.4rem', md: '1.8rem' },
        fontWeight: 600,
        color: '#E8E6F0',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        mb: 3,
      }}>
        What does your business need?
      </Typography>

      {/* Input bar — centered like Gemini */}
      <Box sx={{
        width: '100%',
        maxWidth: 520,
        mb: 3,
      }}>
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
            sx={{ color: '#726E90', '&:hover': { color: '#B0ACCA' } }}>
            <AddIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { onAttach?.(Array.from(e.target.files)); e.target.value = ''; }}
          />
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ace anything..."
            variant="standard"
            InputProps={{ disableUnderline: true }}
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
              '&:hover': { background: input.trim() ? '#6B5FA8' : 'rgba(139,126,200,0.08)' },
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
        maxWidth: 520,
      }}>
        {suggestions.map((text) => (
          <Box
            key={text}
            onClick={() => onSend?.(text)}
            sx={{
              px: 2,
              py: 1,
              borderRadius: 5,
              border: '1px solid #2A2840',
              color: '#B0ACCA',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: '#8B7EC8',
                color: '#E8E6F0',
              },
            }}
          >
            {text}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
