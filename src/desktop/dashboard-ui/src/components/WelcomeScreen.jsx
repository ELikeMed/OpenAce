import { Box, Typography } from '@mui/material';
import AceSpadeIcon from './AceSpadeIcon';

export default function WelcomeScreen({ onSuggestionClick }) {
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
      px: 3,
      pb: 16,
    }}>
      {/* Icon */}
      <AceSpadeIcon sx={{ fontSize: 32, color: '#8B7EC8', mb: 2.5, opacity: 0.8 }} />

      {/* Greeting */}
      <Typography sx={{
        fontSize: { xs: '1.6rem', md: '2rem' },
        fontWeight: 600,
        color: '#E8E6F0',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        mb: 4,
      }}>
        What does your business need?
      </Typography>

      {/* Suggestions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, width: '100%', maxWidth: 340 }}>
        {suggestions.map((text) => (
          <Box
            key={text}
            onClick={() => onSuggestionClick?.(text)}
            sx={{
              px: 2.5,
              py: 1.5,
              borderRadius: 3,
              border: '1px solid #2A2840',
              color: '#B0ACCA',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: '#8B7EC8',
                color: '#E8E6F0',
                background: 'rgba(139, 126, 200, 0.06)',
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
