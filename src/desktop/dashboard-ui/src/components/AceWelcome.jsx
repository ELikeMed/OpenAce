import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AceSpadeIcon from './AceSpadeIcon';

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
        {/* The mark: a soft gold bloom behind it, then the spade settling into place. */}
        <Box sx={{ position: 'relative', display: 'inline-grid', placeItems: 'center', mb: 2.2 }}>
          <Box aria-hidden sx={{
            position: 'absolute', width: 130, height: 130, borderRadius: '50%',
            background: `radial-gradient(circle, ${GOLD}33 0%, transparent 68%)`,
            animation: 'aceBloom 2.6s ease-in-out infinite',
            '@keyframes aceBloom': {
              '0%,100%': { transform: 'scale(1)', opacity: 0.75 },
              '50%':     { transform: 'scale(1.16)', opacity: 1 },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }} />
          <AceSpadeIcon sx={{
            position: 'relative',
            fontSize: 62,
            color: GOLD,
            filter: `drop-shadow(0 6px 18px ${GOLD}55)`,
            animation: 'aceMark .75s cubic-bezier(.2,1.4,.4,1) both',
            '@keyframes aceMark': {
              '0%':   { transform: 'scale(.3) rotate(-24deg)', opacity: 0 },
              '60%':  { transform: 'scale(1.14) rotate(6deg)', opacity: 1 },
              '100%': { transform: 'scale(1) rotate(0)', opacity: 1 },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }} />
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
