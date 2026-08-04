import { Box } from '@mui/material';
import { BRAND } from '../theme';

export default function TypingIndicator() {
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
