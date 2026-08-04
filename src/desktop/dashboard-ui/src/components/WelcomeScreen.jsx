import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CampaignIcon from '@mui/icons-material/Campaign';
import SearchIcon from '@mui/icons-material/Search';
import AceSpadeIcon from './AceSpadeIcon';
import { BRAND } from '../theme';

const quickStarts = [
  {
    id: 'leads',
    title: 'Find Leads',
    subtitle: 'Search and save prospects in any industry',
    icon: <TrendingUpIcon sx={{ fontSize: 22, color: BRAND.secondary }} />,
    prompt: 'Find me 20 leads for ',
    gradient: `linear-gradient(135deg, ${alpha(BRAND.secondary, 0.15)} 0%, ${alpha(BRAND.secondary, 0.05)} 100%)`,
    border: alpha(BRAND.secondary, 0.2),
  },
  {
    id: 'campaign',
    title: 'Email Campaign',
    subtitle: 'Draft and send outreach to your pipeline',
    icon: <CampaignIcon sx={{ fontSize: 22, color: BRAND.primaryLight }} />,
    prompt: 'Email my top leads about ',
    gradient: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.15)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
    border: alpha(BRAND.primary, 0.2),
  },
  {
    id: 'research',
    title: 'Research Competitors',
    subtitle: 'Deep web research with analysis',
    icon: <SearchIcon sx={{ fontSize: 22, color: BRAND.info }} />,
    prompt: 'Research my competitors in ',
    gradient: `linear-gradient(135deg, ${alpha(BRAND.info, 0.15)} 0%, ${alpha(BRAND.info, 0.05)} 100%)`,
    border: alpha(BRAND.info, 0.2),
  },
];

export default function WelcomeScreen({ businessName, industry, onSuggestionClick }) {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 3,
      pb: 12,
    }}>
      {/* ACE Title */}
      <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 5 } }}>
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          mb: 1.5,
        }}>
          <AceSpadeIcon sx={{
            fontSize: { xs: 36, md: 48 },
            color: BRAND.primary,
            filter: `drop-shadow(0 4px 20px ${alpha(BRAND.primary, 0.4)})`,
          }} />
        </Box>
        <Typography sx={{
          fontSize: { xs: '2.5rem', md: '3.5rem' },
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          background: `linear-gradient(135deg, ${BRAND.textPrimary} 0%, ${BRAND.primaryLight} 50%, ${BRAND.secondary} 100%)`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
        }}>
          ACE
        </Typography>
        <Typography sx={{
          fontSize: '1rem',
          color: BRAND.textMuted,
          fontWeight: 400,
          maxWidth: 400,
        }}>
          {businessName
            ? `Ready to grow ${businessName}`
            : 'Ask anything, or task an agent...'}
        </Typography>
      </Box>

      {/* Quick Start Cards */}
      <Box sx={{
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 700,
        px: { xs: 1, md: 0 },
      }}>
        {quickStarts.map((card) => (
          <Box
            key={card.id}
            onClick={() => onSuggestionClick?.(card.prompt + (industry || ''))}
            sx={{
              width: { xs: '100%', sm: 200 },
              p: 2,
              borderRadius: 2.5,
              background: card.gradient,
              border: `1px solid ${card.border}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 25px ${alpha(BRAND.bg, 0.5)}`,
                borderColor: alpha(card.border, 0.5),
              },
            }}
          >
            <Box sx={{ mb: 1.5 }}>{card.icon}</Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: BRAND.textPrimary, mb: 0.5 }}>
              {card.title}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted, lineHeight: 1.4 }}>
              {card.subtitle}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
