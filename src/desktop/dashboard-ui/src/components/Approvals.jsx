import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, Grid, alpha, Button, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Badge,
  LinearProgress
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import GppGoodIcon from '@mui/icons-material/GppGood';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { BRAND } from '../theme';

const RISK_COLORS = {
  1: BRAND.success,
  2: BRAND.info,
  3: BRAND.warning,
  4: BRAND.error,
};

const RISK_LABELS = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
};

function ApprovalCard({ item, onApprove, onReject }) {
  const color = RISK_COLORS[item.riskLevel] || BRAND.warning;
  
  return (
    <Paper sx={{
      p: 2.5,
      transition: 'all 0.3s ease',
      border: `1px solid ${alpha(color, 0.2)}`,
      background: `linear-gradient(135deg, ${alpha(color, 0.04)} 0%, ${alpha(BRAND.bgCard, 0.8)} 100%)`,
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: `0 6px 20px ${alpha(color, 0.15)}`,
        border: `1px solid ${alpha(color, 0.3)}`,
      },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Avatar sx={{
          width: 40, height: 40,
          background: alpha(color, 0.15),
          color: color,
        }}>
          {item.riskLevel >= 3 ? <WarningAmberIcon /> : <GppGoodIcon />}
        </Avatar>
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
              {item.title || item.actionType}
            </Typography>
            <Chip
              label={`Risk: ${RISK_LABELS[item.riskLevel] || 'Unknown'}`}
              size="small"
              sx={{
                height: 22, fontSize: '0.65rem', fontWeight: 600,
                background: alpha(color, 0.12),
                color: color,
                border: `1px solid ${alpha(color, 0.2)}`,
              }}
            />
          </Box>
          
          {item.description && (
            <Typography variant="body2" sx={{
              color: BRAND.textMuted, fontSize: '0.8rem', mb: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.description}
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Chip
              label={item.actionType}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem',
                background: alpha(BRAND.primary, 0.08),
                color: BRAND.primaryLight,
              }}
            />
            <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
              {new Date(item.createdAt).toLocaleString()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => onApprove(item.id)}
              sx={{
                fontSize: '0.8rem',
                background: `linear-gradient(135deg, ${BRAND.success}, ${BRAND.secondaryLight}) !important`,
                '&:hover': { boxShadow: `0 4px 15px ${alpha(BRAND.success, 0.4)}` },
              }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CancelOutlinedIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => onReject(item.id)}
              sx={{
                fontSize: '0.8rem',
                borderColor: alpha(BRAND.error, 0.3),
                color: BRAND.error,
                '&:hover': {
                  borderColor: BRAND.error,
                  background: alpha(BRAND.error, 0.08),
                },
              }}
            >
              Reject
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

function TrustInsights({ trustProfile, onResetTrust }) {
  const entries = Object.entries(trustProfile);
  if (entries.length === 0) return null;

  const getStatus = (entry) => {
    if (entry.approvals >= 5 && entry.approvalRate > 0.8) return { label: 'Auto-Approved', color: BRAND.success };
    if (entry.rejections >= 3 && entry.approvalRate < 0.3) return { label: 'Always Ask', color: BRAND.error };
    return { label: 'Learning', color: BRAND.info };
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Avatar sx={{
          width: 36, height: 36,
          background: alpha(BRAND.primaryLight, 0.12),
          color: BRAND.primaryLight,
        }}>
          <PsychologyIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            Trust Insights
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
            What Ace has learned about your preferences
          </Typography>
        </Box>
        <Chip label={`${entries.length} patterns`} size="small" sx={{
          ml: 'auto', height: 22, fontSize: '0.65rem',
          background: alpha(BRAND.primaryLight, 0.1),
          color: BRAND.primaryLight,
        }} />
      </Box>

      {entries.map(([actionType, entry]) => {
        const status = getStatus(entry);
        const total = entry.approvals + entry.rejections;
        const approvalPct = Math.round(entry.approvalRate * 100);

        return (
          <Box key={actionType} sx={{
            p: 2, mb: 1.5, borderRadius: 2,
            border: `1px solid ${alpha(status.color, 0.15)}`,
            background: alpha(status.color, 0.03),
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                  {actionType}
                </Typography>
                <Chip label={status.label} size="small" sx={{
                  height: 20, fontSize: '0.6rem', fontWeight: 600,
                  background: alpha(status.color, 0.12),
                  color: status.color,
                }} />
              </Box>
              <IconButton size="small" onClick={() => onResetTrust(actionType)}
                sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={approvalPct} sx={{
                  height: 6, borderRadius: 3,
                  backgroundColor: alpha(BRAND.error, 0.15),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: approvalPct > 70 ? BRAND.success : approvalPct > 40 ? BRAND.warning : BRAND.error,
                  },
                }} />
              </Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, minWidth: 40 }}>
                {approvalPct}%
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Typography variant="caption" sx={{ color: BRAND.success }}>
                {entry.approvals} approved
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.error }}>
                {entry.rejections} rejected
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                {total} total
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

function Approvals() {
  const [pending, setPending] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [history, setHistory] = useState([]);
  const [trustProfile, setTrustProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = async () => {
    try {
      const [pendingRes, historyRes, trustRes] = await Promise.allSettled([
        fetch('/api/approvals').then(r => r.json()),
        fetch('/api/approvals/history?limit=30').then(r => r.json()),
        fetch('/api/approvals/trust').then(r => r.json()),
      ]);

      if (pendingRes.status === 'fulfilled' && pendingRes.value.success) {
        setPending(pendingRes.value.data.pending || []);
        setCounts(pendingRes.value.data.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.success) {
        setHistory(historyRes.value.data || []);
      }
      if (trustRes.status === 'fulfilled' && trustRes.value.success) {
        setTrustProfile(trustRes.value.data || {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleResetTrust = async (actionType) => {
    try {
      await fetch(`/api/approvals/trust/${actionType}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    
    // Listen for SSE approval events
    const eventSource = new EventSource('/api/events/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type?.startsWith('approval:')) {
        fetchData(); // Refresh on any approval event
      }
    };
    
    const interval = setInterval(fetchData, 10000);
    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const handleApprove = async (id) => {
    try {
      await fetch(`/api/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'user' }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id) => {
    try {
      await fetch(`/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason, rejectedBy: 'user' }),
      });
      setRejectDialog(null);
      setRejectReason('');
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <Box sx={{ maxWidth: 1000 }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.warning, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.warning, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.warning}, ${BRAND.accent})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.warning, 0.3)}`,
          }}>
            <GppGoodIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Action Approvals
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              Review and approve actions before Ace executes them
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={`${counts.pending} Pending`}
              sx={{
                fontWeight: 600,
                background: counts.pending > 0 ? alpha(BRAND.warning, 0.12) : alpha(BRAND.textMuted, 0.08),
                color: counts.pending > 0 ? BRAND.warning : BRAND.textMuted,
                border: `1px solid ${counts.pending > 0 ? alpha(BRAND.warning, 0.2) : alpha(BRAND.textMuted, 0.15)}`,
              }}
            />
            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
              sx={{ color: BRAND.textSecondary }}
            >
              History
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pending', value: counts.pending, color: BRAND.warning },
          { label: 'Approved', value: counts.approved, color: BRAND.success },
          { label: 'Rejected', value: counts.rejected, color: BRAND.error },
        ].map(stat => (
          <Grid size={{ xs: 4 }} key={stat.label}>
            <Paper sx={{
              p: 2, textAlign: 'center',
              background: alpha(stat.color, 0.04),
              border: `1px solid ${alpha(stat.color, 0.12)}`,
            }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                {stat.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Trust Insights */}
      <TrustInsights trustProfile={trustProfile} onResetTrust={handleResetTrust} />

      {/* Pending Approvals */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3 }} />)}
        </Box>
      ) : pending.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pending.map(item => (
            <ApprovalCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={(id) => setRejectDialog(id)}
            />
          ))}
        </Box>
      ) : (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 48, color: BRAND.success, mb: 2 }} />
          <Typography variant="h6" sx={{ color: BRAND.textSecondary, mb: 1 }}>
            All Clear
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textMuted }}>
            No actions pending approval. Ace is operating within approved autonomy level.
          </Typography>
        </Paper>
      )}

      {/* History Section */}
      {showHistory && history.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 2 }}>
            Approval History
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {history.slice().reverse().map((item, i) => (
              <Paper key={item.id || i} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{
                  width: 32, height: 32,
                  background: item.status === 'approved'
                    ? alpha(BRAND.success, 0.15)
                    : alpha(BRAND.error, 0.15),
                  color: item.status === 'approved' ? BRAND.success : BRAND.error,
                }}>
                  {item.status === 'approved'
                    ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                    : <CancelOutlinedIcon sx={{ fontSize: 18 }} />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 500, color: BRAND.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title || item.actionType}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                    {item.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                    {item.rejectionReason ? ` — ${item.rejectionReason}` : ''}
                    {' · '}{new Date(item.resolvedAt).toLocaleString()}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Reject Action
          <IconButton size="small" onClick={() => setRejectDialog(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: BRAND.textSecondary }}>
            Optionally provide a reason for rejecting this action.
          </Typography>
          <TextField
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleReject(rejectDialog)}
            sx={{
              background: `linear-gradient(135deg, ${BRAND.error}, ${BRAND.accent}) !important`,
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Approvals;
