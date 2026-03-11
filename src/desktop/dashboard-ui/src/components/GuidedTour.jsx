import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, alpha, Button, IconButton, Avatar, Popover, Divider,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import AceSpadeIcon from './AceSpadeIcon';
import { BRAND } from '../theme';

const TOUR_STEPS = [
  {
    tabId: 'chat',
    title: 'This Is Home Base',
    body: "This is where we talk. Ask me anything — research a company, send an email, schedule a post. I work from here.",
  },
  {
    tabId: 'pipeline',
    title: 'Your Deal Pipeline',
    body: "Every lead lives here. I track them from first contact to closed deal. You can move them between stages, and I'll suggest follow-ups.",
  },
  {
    tabId: 'contacts',
    title: 'Your Contact Book',
    body: "Everyone you've worked with or want to reach. I pull contacts from emails, forms, and research so nothing slips through.",
  },
  {
    tabId: 'automation',
    title: 'Routines That Run Daily',
    body: "Set it and forget it. Morning research, afternoon follow-ups, weekly reports — I run these on schedule so you don't have to.",
  },
  {
    tabId: 'sops',
    title: 'Step-by-Step Processes',
    body: "Teach me how you do things and I'll repeat them exactly. Record a process once, I'll run it every time.",
  },
  {
    tabId: 'forms',
    title: 'Forms & Surveys',
    body: "Build forms for leads, signups, or surveys. Responses land here and I can auto-add them to your pipeline.",
  },
  {
    tabId: 'studio',
    title: 'Code Studio',
    body: "Need a landing page or web app? I build it here. You can preview, edit, and deploy — all without leaving Ace.",
  },
  {
    tabId: 'workload',
    title: 'Media & Files',
    body: "Upload your brand photos, documents, templates — anything I should know about. I use these when posting, emailing, and researching.",
  },
  {
    tabId: 'organization',
    title: 'Your Team',
    body: "Manage your business profile and team members. This is how I know who you are and what your business does.",
  },
  {
    tabId: 'integrations',
    title: 'Connected Services',
    body: "Email, calendar, social media, Telegram — connect your accounts so I can work across all your tools.",
  },
  {
    tabId: 'settings',
    title: 'Settings & Preferences',
    body: "Fine-tune how I work. Choose your AI model, manage tools, set up billing, and customize my behavior.",
  },
];

const HELP_TIPS = {
  chat: "Type anything to get started. Try: 'Research companies in [your industry]' or 'What's on my calendar today?'",
  pipeline: "Click any lead to see details. Move leads between stages, or ask Ace to follow up with someone.",
  contacts: "Contacts are pulled from emails, forms, and research. Click a contact to see their full history.",
  automation: "Create a routine with a name and schedule. Ace runs it automatically — morning research, follow-ups, reports.",
  sops: "Record a process step-by-step. Ace replays it exactly when triggered by keywords or routines.",
  forms: "Create forms for lead capture, surveys, or quizzes. Share the link — responses show up here.",
  studio: "Ask Ace to build something in chat, or create a project here. Preview and deploy when ready.",
  workload: "Drag and drop files or connect a project folder. Ace references everything here when working.",
  organization: "Set your business name, industry, and details. This helps Ace write better emails and research.",
  integrations: "Connect Gmail, Google Calendar, and social accounts. The more Ace is connected, the more it can do.",
  settings: "Choose your AI provider, enable/disable tools, set up billing, and manage API keys.",
};

export default function GuidedTour({ active, onClose, onNavigate, currentPage, helpOpen, onHelpToggle }) {
  const [step, setStep] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const helpBtnRef = useRef(null);

  // When tour starts, reset to step 0 and navigate to chat
  useEffect(() => {
    if (active) {
      setStep(0);
      onNavigate('chat');
    }
  }, [active]);

  // On step change, navigate to the right tab and find the sidebar element
  useEffect(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    if (!currentStep) return;

    onNavigate(currentStep.tabId);

    // Small delay to let React re-render the selected state
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-tour-tab="${currentStep.tabId}"]`);
      if (el) {
        // Scroll the sidebar nav item into view so it's visible
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Wait for scroll to settle before measuring position
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setSpotRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        }, 150);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [active, step]);

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      // Tour complete
      localStorage.setItem('ace_tour_completed', 'true');
      onClose();
    }
  }, [step, onClose]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const isLastStep = step === TOUR_STEPS.length - 1;
  const currentStepData = TOUR_STEPS[step];

  // Card position: to the right of the spotlight, vertically centered
  const cardLeft = spotRect ? spotRect.left + spotRect.width + 24 : 320;
  const cardTop = spotRect ? spotRect.top - 20 : 200;

  return (
    <>
      {/* ─── Help Button (always visible) ─── */}
      <IconButton
        ref={helpBtnRef}
        onClick={onHelpToggle}
        size="small"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1100,
          width: 44,
          height: 44,
          background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`,
          color: '#fff',
          boxShadow: `0 4px 20px ${alpha(BRAND.primary, 0.5)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${BRAND.primaryDark}, ${BRAND.primary})`,
            boxShadow: `0 6px 24px ${alpha(BRAND.primary, 0.6)}`,
          },
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 22 }} />
      </IconButton>

      {/* ─── Help Popover ─── */}
      <Popover
        open={helpOpen && !active}
        anchorEl={helpBtnRef.current}
        onClose={onHelpToggle}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              background: BRAND.bgCard,
              border: `1px solid ${BRAND.border}`,
              borderRadius: '14px',
              width: 320,
              p: 0,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Avatar sx={{
              width: 28, height: 28,
              background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
            }}>
              <AceSpadeIcon sx={{ fontSize: 15 }} />
            </Avatar>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Ace's Tips
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.82rem', color: BRAND.textSecondary, lineHeight: 1.6 }}>
            {HELP_TIPS[currentPage] || HELP_TIPS.chat}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: BRAND.border }} />

        <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              onHelpToggle();
              // Dispatch tour start event so App picks it up
              window.dispatchEvent(new CustomEvent('ace:start-tour'));
            }}
            sx={{
              flex: 1,
              fontSize: '0.75rem',
              color: BRAND.primaryLight,
              textTransform: 'none',
              '&:hover': { background: alpha(BRAND.primary, 0.1) },
            }}
          >
            {localStorage.getItem('ace_tour_completed') ? 'Restart Tour' : 'Take a Tour'}
          </Button>
          <Button
            size="small"
            startIcon={<ChatIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              onHelpToggle();
              onNavigate('chat');
            }}
            sx={{
              flex: 1,
              fontSize: '0.75rem',
              color: BRAND.secondary,
              textTransform: 'none',
              '&:hover': { background: alpha(BRAND.secondary, 0.1) },
            }}
          >
            Ask Ace
          </Button>
        </Box>
      </Popover>

      {/* ─── Tour Overlay (only when active) ─── */}
      {active && (
        <>
          {/* Dark backdrop with cutout */}
          <Box
            onClick={handleSkip}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              cursor: 'pointer',
            }}
          >
            {/* Full dark overlay via SVG with cutout */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <mask id="tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {spotRect && (
                    <rect
                      x={spotRect.left - 6}
                      y={spotRect.top - 4}
                      width={spotRect.width + 12}
                      height={spotRect.height + 8}
                      rx="12"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.75)"
                mask="url(#tour-mask)"
              />
            </svg>

            {/* Spotlight ring around target */}
            {spotRect && (
              <Box sx={{
                position: 'absolute',
                top: spotRect.top - 6,
                left: spotRect.left - 8,
                width: spotRect.width + 16,
                height: spotRect.height + 12,
                borderRadius: '14px',
                border: `2px solid ${alpha(BRAND.primary, 0.6)}`,
                boxShadow: `0 0 20px ${alpha(BRAND.primary, 0.3)}, inset 0 0 20px ${alpha(BRAND.primary, 0.05)}`,
                pointerEvents: 'none',
                zIndex: 1201,
              }} />
            )}
          </Box>

          {/* Tour Card */}
          <Paper
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'fixed',
              top: Math.max(80, Math.min(cardTop, window.innerHeight - 340)),
              left: cardLeft,
              zIndex: 1202,
              width: 380,
              borderRadius: '16px',
              border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
              background: `linear-gradient(145deg, ${BRAND.bgCard} 0%, ${alpha(BRAND.bgSurface, 0.95)} 100%)`,
              backdropFilter: 'blur(20px)',
              boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${alpha(BRAND.primary, 0.15)}`,
              overflow: 'hidden',
              animation: 'tourCardIn 0.3s ease',
              '@keyframes tourCardIn': {
                from: { opacity: 0, transform: 'translateX(-12px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
              },
            }}
          >
            {/* Header */}
            <Box sx={{
              p: 2.5, pb: 2,
              display: 'flex', alignItems: 'center', gap: 1.5,
              borderBottom: `1px solid ${alpha(BRAND.border, 0.5)}`,
            }}>
              <Avatar sx={{
                width: 36, height: 36,
                background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                boxShadow: `0 4px 12px ${alpha(BRAND.primary, 0.4)}`,
              }}>
                <AceSpadeIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: BRAND.textPrimary }}>
                  {currentStepData?.title}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: BRAND.textMuted }}>
                  Step {step + 1} of {TOUR_STEPS.length}
                </Typography>
              </Box>
              <IconButton size="small" onClick={handleSkip} sx={{ color: BRAND.textMuted }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Body */}
            <Box sx={{ p: 2.5, pt: 2 }}>
              <Typography sx={{
                fontSize: '0.88rem',
                color: BRAND.textSecondary,
                lineHeight: 1.7,
                mb: 2.5,
              }}>
                {currentStepData?.body}
              </Typography>

              {/* Step dots */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.6, mb: 2 }}>
                {TOUR_STEPS.map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: i === step ? 20 : 7,
                      height: 7,
                      borderRadius: 4,
                      background: i === step
                        ? `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`
                        : i < step
                          ? alpha(BRAND.primary, 0.4)
                          : alpha(BRAND.textMuted, 0.2),
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </Box>

              {/* Navigation buttons */}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  onClick={handleSkip}
                  sx={{
                    fontSize: '0.78rem', color: BRAND.textMuted, textTransform: 'none',
                    '&:hover': { color: BRAND.textSecondary, background: alpha(BRAND.textMuted, 0.08) },
                  }}
                >
                  Skip
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {step > 0 && (
                    <Button
                      size="small"
                      startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
                      onClick={handleBack}
                      sx={{
                        fontSize: '0.78rem', color: BRAND.textSecondary, textTransform: 'none',
                        '&:hover': { background: alpha(BRAND.primary, 0.08) },
                      }}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={!isLastStep ? <ArrowForwardIcon sx={{ fontSize: 14 }} /> : null}
                    onClick={handleNext}
                    sx={{
                      fontSize: '0.78rem', textTransform: 'none',
                      px: 2.5,
                      background: isLastStep
                        ? `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.success})`
                        : undefined,
                    }}
                  >
                    {isLastStep ? "Let's Go!" : 'Next'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </>
  );
}
