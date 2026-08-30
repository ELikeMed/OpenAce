import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';

/**
 * The moment someone becomes an Ace.
 *
 * The account used to activate silently — a console.log and nothing on screen — so the one
 * point where a visitor turns into a customer passed without acknowledgement. This is a
 * deliberate celebration: a mark reveal, gold confetti and a short summary of what they now
 * have, then out of the way.
 *
 * Drawn entirely in CSS and SVG. A cartoon character would date quickly and read as cheap
 * next to the rest of the interface, so the brand mark itself does the celebrating.
 */

const GOLD = '#C9A96E';
const GOLD_LIGHT = '#D4BA8A';
const CREAM = '#F0EDE8';

export default function AceWelcome({ profile, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const name = (profile?.name || '').trim().split(' ')[0];

  // Fixed at mount so a re-render does not reshuffle the confetti mid-flight.
  const confetti = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.4 + Math.random() * 1.8,
      size: 5 + Math.random() * 7,
      rotate: Math.random() * 360,
      colour: [GOLD, GOLD_LIGHT, CREAM, '#8B7340'][i % 4],
      round: i % 3 === 0,
    })),
    []
  );

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => onClose?.(), 260);
  };

  // Long enough to read, short enough not to trap anyone.
  useEffect(() => {
    const t = setTimeout(dismiss, 9000);
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <Box
      onClick={dismiss}
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'grid', placeItems: 'center',
        px: 3,
        background: 'rgba(6,6,6,0.82)',
        backdropFilter: 'blur(10px)',
        animation: leaving ? 'aceFadeOut .25s ease forwards' : 'aceFadeIn .3s ease',
        '@keyframes aceFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        '@keyframes aceFadeOut': { from: { opacity: 1 }, to: { opacity: 0 } },
      }}
    >
      {/* Confetti sits behind the card and is ignored by pointer and screen reader alike. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {confetti.map(c => (
          <Box key={c.id} sx={{
            position: 'absolute',
            top: '-8%',
            left: `${c.left}%`,
            width: c.size,
            height: c.round ? c.size : c.size * 0.42,
            background: c.colour,
            borderRadius: c.round ? '50%' : '1px',
            opacity: 0,
            animation: `aceFall ${c.duration}s ${c.delay}s ease-in forwards`,
            '@keyframes aceFall': {
              '0%':   { transform: `translateY(0) rotate(${c.rotate}deg)`, opacity: 0 },
              '12%':  { opacity: 0.95 },
              '100%': { transform: `translateY(105vh) rotate(${c.rotate + 540}deg)`, opacity: 0 },
            },
            '@media (prefers-reduced-motion: reduce)': { display: 'none' },
          }} />
        ))}
      </Box>

      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          width: '100%', maxWidth: 420,
          textAlign: 'center',
          borderRadius: 4,
          border: '1px solid rgba(201,169,110,0.28)',
          background: 'linear-gradient(180deg, #141210 0%, #0C0B0A 100%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset',
          px: { xs: 3, sm: 4.5 }, py: { xs: 4, sm: 5 },
          animation: leaving ? 'aceCardOut .25s ease forwards' : 'aceCardIn .5s cubic-bezier(.16,1.1,.3,1)',
          '@keyframes aceCardIn': {
            from: { opacity: 0, transform: 'translateY(18px) scale(.94)' },
            to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
          },
          '@keyframes aceCardOut': {
            from: { opacity: 1, transform: 'scale(1)' },
            to:   { opacity: 0, transform: 'scale(.97)' },
          },
        }}
      >
        {/* Ace himself, clapping. Drawn in SVG from the brand mark so there is no asset to
            ship or keep in sync — the spade is the body, with a face, arms and a bounce. */}
        <Box sx={{
          width: 190, height: 190, mx: 'auto', mb: 1,
          '& .ace-body':  { animation: 'aceBob .95s ease-in-out infinite', transformOrigin: '100px 160px' },
          '& .ace-armL':  { animation: 'aceClapL .46s ease-in-out infinite', transformOrigin: '52px 112px' },
          '& .ace-armR':  { animation: 'aceClapR .46s ease-in-out infinite', transformOrigin: '148px 112px' },
          '& .ace-eyes':  { animation: 'aceBlink 3.4s infinite', transformOrigin: '100px 100px' },
          '@keyframes aceBob': {
            '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
            '25%':     { transform: 'translateY(-9px) rotate(-2deg)' },
            '75%':     { transform: 'translateY(-9px) rotate(2deg)' },
          },
          '@keyframes aceClapL': { '0%,100%': { transform: 'rotate(-26deg)' }, '50%': { transform: 'rotate(28deg)' } },
          '@keyframes aceClapR': { '0%,100%': { transform: 'rotate(26deg)' },  '50%': { transform: 'rotate(-28deg)' } },
          '@keyframes aceBlink': { '0%,93%,100%': { transform: 'scaleY(1)' }, '96%': { transform: 'scaleY(.08)' } },
          '@media (prefers-reduced-motion: reduce)': {
            '& .ace-body, & .ace-armL, & .ace-armR, & .ace-eyes': { animation: 'none' },
          },
        }}>
          <svg viewBox="0 0 200 200" width="190" height="190" role="img" aria-label="Ace celebrating">
            <defs>
              <radialGradient id="aceGlow" cx="50%" cy="50%">
                <stop offset="0%" stopColor={GOLD} stopOpacity=".28" />
                <stop offset="72%" stopColor={GOLD} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="aceBodyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EBD7AC" />
                <stop offset="100%" stopColor={GOLD} />
              </linearGradient>
              <linearGradient id="aceSuit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2B2E36" />
                <stop offset="100%" stopColor="#1A1C21" />
              </linearGradient>
              {/* The jacket is clipped to the spade so it follows his silhouette exactly. */}
              <clipPath id="aceBodyClip">
                <path transform="translate(16,10) scale(7)" d="M12 2L11.3 2.9C10.2 4.4 5 11 4.2 13.5C3.6 15.3 4.1 16.8 5 17.8C5.9 18.8 7.3 19.2 8.6 18.7C9.6 18.3 10.4 17.4 10.9 16.3C10.5 18 9.8 19.5 8.5 21H15.5C14.2 19.5 13.5 18 13.1 16.3C13.6 17.4 14.4 18.3 15.4 18.7C16.7 19.2 18.1 18.8 19 17.8C19.9 16.8 20.4 15.3 19.8 13.5C19 11 13.8 4.4 12.7 2.9L12 2Z" />
              </clipPath>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#aceGlow)" />

            {/* Sleeve, then a white cuff, then the hand. Dark fabric alone vanished against
                a dark backdrop — the cuff is what makes the arm read. */}
            <g className="ace-armL">
              <rect x="38" y="105" width="24" height="16" rx="8" fill="url(#aceSuit)" />
              <rect x="34" y="104" width="8" height="18" rx="3" fill="#F0EDE8" />
              <rect x="24" y="106" width="14" height="14" rx="7" fill="url(#aceBodyFill)" />
              <circle cx="26" cy="113" r="13" fill="url(#aceBodyFill)" />
            </g>
            <g className="ace-armR">
              <rect x="138" y="105" width="24" height="16" rx="8" fill="url(#aceSuit)" />
              <rect x="158" y="104" width="8" height="18" rx="3" fill="#F0EDE8" />
              <rect x="162" y="106" width="14" height="14" rx="7" fill="url(#aceBodyFill)" />
              <circle cx="174" cy="113" r="13" fill="url(#aceBodyFill)" />
            </g>

            <g className="ace-body">
              <g transform="translate(16,10) scale(7)">
                <path fill="url(#aceBodyFill)" d="M12 2L11.3 2.9C10.2 4.4 5 11 4.2 13.5C3.6 15.3 4.1 16.8 5 17.8C5.9 18.8 7.3 19.2 8.6 18.7C9.6 18.3 10.4 17.4 10.9 16.3C10.5 18 9.8 19.5 8.5 21H15.5C14.2 19.5 13.5 18 13.1 16.3C13.6 17.4 14.4 18.3 15.4 18.7C16.7 19.2 18.1 18.8 19 17.8C19.9 16.8 20.4 15.3 19.8 13.5C19 11 13.8 4.4 12.7 2.9L12 2Z" />
              </g>

              <g clipPath="url(#aceBodyClip)">
                <path d="M44 128 L100 128 L100 172 L38 172 Z" fill="url(#aceSuit)" />
                <path d="M156 128 L100 128 L100 172 L162 172 Z" fill="url(#aceSuit)" />
                <path d="M80 126 L100 147 L120 126 L120 172 L80 172 Z" fill="#F0EDE8" />
                <path d="M80 126 L100 147 L93 126 Z" fill="url(#aceSuit)" opacity=".9" />
                <path d="M120 126 L100 147 L107 126 Z" fill="url(#aceSuit)" opacity=".9" />
                <path d="M96 144 L104 144 L107 152 L100 157 L93 152 Z" fill="#8E2F2A" />
                <path d="M93 152 L107 152 L104 172 L100 176 L96 172 Z" fill="#A83A33" />
              </g>

              <ellipse cx="70" cy="118" rx="8" ry="5" fill="#C0392B" opacity=".2" />
              <ellipse cx="130" cy="118" rx="8" ry="5" fill="#C0392B" opacity=".2" />
              <g className="ace-eyes">
                <ellipse cx="84" cy="100" rx="9.5" ry="11" fill="#14120F" />
                <circle cx="87" cy="96" r="3.2" fill="#fff" />
                <ellipse cx="116" cy="100" rx="9.5" ry="11" fill="#14120F" />
                <circle cx="119" cy="96" r="3.2" fill="#fff" />
              </g>
              <path d="M84 118 Q100 132 116 118" stroke="#14120F" strokeWidth="5" fill="none" strokeLinecap="round" />
            </g>
          </svg>
        </Box>

        <Typography sx={{
          fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: GOLD, fontWeight: 700, mb: 1.2,
        }}>
          You&rsquo;re in
        </Typography>

        <Typography sx={{
          fontSize: { xs: '1.75rem', sm: '2rem' }, lineHeight: 1.15, fontWeight: 300,
          color: CREAM, letterSpacing: '-0.02em', mb: 1.2,
        }}>
          {name ? <>Welcome, {name} —<br />you&rsquo;re an Ace</> : <>Welcome — you&rsquo;re an Ace</>}
        </Typography>

        <Typography sx={{ fontSize: '0.92rem', color: '#A09A90', mb: 3, lineHeight: 1.6 }}>
          Your account is live and everything from this conversation is saved. Nothing to set up.
        </Typography>

        <Box sx={{ display: 'grid', gap: 1, mb: 3.2, textAlign: 'left' }}>
          {[
            'Your leads and pipeline, kept between visits',
            'Sites, documents and procedures you can share',
            'Ace picks up exactly where you left off',
          ].map((line) => (
            <Box key={line} sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
              <Box aria-hidden sx={{
                mt: '7px', flex: '0 0 5px', width: 5, height: 5,
                borderRadius: '50%', background: GOLD,
              }} />
              <Typography sx={{ fontSize: '0.86rem', color: '#B8B2A8', lineHeight: 1.5 }}>
                {line}
              </Typography>
            </Box>
          ))}
        </Box>

        <Button
          onClick={dismiss}
          fullWidth
          sx={{
            background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
            color: '#0A0A0A', fontWeight: 700, fontSize: '0.95rem',
            borderRadius: 2.5, py: 1.3, textTransform: 'none',
            '&:hover': { background: GOLD },
          }}
        >
          Keep going
        </Button>
      </Box>
    </Box>
  );
}
