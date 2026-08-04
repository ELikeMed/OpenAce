import { Box, Typography, Avatar, CircularProgress, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AceSpadeIcon from './AceSpadeIcon';
import { BRAND } from '../theme';

export default function ActivityLog({ steps, complete }) {
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
