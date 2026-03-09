import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, alpha, Skeleton, Tabs, Tab, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  InputAdornment, MenuItem, Select, FormControl, InputLabel, Tooltip, Drawer,
  CircularProgress, Divider
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LanguageIcon from '@mui/icons-material/Language';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { BRAND } from '../theme';

const STAGE_COLORS = {
  inbox: BRAND.textMuted,
  todo: BRAND.textMuted,
  backlog: BRAND.textMuted,
  research: BRAND.info,
  in_progress: BRAND.warning,
  'in-progress': BRAND.warning,
  review: BRAND.info,
  done: BRAND.success,
  completed: BRAND.success,
  new: BRAND.primaryLight,
  contacted: BRAND.info,
  qualified: BRAND.secondary,
  proposal: BRAND.warning,
  negotiation: BRAND.accent,
  won: BRAND.success,
  lost: BRAND.error,
};

// ═══════════════════════════════════════════════════════
// FORM ANSWER RENDERER
// ═══════════════════════════════════════════════════════

function renderFormAnswer(step, answer) {
  if (!answer && answer !== 0) return null;
  if (step.type === 'single_select') {
    const option = step.options?.find(o => o.value === answer);
    return option ? `${option.emoji || ''} ${option.label}`.trim() : String(answer);
  }
  if (step.type === 'multi_select') {
    const values = Array.isArray(answer) ? answer : [answer];
    return values.map(v => {
      const option = step.options?.find(o => o.value === v);
      return option ? `${option.emoji || ''} ${option.label}`.trim() : v;
    }).join(', ');
  }
  if (step.type === 'rating') return `${answer} / ${step.max || 5}`;
  return String(answer);
}

// ═══════════════════════════════════════════════════════
// LEAD DETAIL DRAWER
// ═══════════════════════════════════════════════════════

function LeadDetailDrawer({ leadId, open, onClose, leadStages, onLeadUpdated }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pipeline/leads/${leadId}`);
      const data = await res.json();
      if (data.success) setLead(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    if (open && leadId) {
      fetchLead();
      setEditing(false);
      setNewNote('');
      setNewTag('');
      setAddingTag(false);
    }
  }, [open, leadId, fetchLead]);

  const handleEdit = () => {
    setEditForm({
      company: lead.company || '',
      contact_name: lead.contact_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      website: lead.website || '',
      value: lead.value || 0,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/pipeline/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      await fetchLead();
      onLeadUpdated?.();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleStageChange = async (newStage) => {
    try {
      await fetch(`/api/pipeline/leads/${leadId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      setLead(prev => ({ ...prev, stage: newStage }));
      onLeadUpdated?.();
    } catch (e) { console.error(e); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await fetch(`/api/pipeline/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim(), author: 'user' }),
      });
      setNewNote('');
      await fetchLead();
      onLeadUpdated?.();
    } catch (e) { console.error(e); }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !lead) return;
    const tags = [...(lead.tags || []), newTag.trim()];
    try {
      await fetch(`/api/pipeline/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      setNewTag('');
      setAddingTag(false);
      await fetchLead();
      onLeadUpdated?.();
    } catch (e) { console.error(e); }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!lead) return;
    const tags = (lead.tags || []).filter(t => t !== tagToRemove);
    try {
      await fetch(`/api/pipeline/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      await fetchLead();
      onLeadUpdated?.();
    } catch (e) { console.error(e); }
  };

  const initials = (lead?.company || '?').slice(0, 2).toUpperCase();
  const formData = lead?.formData;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 480 },
          background: BRAND.bgCard,
          borderLeft: `1px solid ${BRAND.border}`,
          p: 0,
        },
      }}
    >
      {loading || !lead ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <CircularProgress sx={{ color: BRAND.primary }} />
        </Box>
      ) : (
        <Box sx={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ p: 2.5, display: 'flex', alignItems: 'flex-start', gap: 2, borderBottom: `1px solid ${BRAND.border}` }}>
            <Avatar sx={{
              width: 48, height: 48, fontSize: '1rem', fontWeight: 700,
              background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
            }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <TextField
                  size="small" fullWidth value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  sx={{ mb: 0.5, '& .MuiOutlinedInput-root': { fontSize: '1.1rem', fontWeight: 700 } }}
                />
              ) : (
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {lead.company || 'Unknown'}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                {lead.contact_name && `${lead.contact_name} · `}Added {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {editing ? (
                <>
                  <Tooltip title="Save">
                    <IconButton size="small" onClick={handleSave} disabled={saving} sx={{ color: BRAND.success }}>
                      {saving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: BRAND.textMuted }}>
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={handleEdit} sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.primary } }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Close">
                <IconButton size="small" onClick={onClose} sx={{ color: BRAND.textMuted }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Contact Info */}
            <Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                Contact Info
              </Typography>
              <Paper sx={{ p: 2, background: alpha(BRAND.bgSurface, 0.5) }}>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField size="small" label="Contact Name" fullWidth value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} />
                    <TextField size="small" label="Email" fullWidth value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <TextField size="small" label="Phone" fullWidth value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    <TextField size="small" label="Website" fullWidth value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                    <TextField size="small" label="Value ($)" fullWidth type="number" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: parseFloat(e.target.value) || 0 })} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { icon: <PersonIcon sx={{ fontSize: 16 }} />, label: 'Contact', value: lead.contact_name },
                      { icon: <EmailIcon sx={{ fontSize: 16 }} />, label: 'Email', value: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
                      { icon: <PhoneIcon sx={{ fontSize: 16 }} />, label: 'Phone', value: lead.phone },
                      { icon: <LanguageIcon sx={{ fontSize: 16 }} />, label: 'Website', value: lead.website, href: lead.website, external: true },
                      { icon: <AttachMoneyIcon sx={{ fontSize: 16 }} />, label: 'Value', value: lead.value ? `$${lead.value.toLocaleString()}` : null },
                    ].map(({ icon, label, value, href, external }) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 28 }}>
                        <Box sx={{ color: BRAND.textMuted, width: 20, display: 'flex', justifyContent: 'center' }}>{icon}</Box>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted, width: 60, flexShrink: 0 }}>{label}</Typography>
                        {value ? (
                          href ? (
                            <Box component="a" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}
                              sx={{ color: BRAND.info, textDecoration: 'none', fontSize: '0.85rem', '&:hover': { textDecoration: 'underline' } }}>
                              {external ? (() => { try { return new URL(value).hostname.replace('www.', ''); } catch { return value; } })() : value}
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{value}</Typography>
                          )
                        ) : (
                          <Typography variant="body2" sx={{ color: BRAND.textMuted, fontStyle: 'italic', fontSize: '0.85rem' }}>--</Typography>
                        )}
                      </Box>
                    ))}
                    {lead.source && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 28 }}>
                        <Box sx={{ color: BRAND.textMuted, width: 20, display: 'flex', justifyContent: 'center' }}>
                          <SearchIcon sx={{ fontSize: 16 }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: BRAND.textMuted, width: 60, flexShrink: 0 }}>Source</Typography>
                        <Chip label={lead.source} size="small" sx={{ height: 22, fontSize: '0.7rem', background: alpha(BRAND.primaryLight, 0.1), color: BRAND.textSecondary }} />
                      </Box>
                    )}
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Stage */}
            <Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                Stage
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(leadStages || []).map(s => {
                  const color = STAGE_COLORS[s.id] || BRAND.textMuted;
                  const isActive = lead.stage === s.id;
                  return (
                    <Chip
                      key={s.id}
                      label={s.name || s.id}
                      size="small"
                      onClick={() => !isActive && handleStageChange(s.id)}
                      sx={{
                        height: 26, fontSize: '0.72rem', fontWeight: 600, cursor: isActive ? 'default' : 'pointer',
                        background: isActive ? alpha(color, 0.25) : alpha(color, 0.06),
                        color: color,
                        border: isActive ? `1.5px solid ${alpha(color, 0.5)}` : `1px solid transparent`,
                        '&:hover': !isActive ? { background: alpha(color, 0.15) } : {},
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Form Response */}
            {formData && (
              <Box>
                <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                  Form Response
                </Typography>
                <Paper sx={{ p: 2, background: alpha(BRAND.bgSurface, 0.5) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <AssignmentIcon sx={{ fontSize: 18, color: BRAND.primary }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                      {formData.form_name}
                    </Typography>
                    <Chip label={formData.form_type} size="small" sx={{ height: 20, fontSize: '0.65rem', ml: 'auto', background: alpha(BRAND.secondary, 0.1), color: BRAND.secondary }} />
                  </Box>
                  {formData.submission?.outcome && (
                    <Chip
                      label={`Outcome: ${formData.submission.outcome}`}
                      size="small"
                      sx={{ mb: 1.5, height: 24, fontSize: '0.72rem', fontWeight: 600, background: alpha(BRAND.success, 0.12), color: BRAND.success }}
                    />
                  )}
                  {formData.steps && formData.submission?.answers && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {formData.steps.map(step => {
                        const answer = formData.submission.answers[step.id];
                        if (!answer && answer !== 0) return null;
                        const rendered = renderFormAnswer(step, answer);
                        return (
                          <Box key={step.id}>
                            <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, display: 'block', mb: 0.3 }}>
                              Q: {step.title}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: BRAND.textPrimary, fontSize: '0.85rem', pl: 1.5,
                              borderLeft: `2px solid ${alpha(BRAND.primary, 0.3)}`,
                              ...(step.type === 'textarea' || step.type === 'text_input' ? { fontStyle: 'italic' } : {}),
                            }}>
                              {step.type === 'textarea' || step.type === 'text_input' ? `"${rendered}"` : rendered}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                  {!formData.submission && (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>
                      Form response data not found (legacy lead).
                    </Typography>
                  )}
                </Paper>
              </Box>
            )}

            {/* Tags */}
            <Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                <LocalOfferIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'middle' }} />Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                {(lead.tags || []).map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                    sx={{ height: 24, fontSize: '0.72rem', background: alpha(BRAND.primaryLight, 0.1), color: BRAND.textSecondary }}
                  />
                ))}
                {addingTag ? (
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <TextField
                      size="small" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Tag name"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setAddingTag(false); }}
                      autoFocus
                      sx={{ width: 120, '& .MuiOutlinedInput-root': { height: 28, fontSize: '0.75rem' } }}
                    />
                    <IconButton size="small" onClick={handleAddTag} sx={{ p: 0.3, color: BRAND.success }}><SaveIcon sx={{ fontSize: 14 }} /></IconButton>
                    <IconButton size="small" onClick={() => setAddingTag(false)} sx={{ p: 0.3, color: BRAND.textMuted }}><CancelIcon sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                ) : (
                  <Chip
                    label="+ Add"
                    size="small"
                    onClick={() => setAddingTag(true)}
                    sx={{ height: 24, fontSize: '0.72rem', cursor: 'pointer', background: alpha(BRAND.border, 0.3), color: BRAND.textMuted, '&:hover': { background: alpha(BRAND.primary, 0.1) } }}
                  />
                )}
              </Box>
            </Box>

            {/* Notes */}
            <Box>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                <NoteAddIcon sx={{ fontSize: 13, mr: 0.5, verticalAlign: 'middle' }} />Notes
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <TextField
                  size="small" fullWidth value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  multiline maxRows={3}
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                />
                <Button
                  size="small" variant="contained" onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  sx={{ minWidth: 60, height: 40, alignSelf: 'flex-end' }}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[...(lead.notes || [])].reverse().map((note, i) => (
                  <Box key={i} sx={{
                    p: 1.5, borderRadius: 1.5,
                    background: alpha(BRAND.border, 0.15),
                    border: `1px solid ${alpha(BRAND.border, 0.3)}`,
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem', color: BRAND.textSecondary, whiteSpace: 'pre-wrap' }}>
                      {note}
                    </Typography>
                  </Box>
                ))}
                {(!lead.notes || lead.notes.length === 0) && (
                  <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>
                    No notes yet.
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

// ═══════════════════════════════════════════════════════
// TASK KANBAN COLUMN (unchanged for tasks)
// ═══════════════════════════════════════════════════════

function KanbanColumn({ stage, items, onMove, onDelete, allStages }) {
  const stageId = stage.id || stage;
  const stageName = stage.name || String(stageId).replace(/[-_]/g, ' ');
  const color = STAGE_COLORS[stageId] || BRAND.primary;

  return (
    <Box sx={{
      minWidth: 260, maxWidth: 300, flex: '1 0 260px',
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5,
      }}>
        <Box sx={{
          width: 10, height: 10, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${alpha(color, 0.4)}`,
        }} />
        <Typography variant="subtitle2" sx={{
          fontWeight: 600, color: BRAND.textPrimary, textTransform: 'capitalize',
        }}>
          {stageName}
        </Typography>
        <Chip
          label={items.length}
          size="small"
          sx={{
            height: 20, minWidth: 24, fontSize: '0.7rem', fontWeight: 600,
            background: alpha(color, 0.12), color: color,
          }}
        />
      </Box>

      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 1,
        p: 1, borderRadius: 2,
        background: alpha(BRAND.bgSurface, 0.3),
        border: `1px solid ${alpha(BRAND.border, 0.5)}`,
        minHeight: 100,
      }}>
        {items.map((item, i) => (
          <Paper key={item.id || i} sx={{
            p: 2, cursor: 'default', transition: 'all 0.2s ease',
            background: BRAND.bgCard,
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
              border: `1px solid ${alpha(color, 0.2)}`,
            },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{
                fontWeight: 600, color: BRAND.textPrimary, mb: 0.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {item.title || item.name || item.company || 'Untitled'}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                sx={{
                  p: 0.3, ml: 0.5, mt: -0.3,
                  color: BRAND.textMuted, opacity: 0.5,
                  '&:hover': { color: BRAND.error, opacity: 1, background: alpha(BRAND.error, 0.08) },
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
            {item.description && (
              <Typography variant="caption" sx={{
                color: BRAND.textMuted, display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {item.description}
              </Typography>
            )}
            {item.priority && (
              <Chip
                label={item.priority}
                size="small"
                sx={{
                  mt: 1, height: 20, fontSize: '0.6rem', textTransform: 'capitalize',
                  background: alpha(
                    item.priority === 'high' ? BRAND.error : item.priority === 'medium' ? BRAND.warning : BRAND.textMuted,
                    0.1
                  ),
                  color: item.priority === 'high' ? BRAND.error : item.priority === 'medium' ? BRAND.warning : BRAND.textMuted,
                }}
              />
            )}
            {allStages && allStages.length > 1 && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                {allStages
                  .filter(s => (s.id || s) !== stageId)
                  .slice(0, 3)
                  .map(s => {
                    const sId = s.id || s;
                    const sName = s.name || String(sId).replace(/[-_]/g, ' ');
                    return (
                      <Chip
                        key={sId}
                        label={sName}
                        size="small"
                        icon={<ArrowForwardIcon sx={{ fontSize: '10px !important' }} />}
                        onClick={() => onMove(item.id, sId)}
                        sx={{
                          height: 20, fontSize: '0.6rem', cursor: 'pointer',
                          background: alpha(STAGE_COLORS[sId] || BRAND.textMuted, 0.08),
                          color: STAGE_COLORS[sId] || BRAND.textMuted,
                          '&:hover': { background: alpha(STAGE_COLORS[sId] || BRAND.textMuted, 0.15) },
                        }}
                      />
                    );
                  })}
              </Box>
            )}
          </Paper>
        ))}
        {items.length === 0 && (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
              No items
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// LEADS TABLE — Rich display for lead data
// ═══════════════════════════════════════════════════════

function LeadsTable({ leads, leadStages, onMove, onDelete, onLeadClick }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const filtered = leads
    .filter(l => {
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (l.company || '').toLowerCase().includes(q) ||
        (l.contact_name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.source || '').toLowerCase().includes(q) ||
        (l.notes || []).join(' ').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';
      if (sortBy === 'created_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const stageChip = (stageId) => {
    const stage = leadStages.find(s => s.id === stageId) || { name: stageId };
    const color = STAGE_COLORS[stageId] || BRAND.textMuted;
    return (
      <Chip
        label={stage.name || stageId}
        size="small"
        sx={{
          height: 22, fontSize: '0.7rem', fontWeight: 600,
          background: alpha(color, 0.12), color: color,
        }}
      />
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Stage</InputLabel>
          <Select
            value={stageFilter}
            label="Stage"
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <MenuItem value="all">All Stages</MenuItem>
            {leadStages.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Stage summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {leadStages.map(s => {
          const count = leads.filter(l => l.stage === s.id).length;
          if (count === 0) return null;
          const color = STAGE_COLORS[s.id] || BRAND.textMuted;
          return (
            <Chip
              key={s.id}
              label={`${s.name}: ${count}`}
              size="small"
              onClick={() => setStageFilter(stageFilter === s.id ? 'all' : s.id)}
              sx={{
                height: 26, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: stageFilter === s.id ? alpha(color, 0.25) : alpha(color, 0.08),
                color: color,
                border: stageFilter === s.id ? `1px solid ${alpha(color, 0.4)}` : 'none',
                '&:hover': { background: alpha(color, 0.18) },
              }}
            />
          );
        })}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} sx={{ background: BRAND.bgCard, borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { borderBottom: `1px solid ${BRAND.border}`, color: BRAND.textSecondary, fontWeight: 600, fontSize: '0.75rem' } }}>
              <TableCell>
                <TableSortLabel active={sortBy === 'company'} direction={sortBy === 'company' ? sortDir : 'asc'} onClick={() => handleSort('company')}>
                  Company
                </TableSortLabel>
              </TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Website</TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'source'} direction={sortBy === 'source' ? sortDir : 'asc'} onClick={() => handleSort('source')}>
                  Source
                </TableSortLabel>
              </TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => handleSort('created_at')}>
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((lead) => (
              <TableRow
                key={lead.id}
                onClick={() => onLeadClick?.(lead.id)}
                sx={{
                  '& td': { borderBottom: `1px solid ${alpha(BRAND.border, 0.5)}`, py: 1.5 },
                  '&:hover': { background: alpha(BRAND.primary, 0.04) },
                  cursor: 'pointer',
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.textPrimary }}>
                    {lead.company || 'Unknown'}
                  </Typography>
                  {lead.notes && lead.notes.length > 0 && (
                    <Tooltip title={lead.notes.join(' | ')} arrow>
                      <Typography variant="caption" sx={{
                        color: BRAND.textMuted, display: '-webkit-box',
                        WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        maxWidth: 200,
                      }}>
                        {lead.notes[0]}
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  {lead.contact_name ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon sx={{ fontSize: 14, color: BRAND.textMuted }} />
                      <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>{lead.contact_name}</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>--</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {lead.email ? (
                    <Box
                      component="a"
                      href={`mailto:${lead.email}`}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        color: BRAND.info, textDecoration: 'none', fontSize: '0.75rem',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      <EmailIcon sx={{ fontSize: 14 }} />
                      {lead.email}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>--</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {lead.phone ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PhoneIcon sx={{ fontSize: 14, color: BRAND.textMuted }} />
                      <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>{lead.phone}</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>--</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {lead.website ? (
                    <Box
                      component="a"
                      href={lead.website}
                      target="_blank"
                      rel="noopener"
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        color: BRAND.secondary, textDecoration: 'none', fontSize: '0.75rem',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      <LanguageIcon sx={{ fontSize: 14 }} />
                      {(() => { try { return new URL(lead.website).hostname.replace('www.', ''); } catch { return lead.website; } })()}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, fontStyle: 'italic' }}>--</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                    {lead.source || '--'}
                  </Typography>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    {stageChip(lead.stage)}
                    {/* Move options on hover */}
                    <Box sx={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 10, mt: 0.5,
                      display: 'none', flexDirection: 'column', gap: 0.5,
                      background: BRAND.bgElevated, borderRadius: 1, p: 0.5,
                      border: `1px solid ${BRAND.border}`, minWidth: 120,
                      '.MuiTableRow-root:hover &': { display: 'flex' },
                    }}>
                      {leadStages
                        .filter(s => s.id !== lead.stage)
                        .map(s => (
                          <Chip
                            key={s.id}
                            label={s.name}
                            size="small"
                            icon={<ArrowForwardIcon sx={{ fontSize: '10px !important' }} />}
                            onClick={() => onMove(lead.id, s.id)}
                            sx={{
                              height: 20, fontSize: '0.6rem', cursor: 'pointer', justifyContent: 'flex-start',
                              background: alpha(STAGE_COLORS[s.id] || BRAND.textMuted, 0.08),
                              color: STAGE_COLORS[s.id] || BRAND.textMuted,
                              '&:hover': { background: alpha(STAGE_COLORS[s.id] || BRAND.textMuted, 0.2) },
                            }}
                          />
                        ))}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: BRAND.textMuted }}>
                    {formatDate(lead.created_at)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    {lead.website && (
                      <Tooltip title="Open website">
                        <IconButton
                          size="small"
                          component="a"
                          href={lead.website}
                          target="_blank"
                          sx={{ p: 0.5, color: BRAND.textMuted, '&:hover': { color: BRAND.secondary } }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {lead.email && (
                      <Tooltip title="Send email">
                        <IconButton
                          size="small"
                          component="a"
                          href={`mailto:${lead.email}`}
                          sx={{ p: 0.5, color: BRAND.textMuted, '&:hover': { color: BRAND.info } }}
                        >
                          <EmailIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete lead">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(lead.id)}
                        sx={{ p: 0.5, color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 6 }}>
                  <PersonSearchIcon sx={{ fontSize: 40, color: BRAND.textMuted, mb: 1 }} />
                  {search || stageFilter !== 'all' ? (
                    <Typography variant="body2" sx={{ color: BRAND.textMuted }}>No leads match your filters</Typography>
                  ) : (
                    <Box sx={{ maxWidth: 400, mx: 'auto' }}>
                      <Typography variant="body1" sx={{ color: BRAND.textSecondary, fontWeight: 600, mb: 1 }}>
                        No leads yet
                      </Typography>
                      <Typography variant="body2" sx={{ color: BRAND.textMuted, textAlign: 'left', lineHeight: 1.8 }}>
                        1. In Chat, ask Ace: "Find me companies in [your city]"<br/>
                        2. Ace researches, finds contact info, and saves them here<br/>
                        3. When Ace emails a lead, it auto-moves to "Contacted"<br/>
                        4. Set up a routine in Automation to find leads daily
                      </Typography>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PIPELINE COMPONENT
// ═══════════════════════════════════════════════════════

function Pipeline() {
  const [tab, setTab] = useState(1); // Default to Leads tab
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [taskStages, setTaskStages] = useState([]);
  const [leadStages, setLeadStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', company: '', contact_name: '', email: '', phone: '', website: '' });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const sseRef = useRef(null);

  useEffect(() => {
    fetchAll();

    // Refresh when Ace adds tasks/leads from the Chat confirmation card
    const onPipelineUpdated = () => fetchAll();
    window.addEventListener('ace:pipeline-updated', onPipelineUpdated);

    // SSE — auto-refresh when Ace saves leads via tools
    const eventSource = new EventSource('/api/events/stream');
    sseRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'lead:added' || data.type === 'task:added' ||
            data.type === 'lead:moved' || data.type === 'task:moved' ||
            data.type === 'lead:updated') {
          fetchAll();
        }
      } catch (e) { /* ignore */ }
    };

    return () => {
      window.removeEventListener('ace:pipeline-updated', onPipelineUpdated);
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  const fetchAll = async () => {
    try {
      const [tasksRes, leadsRes, taskStagesRes, leadStagesRes] = await Promise.allSettled([
        fetch('/api/pipeline/tasks').then(r => r.json()),
        fetch('/api/pipeline/leads').then(r => r.json()),
        fetch('/api/pipeline/task-stages').then(r => r.json()),
        fetch('/api/pipeline/lead-stages').then(r => r.json()),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.success) setTasks(tasksRes.value.data || []);
      if (leadsRes.status === 'fulfilled' && leadsRes.value.success) setLeads(leadsRes.value.data || []);
      if (taskStagesRes.status === 'fulfilled' && taskStagesRes.value.success) setTaskStages(taskStagesRes.value.data || []);
      if (leadStagesRes.status === 'fulfilled' && leadStagesRes.value.success) setLeadStages(leadStagesRes.value.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleMoveTask = async (id, newStage) => {
    try {
      await fetch(`/api/pipeline/tasks/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      fetchAll();
    } catch (e) { console.error(e); }
  };

  const handleMoveLead = async (id, newStage) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
    try {
      await fetch(`/api/pipeline/leads/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch (e) { console.error(e); fetchAll(); }
  };

  const handleAdd = async () => {
    if (tab === 0) {
      // Add task
      try {
        await fetch('/api/pipeline/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newItem.title, description: newItem.description }),
        });
      } catch (e) { console.error(e); }
    } else {
      // Add lead
      try {
        await fetch('/api/pipeline/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: newItem.company || newItem.title,
            contact_name: newItem.contact_name,
            email: newItem.email,
            phone: newItem.phone,
            website: newItem.website,
            source: 'manual',
            notes: newItem.description ? [newItem.description] : [],
          }),
        });
      } catch (e) { console.error(e); }
    }
    setAddDialog(false);
    setNewItem({ title: '', description: '', company: '', contact_name: '', email: '', phone: '', website: '' });
    fetchAll();
  };

  const handleDeleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await fetch(`/api/pipeline/tasks/${id}`, { method: 'DELETE' }); } catch (e) { console.error(e); }
  };

  const handleDeleteLead = async (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    try { await fetch(`/api/pipeline/leads/${id}`, { method: 'DELETE' }); } catch (e) { console.error(e); }
  };

  // Task kanban grouping
  const taskGrouped = {};
  taskStages.forEach(stage => {
    const stageId = stage.id || stage;
    taskGrouped[stageId] = { stage, items: [] };
  });
  tasks.forEach(item => {
    const stageId = item.stage || (taskStages[0]?.id || taskStages[0] || 'unknown');
    if (!taskGrouped[stageId]) {
      taskGrouped[stageId] = { stage: { id: stageId, name: stageId }, items: [] };
    }
    taskGrouped[stageId].items.push(item);
  });

  return (
    <Box>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3,
        background: `linear-gradient(135deg, ${alpha(BRAND.secondary, 0.1)} 0%, ${alpha(BRAND.primary, 0.05)} 100%)`,
        border: `1px solid ${alpha(BRAND.secondary, 0.15)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: `linear-gradient(135deg, ${BRAND.secondary}, ${BRAND.primary})`,
            boxShadow: `0 4px 15px ${alpha(BRAND.secondary, 0.3)}`,
          }}>
            <AccountTreeIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Pipeline
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND.textSecondary }}>
              {tab === 0
                ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across ${taskStages.length} stages`
                : `${leads.length} lead${leads.length !== 1 ? 's' : ''} from Ace's research`
              }
            </Typography>
          </Box>
          <IconButton onClick={fetchAll} sx={{ color: BRAND.textMuted, mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialog(true)}
            size="small"
          >
            Add {tab === 0 ? 'Task' : 'Lead'}
          </Button>
        </Box>
      </Paper>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none', fontWeight: 600, fontSize: '0.9rem',
              color: BRAND.textSecondary,
              '&.Mui-selected': { color: BRAND.primary },
            },
            '& .MuiTabs-indicator': {
              background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})`,
              height: 3, borderRadius: 2,
            },
          }}
        >
          <Tab icon={<TaskAltIcon sx={{ fontSize: 20 }} />} iconPosition="start" label={`Tasks (${tasks.length})`} />
          <Tab icon={<PersonSearchIcon sx={{ fontSize: 20 }} />} iconPosition="start" label={`Leads (${leads.length})`} />
        </Tabs>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" width={280} height={300} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      ) : tab === 0 ? (
        /* Tasks — Kanban */
        <Box sx={{
          display: 'flex', gap: 2, overflow: 'auto', pb: 2,
          '&::-webkit-scrollbar': { height: 6 },
        }}>
          {Object.entries(taskGrouped).map(([stageId, { stage, items }]) => (
            <KanbanColumn
              key={stageId}
              stage={stage}
              items={items}
              onMove={handleMoveTask}
              onDelete={handleDeleteTask}
              allStages={taskStages}
            />
          ))}
          {Object.keys(taskGrouped).length === 0 && (
            <Paper sx={{ p: 6, textAlign: 'center', width: '100%' }}>
              <TaskAltIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 2 }} />
              <Typography variant="h6" sx={{ color: BRAND.textSecondary, mb: 1 }}>No Tasks</Typography>
              <Typography variant="body2" sx={{ color: BRAND.textMuted }}>Add tasks to track your work.</Typography>
            </Paper>
          )}
        </Box>
      ) : (
        /* Leads — Table */
        <LeadsTable
          leads={leads}
          leadStages={leadStages}
          onMove={handleMoveLead}
          onDelete={handleDeleteLead}
          onLeadClick={setSelectedLeadId}
        />
      )}

      {/* Add Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Add {tab === 0 ? 'Task' : 'Lead'}
          <IconButton size="small" onClick={() => setAddDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {tab === 0 ? (
            <>
              <TextField
                label="Task Title"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                fullWidth
              />
              <TextField
                label="Description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                fullWidth multiline rows={3}
              />
            </>
          ) : (
            <>
              <TextField
                label="Company Name"
                value={newItem.company}
                onChange={(e) => setNewItem({ ...newItem, company: e.target.value })}
                fullWidth required
              />
              <TextField
                label="Contact Name"
                value={newItem.contact_name}
                onChange={(e) => setNewItem({ ...newItem, contact_name: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Email"
                  value={newItem.email}
                  onChange={(e) => setNewItem({ ...newItem, email: e.target.value })}
                  fullWidth type="email"
                />
                <TextField
                  label="Phone"
                  value={newItem.phone}
                  onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                  fullWidth
                />
              </Box>
              <TextField
                label="Website"
                value={newItem.website}
                onChange={(e) => setNewItem({ ...newItem, website: e.target.value })}
                fullWidth placeholder="https://..."
              />
              <TextField
                label="Notes"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                fullWidth multiline rows={2}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={tab === 0 ? !newItem.title.trim() : !newItem.company.trim()}
          >
            Add {tab === 0 ? 'Task' : 'Lead'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        leadStages={leadStages}
        onLeadUpdated={fetchAll}
      />
    </Box>
  );
}

export default Pipeline;
