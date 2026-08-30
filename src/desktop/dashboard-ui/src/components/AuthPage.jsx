/**
 * AuthPage — Login/Signup for cloud mode.
 * Clean, branded, OpenAce-themed auth screen.
 */

import { useState } from 'react';
import {
  Box, TextField, Button, Typography, alpha, CircularProgress, Alert,
} from '@mui/material';
import AceSpadeIcon from './AceSpadeIcon';
import { BRAND } from '../theme';

const API = window.location.origin;

export default function AuthPage({ onAuth, onClose, notice }) {
  // 'magic' is the default — passwordless is the way in. Password login stays
  // available for anyone who already set one.
  const [mode, setMode] = useState('magic'); // 'magic' | 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(notice || '');
  const [linkSent, setLinkSent] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setLinkSent(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'magic') {
        const res = await fetch(`${API}/api/auth/magic-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Could not send the login link.');
        } else {
          setLinkSent(true);
        }
        setLoading(false);
        return;
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Store token and notify parent
      localStorage.setItem('ace_token', data.data.token);
      localStorage.setItem('ace_user', JSON.stringify(data.data.user));
      // Creating an account is worth celebrating; signing back in is not.
      onAuth({ ...data.data, isNewAccount: mode === 'signup' });
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const heading = linkSent
    ? 'Check your email'
    : mode === 'signup' ? 'Create your account' : 'Welcome back';

  const submitDisabled = loading || !email || (mode !== 'magic' && !password);

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(160deg, ${BRAND.bg} 0%, #08081A 50%, #0A0A20 100%)`,
      p: 2,
    }}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: 4,
          background: BRAND.bgCard,
          border: `1px solid ${BRAND.border}`,
        }}
      >
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <AceSpadeIcon sx={{
            fontSize: 40,
            color: BRAND.primary,
            filter: `drop-shadow(0 4px 15px ${alpha(BRAND.primary, 0.4)})`,
            mb: 1,
          }} />
          <Typography sx={{
            fontSize: '1.8rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            background: `linear-gradient(135deg, ${BRAND.textPrimary} 0%, ${BRAND.primaryLight} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            OpenAce
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: BRAND.textMuted, mt: 0.5 }}>
            {heading}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>
            {error}
          </Alert>
        )}

        {linkSent ? (
          <>
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>
              We sent a login link to <strong>{email}</strong>. It expires in 15 minutes
              and works once.
            </Alert>
            <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: BRAND.textMuted, mb: 2 }}>
              Didn't get it? Check spam, or{' '}
              <Box
                component="span"
                onClick={() => setLinkSent(false)}
                sx={{ color: BRAND.primaryLight, cursor: 'pointer', fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' } }}
              >
                try again
              </Box>
              .
            </Typography>
          </>
        ) : (
        <>
        {/* Name field (signup only) */}
        {mode === 'signup' && (
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
            autoComplete="name"
          />
        )}

        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          sx={{ mb: 2 }}
          autoComplete="email"
          autoFocus
        />

        {mode !== 'magic' && (
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            inputProps={{ minLength: 6 }}
          />
        )}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={submitDisabled}
          sx={{
            py: 1.3,
            fontSize: '0.95rem',
            fontWeight: 700,
            borderRadius: 2.5,
            mb: 2,
            mt: mode === 'magic' ? 1 : 0,
          }}
        >
          {loading
            ? <CircularProgress size={22} sx={{ color: '#fff' }} />
            : mode === 'magic' ? 'Email me a login link'
            : mode === 'login' ? 'Log In' : 'Create Account'}
        </Button>

        {mode === 'magic' && (
          <Typography sx={{ textAlign: 'center', fontSize: '0.78rem', color: BRAND.textMuted, mb: 1.5 }}>
            No password needed. We'll email you a link that signs you in.
          </Typography>
        )}

        {/* Mode switching */}
        <Typography sx={{ textAlign: 'center', fontSize: '0.85rem', color: BRAND.textMuted }}>
          {mode === 'magic' ? (
            <Box
              component="span"
              onClick={() => switchMode('login')}
              sx={{ color: BRAND.primaryLight, cursor: 'pointer', fontWeight: 600,
                '&:hover': { textDecoration: 'underline' } }}
            >
              Use a password instead
            </Box>
          ) : (
            <>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Box
                component="span"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                sx={{
                  color: BRAND.primaryLight,
                  cursor: 'pointer',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </Box>
              <Box sx={{ mt: 1 }}>
                <Box
                  component="span"
                  onClick={() => switchMode('magic')}
                  sx={{ color: BRAND.primaryLight, cursor: 'pointer', fontWeight: 600,
                    '&:hover': { textDecoration: 'underline' } }}
                >
                  Email me a login link instead
                </Box>
              </Box>
            </>
          )}
        </Typography>
        </>
        )}

        {/* Back to the app — signing in is optional, not a gate */}
        {onClose && (
          <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: BRAND.textMuted, mt: 2 }}>
            <Box
              component="span"
              onClick={onClose}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              ← Back to Ace
            </Box>
          </Typography>
        )}

        {/* Download option */}
        <Box sx={{
          mt: 3, pt: 2,
          borderTop: `1px solid ${BRAND.border}`,
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '0.75rem', color: BRAND.textMuted }}>
            Want to run locally instead?{' '}
            <Box
              component="a"
              href="https://github.com/ELikeMed/OpenAce"
              target="_blank"
              sx={{ color: BRAND.primaryLight, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Download OpenAce
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
