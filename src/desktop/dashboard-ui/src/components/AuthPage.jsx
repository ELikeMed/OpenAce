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

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
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
      onAuth(data.data);
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

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
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.85rem' }}>
            {error}
          </Alert>
        )}

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

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || !email || !password}
          sx={{
            py: 1.3,
            fontSize: '0.95rem',
            fontWeight: 700,
            borderRadius: 2.5,
            mb: 2,
          }}
        >
          {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : mode === 'login' ? 'Log In' : 'Create Account'}
        </Button>

        {/* Toggle login/signup */}
        <Typography sx={{ textAlign: 'center', fontSize: '0.85rem', color: BRAND.textMuted }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <Box
            component="span"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            sx={{
              color: BRAND.primaryLight,
              cursor: 'pointer',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </Box>
        </Typography>

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
