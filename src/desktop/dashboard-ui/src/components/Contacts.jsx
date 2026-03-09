import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Chip, Avatar, alpha, TextField, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { BRAND } from '../theme';

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', tags: '', notes: '', company: '' });

  const fileInputRef = useRef(null);

  const fetchContacts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tagFilter) params.set('tag', tagFilter);
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, [search, tagFilter]);

  // Collect all unique tags across contacts
  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))].sort();

  const openAddDialog = () => {
    setEditingContact(null);
    setForm({ name: '', email: '', phone: '', tags: '', notes: '', company: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      tags: (contact.tags || []).join(', '),
      notes: contact.notes || '',
      company: contact.company || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
      if (editingContact) {
        await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      fetchContacts();
    } catch (e) {
      console.error('Failed to save contact:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch (e) {
      console.error('Failed to delete contact:', e);
    }
  };

  const handleCsvImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = header.findIndex(h => h === 'name');
    const emailIdx = header.findIndex(h => h === 'email');

    if (nameIdx === -1 || emailIdx === -1) {
      alert('CSV must have "name" and "email" columns');
      return;
    }

    const imported = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols[nameIdx] && cols[emailIdx]) {
        imported.push({
          name: cols[nameIdx],
          email: cols[emailIdx],
          phone: cols[header.indexOf('phone')] || null,
          company: cols[header.indexOf('company')] || null,
          tags: cols[header.indexOf('tags')]?.split(';').map(t => t.trim()).filter(Boolean) || [],
        });
      }
    }

    if (imported.length > 0) {
      await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: imported }),
      });
      fetchContacts();
    }
  };

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Box sx={{ maxWidth: 1200 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '1.2rem', flex: 1 }}>
          Contacts ({total})
        </Typography>
        <Chip
          icon={<UploadFileIcon sx={{ fontSize: '14px !important' }} />}
          label="Import CSV"
          size="small"
          onClick={() => fileInputRef.current?.click()}
          sx={{
            cursor: 'pointer', height: 28, fontSize: '0.75rem', fontWeight: 600,
            background: alpha(BRAND.accent, 0.1), color: BRAND.accent,
            border: `1px solid ${alpha(BRAND.accent, 0.2)}`,
            '&:hover': { background: alpha(BRAND.accent, 0.2) },
          }}
        />
        <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={e => handleCsvImport(e.target.files?.[0])} />
        <Chip
          icon={<AddIcon sx={{ fontSize: '14px !important' }} />}
          label="Add Contact"
          size="small"
          onClick={openAddDialog}
          sx={{
            cursor: 'pointer', height: 28, fontSize: '0.75rem', fontWeight: 600,
            background: alpha(BRAND.primary, 0.1), color: BRAND.primary,
            border: `1px solid ${alpha(BRAND.primary, 0.2)}`,
            '&:hover': { background: alpha(BRAND.primary, 0.2) },
          }}
        />
      </Box>

      {/* Search + Tag Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search contacts..."
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <SearchIcon sx={{ color: BRAND.textMuted, mr: 1, fontSize: 18 }} /> } }}
          sx={{ minWidth: 250 }}
        />
        {allTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label="All"
              size="small"
              onClick={() => setTagFilter('')}
              sx={{
                height: 24, fontSize: '0.7rem',
                background: !tagFilter ? alpha(BRAND.primary, 0.15) : 'transparent',
                color: !tagFilter ? BRAND.primary : BRAND.textMuted,
                border: `1px solid ${alpha(BRAND.primary, !tagFilter ? 0.3 : 0.1)}`,
                cursor: 'pointer',
              }}
            />
            {allTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                sx={{
                  height: 24, fontSize: '0.7rem',
                  background: tagFilter === tag ? alpha(BRAND.secondary, 0.15) : 'transparent',
                  color: tagFilter === tag ? BRAND.secondary : BRAND.textMuted,
                  border: `1px solid ${alpha(BRAND.secondary, tagFilter === tag ? 0.3 : 0.1)}`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Contact Cards */}
      {loading ? (
        <Typography sx={{ color: BRAND.textMuted, py: 4, textAlign: 'center' }}>Loading contacts...</Typography>
      ) : contacts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
          <Typography variant="body1" sx={{ color: BRAND.textMuted }}>
            No contacts yet. Add one or import a CSV to get started.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={1.5}>
          {contacts.map(contact => {
            const daysAgo = getDaysAgo(contact.lastContacted);
            const needsFollowUp = daysAgo === null || daysAgo > 7;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={contact.id}>
                <Paper sx={{
                  p: 2, height: '100%',
                  border: needsFollowUp ? `1px solid ${alpha(BRAND.warning, 0.3)}` : undefined,
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${alpha(BRAND.primary, 0.1)}` },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{
                      width: 36, height: 36,
                      background: `linear-gradient(135deg, ${alpha(BRAND.primary, 0.2)}, ${alpha(BRAND.secondary, 0.2)})`,
                      color: BRAND.primary, fontSize: '0.9rem', fontWeight: 700,
                    }}>
                      {contact.name?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {contact.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block' }}>
                        {contact.email}
                      </Typography>
                      {contact.company && (
                        <Typography variant="caption" sx={{ color: BRAND.textSecondary }}>
                          {contact.company}
                        </Typography>
                      )}
                    </Box>
                    {needsFollowUp && (
                      <Tooltip title={daysAgo === null ? 'Never contacted' : `Last emailed ${daysAgo} days ago`}>
                        <WarningAmberIcon sx={{ fontSize: 16, color: BRAND.warning }} />
                      </Tooltip>
                    )}
                  </Box>

                  {(contact.tags?.length > 0) && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                      {contact.tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" sx={{
                          height: 18, fontSize: '0.6rem',
                          background: alpha(BRAND.secondary, 0.1), color: BRAND.secondary,
                        }} />
                      ))}
                    </Box>
                  )}

                  {contact.lastContacted && (
                    <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mt: 1 }}>
                      Last emailed: {new Date(contact.lastContacted).toLocaleDateString()}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Send email">
                      <IconButton size="small" sx={{ color: BRAND.primary }}
                        onClick={() => window.dispatchEvent(new CustomEvent('ace:send-email', { detail: contact }))}
                      >
                        <EmailIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" sx={{ color: BRAND.textMuted }} onClick={() => openEditDialog(contact)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" sx={{ color: BRAND.error }} onClick={() => handleDelete(contact.id)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: BRAND.bgElevated, border: `1px solid ${BRAND.border}` } } }}
      >
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Name" size="small" fullWidth required
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" size="small" fullWidth required type="email"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <TextField label="Phone" size="small" fullWidth
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Company" size="small" fullWidth
            value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <TextField label="Tags" size="small" fullWidth placeholder="tag1, tag2, tag3"
            value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
            helperText="Comma-separated tags" />
          <TextField label="Notes" size="small" fullWidth multiline rows={2}
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: BRAND.textMuted }}>Cancel</Button>
          <Button variant="contained" disabled={!form.name || !form.email} onClick={handleSave}
            sx={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`, textTransform: 'none', fontWeight: 600 }}
          >
            {editingContact ? 'Save Changes' : 'Add Contact'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Contacts;
