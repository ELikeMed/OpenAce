import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, alpha, Chip, IconButton,
  TextField, InputAdornment, Tooltip, CircularProgress, Divider,
  List, ListItem, ListItemButton, ListItemText, ListItemIcon,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CodeIcon from '@mui/icons-material/Code';
import WebIcon from '@mui/icons-material/Web';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { BRAND } from '../theme';

const API = 'http://localhost:3333';

const TYPE_COLORS = {
  'landing-page':  { bg: alpha('#6C5CE7', 0.15), text: '#A29BFE', label: 'Landing Page' },
  'react-app':     { bg: alpha('#00CEC9', 0.15), text: '#55EFC4', label: 'React App' },
  'webapp':        { bg: alpha('#00CEC9', 0.15), text: '#55EFC4', label: 'Web App' },
  'website':       { bg: alpha('#74B9FF', 0.15), text: '#74B9FF', label: 'Website' },
  'dashboard':     { bg: alpha('#FD79A8', 0.15), text: '#FD79A8', label: 'Dashboard' },
  'api':           { bg: alpha('#FDCB6E', 0.15), text: '#FDCB6E', label: 'API' },
  'widget':        { bg: alpha('#00B894', 0.15), text: '#00B894', label: 'Widget' },
  'project':       { bg: alpha('#8B8BA3', 0.15), text: '#8B8BA3', label: 'Project' },
};

function getTypeStyle(type) {
  return TYPE_COLORS[type] || TYPE_COLORS['project'];
}

export default function Studio({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [deployStatus, setDeployStatus] = useState(null); // null | 'deploying' | 'success' | 'error'
  const [deployMessage, setDeployMessage] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [newBadge, setNewBadge] = useState(null); // projectName that was just created
  const iframeRef = useRef(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects`);
      const data = await res.json();
      const list = (data.projects || data.data?.projects || data.data || []).sort(
        (a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0)
      );
      setProjects(list);
      return list;
    } catch (e) {
      console.error('Failed to fetch projects', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for project creation from chat
  useEffect(() => {
    const handle = async (e) => {
      const projectName = e.detail?.projectName;
      setNewBadge(projectName);
      const list = await fetchProjects();
      if (projectName) {
        const found = list.find(p => p.name === projectName);
        setSelected(found || { name: projectName, type: 'project' });
        setPreviewKey(k => k + 1);
      }
    };
    window.addEventListener('ace:project-created', handle);
    return () => window.removeEventListener('ace:project-created', handle);
  }, [fetchProjects]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.type || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (project) => {
    setSelected(project);
    setDeployStatus(null);
    setDeployMessage('');
    setPreviewKey(k => k + 1);
    if (newBadge === project.name) setNewBadge(null);
  };

  const handleRefresh = () => {
    setPreviewKey(k => k + 1);
    fetchProjects();
  };

  const handleDeploy = async () => {
    if (!selected) return;
    setDeployStatus('deploying');
    setDeployMessage('');
    try {
      const res = await fetch(`${API}/api/projects/${selected.name}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'local' }),
      });
      const data = await res.json();
      if (data.success || data.url) {
        setDeployStatus('success');
        setDeployMessage(data.url ? `Live at: ${data.url}` : 'Deployed successfully!');
      } else {
        setDeployStatus('error');
        setDeployMessage(data.error || 'Deploy failed');
      }
    } catch (e) {
      setDeployStatus('error');
      setDeployMessage(e.message);
    }
  };

  const previewUrl = selected ? `/projects/${selected.name}/` : null;
  const editorUrl = `/studio`;

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex', gap: 2 }}>

      {/* Left Panel — Project List */}
      <Paper sx={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: alpha(BRAND.bgCard, 0.6),
        backdropFilter: 'blur(20px)',
      }}>
        {/* Header */}
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: BRAND.textPrimary }}>
              Projects
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                label={projects.length}
                size="small"
                sx={{
                  height: 20, fontSize: '0.7rem',
                  background: alpha(BRAND.primary, 0.15),
                  color: BRAND.primaryLight,
                  border: `1px solid ${alpha(BRAND.primary, 0.25)}`,
                }}
              />
              <Tooltip title="Refresh list">
                <IconButton size="small" onClick={fetchProjects} sx={{ color: BRAND.textMuted }}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: BRAND.textMuted }} /></InputAdornment>,
              sx: { fontSize: '0.8rem' },
            }}
          />
        </Box>

        <Divider sx={{ borderColor: BRAND.border }} />

        {/* Project List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} sx={{ color: BRAND.primary }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <FolderIcon sx={{ fontSize: 36, color: BRAND.textMuted, mb: 1 }} />
              <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block' }}>
                {search ? 'No matching projects' : 'No projects yet'}
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.textMuted, display: 'block', mt: 0.5 }}>
                Ask Ace to build one!
              </Typography>
            </Box>
          ) : (
            <List dense sx={{ py: 0.5 }}>
              {filtered.map(project => {
                const typeStyle = getTypeStyle(project.type);
                const isNew = newBadge === project.name;
                const isSelected = selected?.name === project.name;
                return (
                  <ListItem key={project.name} disablePadding>
                    <ListItemButton
                      selected={isSelected}
                      onClick={() => handleSelect(project)}
                      sx={{
                        py: 1, px: 1.5,
                        borderRadius: 1.5,
                        mx: 0.5,
                        my: 0.25,
                        position: 'relative',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <WebIcon sx={{ fontSize: 18, color: isSelected ? BRAND.primary : BRAND.textMuted }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography sx={{
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? BRAND.textPrimary : BRAND.textSecondary,
                              lineHeight: 1.3,
                              wordBreak: 'break-all',
                            }}>
                              {project.name}
                            </Typography>
                            {isNew && (
                              <Chip
                                label="NEW"
                                size="small"
                                icon={<AutoAwesomeIcon sx={{ fontSize: '10px !important' }} />}
                                sx={{
                                  height: 16, fontSize: '0.6rem', fontWeight: 700,
                                  background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})`,
                                  color: '#fff',
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Chip
                            label={getTypeStyle(project.type).label}
                            size="small"
                            sx={{
                              mt: 0.5, height: 18, fontSize: '0.65rem',
                              background: typeStyle.bg,
                              color: typeStyle.text,
                              border: 'none',
                            }}
                          />
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Paper>

      {/* Right Panel — Preview + Actions */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>

        {/* Action Bar */}
        <Paper sx={{
          px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1.5,
          background: alpha(BRAND.bgCard, 0.6),
          backdropFilter: 'blur(20px)',
          flexWrap: 'wrap',
        }}>
          {selected ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                <WebIcon sx={{ fontSize: 20, color: BRAND.primary, flexShrink: 0 }} />
                <Typography sx={{
                  fontWeight: 600, fontSize: '0.95rem',
                  color: BRAND.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {selected.name}
                </Typography>
                <Chip
                  label={getTypeStyle(selected.type).label}
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.7rem', flexShrink: 0,
                    background: getTypeStyle(selected.type).bg,
                    color: getTypeStyle(selected.type).text,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Tooltip title="Refresh preview">
                  <IconButton size="small" onClick={handleRefresh} sx={{ color: BRAND.textMuted }}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open in new tab">
                  <IconButton
                    size="small"
                    onClick={() => window.open(previewUrl, '_blank')}
                    sx={{ color: BRAND.textMuted }}
                  >
                    <OpenInNewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download project ZIP">
                  <IconButton
                    size="small"
                    onClick={() => window.open(`${API}/api/projects/${selected.name}/download`, '_blank')}
                    sx={{ color: BRAND.textMuted }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  startIcon={<CodeIcon />}
                  variant="outlined"
                  onClick={() => window.open(editorUrl, '_blank')}
                  sx={{
                    borderColor: alpha(BRAND.primary, 0.4),
                    color: BRAND.primaryLight,
                    fontSize: '0.78rem',
                    py: 0.5,
                    '&:hover': { borderColor: BRAND.primary, background: alpha(BRAND.primary, 0.08) },
                  }}
                >
                  Edit Code
                </Button>
                <Button
                  size="small"
                  startIcon={
                    deployStatus === 'deploying' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> :
                    deployStatus === 'success' ? <CheckCircleIcon /> :
                    deployStatus === 'error' ? <ErrorIcon /> :
                    <RocketLaunchIcon />
                  }
                  variant="contained"
                  onClick={handleDeploy}
                  disabled={deployStatus === 'deploying'}
                  sx={{
                    fontSize: '0.78rem',
                    py: 0.5,
                    background: deployStatus === 'success'
                      ? `linear-gradient(135deg, ${BRAND.success}, #00B894)`
                      : deployStatus === 'error'
                      ? `linear-gradient(135deg, ${BRAND.error}, #FF7675)`
                      : undefined,
                  }}
                >
                  {deployStatus === 'deploying' ? 'Deploying…' :
                   deployStatus === 'success' ? 'Deployed!' :
                   deployStatus === 'error' ? 'Retry Deploy' :
                   'Deploy'}
                </Button>
              </Box>

              {/* Deploy message */}
              {deployMessage && (
                <Box sx={{ width: '100%', mt: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: deployStatus === 'success' ? BRAND.success : BRAND.error,
                      fontSize: '0.75rem',
                    }}
                  >
                    {deployStatus === 'success' ? '✅ ' : '❌ '}{deployMessage}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <Typography sx={{ color: BRAND.textMuted, fontSize: '0.875rem' }}>
              Select a project from the list to preview and deploy it.
            </Typography>
          )}
        </Paper>

        {/* Preview Iframe */}
        <Paper sx={{
          flex: 1,
          overflow: 'hidden',
          background: selected ? '#fff' : alpha(BRAND.bgCard, 0.4),
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {selected ? (
            <Box
              key={previewKey}
              component="iframe"
              ref={iframeRef}
              src={previewUrl}
              title={`Preview: ${selected.name}`}
              sx={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
          ) : (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <WebIcon sx={{ fontSize: 64, color: alpha(BRAND.textMuted, 0.3), mb: 2 }} />
              <Typography sx={{ color: BRAND.textMuted, fontWeight: 500, mb: 1 }}>
                No project selected
              </Typography>
              <Typography variant="caption" sx={{ color: alpha(BRAND.textMuted, 0.7) }}>
                Choose a project from the list, or ask Ace in Chat to build one
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{
                  color: BRAND.textMuted,
                  fontStyle: 'italic',
                  display: 'block',
                  maxWidth: 300,
                  mx: 'auto',
                }}>
                  Try: "Build me a beautiful modern landing page for my real estate business"
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
