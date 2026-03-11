import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, alpha, Button, TextField, IconButton,
  Chip, Avatar, LinearProgress, Tooltip, Divider, Snackbar
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import DataObjectIcon from '@mui/icons-material/DataObject';
import StorageIcon from '@mui/icons-material/Storage';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { BRAND } from '../theme';

const API = 'http://localhost:3333';

function StatBox({ label, value, icon }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center', flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
        <Avatar sx={{ width: 28, height: 28, background: alpha(BRAND.primary, 0.12), color: BRAND.primaryLight }}>
          {icon}
        </Avatar>
        <Typography variant="h5" fontWeight={700} color={BRAND.secondary}>{value}</Typography>
      </Box>
      <Typography variant="caption" color={BRAND.textMuted}>{label}</Typography>
    </Paper>
  );
}

function SourceCard({ source, onDelete, onReindex }) {
  const typeIcon = source.type === 'codebase' ? <CodeIcon /> : <DescriptionIcon />;
  const typeColor = source.type === 'codebase' ? BRAND.secondary : BRAND.primaryLight;

  return (
    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Avatar sx={{ width: 40, height: 40, background: alpha(typeColor, 0.15), color: typeColor }}>
        {typeIcon}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>{source.name}</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip label={source.type} size="small" sx={{ height: 20, fontSize: 11, background: alpha(typeColor, 0.15), color: typeColor }} />
          {source.fileCount > 0 && <Chip label={`${source.fileCount} files`} size="small" sx={{ height: 20, fontSize: 11 }} />}
          <Chip label={`${source.chunkCount} chunks`} size="small" sx={{ height: 20, fontSize: 11 }} />
          {source.status === 'ingesting' && <Chip label="Ingesting..." size="small" color="warning" sx={{ height: 20, fontSize: 11 }} />}
          {source.status === 'failed' && <Chip label="Failed" size="small" color="error" sx={{ height: 20, fontSize: 11 }} />}
        </Box>
        <Typography variant="caption" color={BRAND.textMuted} sx={{ mt: 0.5, display: 'block' }}>
          {source.extensions?.join(', ') || ''} {source.ingestedAt && `\u2022 ${new Date(source.ingestedAt).toLocaleDateString()}`}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {source.type !== 'file' && (
          <Tooltip title="Reindex">
            <IconButton size="small" onClick={() => onReindex(source.id)} sx={{ color: BRAND.textMuted }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(source.id)} sx={{ color: BRAND.error }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

export default function Workload() {
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState({ totalSources: 0, totalChunks: 0, totalSizeFormatted: '0 KB' });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [ingestType, setIngestType] = useState('codebase');
  const [sourceName, setSourceName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaFolder, setMediaFolder] = useState('');
  const [scanningMedia, setScanningMedia] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const mediaFileInputRef = useRef(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/workload/sources`);
      const data = await res.json();
      if (data.success) {
        setSources(data.data.sources || []);
        setStats(data.data.stats || {});
      }
    } catch (e) {
      console.error('Failed to fetch workload sources:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/workload/media`);
      const data = await res.json();
      if (data.success) setMedia(data.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSources();
    fetchMedia();
    const interval = setInterval(() => { fetchSources(); fetchMedia(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchSources, fetchMedia]);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const res = await fetch(`${API}/api/workload/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-filename': encodeURIComponent(file.name),
            'x-source-name': encodeURIComponent(file.name),
          },
          body: buffer,
        });
        const data = await res.json();
        if (data.success) {
          setSnackbar(`Uploaded: ${file.name} (${data.data.chunkCount} chunks)`);
        } else {
          setSnackbar(`Failed: ${data.data?.error || data.error || 'Unknown error'}`);
        }
      } catch (e) {
        setSnackbar(`Upload error: ${e.message}`);
      }
    }

    setUploading(false);
    fetchSources();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleIngestFolder = async () => {
    if (!folderPath.trim()) return;
    setIngesting(true);

    try {
      const res = await fetch(`${API}/api/workload/ingest-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          sourceName: sourceName.trim() || undefined,
          type: ingestType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSnackbar(`Ingestion started for ${folderPath}`);
        setFolderPath('');
        setSourceName('');
      } else {
        setSnackbar(`Failed: ${data.error}`);
      }
    } catch (e) {
      setSnackbar(`Ingest error: ${e.message}`);
    }

    setIngesting(false);
    setTimeout(fetchSources, 2000);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/api/workload/sources/${id}`, { method: 'DELETE' });
      setSnackbar('Source removed');
      fetchSources();
    } catch (e) {
      setSnackbar(`Delete error: ${e.message}`);
    }
  };

  const handleReindex = async (id) => {
    try {
      const res = await fetch(`${API}/api/workload/sources/${id}/reindex`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnackbar(`Reindexing started`);
        setTimeout(fetchSources, 2000);
      }
    } catch (e) {
      setSnackbar(`Reindex error: ${e.message}`);
    }
  };

  const handleScanMedia = async () => {
    setScanningMedia(true);
    try {
      const body = mediaFolder.trim() ? { folderPath: mediaFolder.trim() } : {};
      const res = await fetch(`${API}/api/workload/media/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSnackbar(`Media scanned: ${data.data.added !== undefined ? `${data.data.added} new files` : `${data.data.total} total`}`);
        setMediaFolder('');
        fetchMedia();
      }
    } catch (e) {
      setSnackbar(`Scan error: ${e.message}`);
    }
    setScanningMedia(false);
  };

  const handleDeleteMedia = async (id) => {
    try {
      await fetch(`${API}/api/workload/media/${id}`, { method: 'DELETE' });
      fetchMedia();
    } catch {}
  };

  const handleMediaUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const res = await fetch(`${API}/api/workload/media/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-filename': encodeURIComponent(file.name),
          },
          body: buffer,
        });
        const data = await res.json();
        if (data.success) {
          setSnackbar(`Added: ${file.name}`);
        } else {
          setSnackbar(`Failed: ${data.error || 'Unknown error'}`);
        }
      } catch (e) {
        setSnackbar(`Upload error: ${e.message}`);
      }
    }

    setUploadingMedia(false);
    fetchMedia();
  };

  const handleMediaDrop = (e) => {
    e.preventDefault();
    setMediaDragOver(false);
    handleMediaUpload(e.dataTransfer.files);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);

    try {
      const res = await fetch(`${API}/api/workload/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
      }
    } catch (e) {
      setSnackbar(`Search error: ${e.message}`);
    }

    setSearching(false);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 3, px: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ width: 44, height: 44, background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary})` }}>
          <FolderOpenIcon />
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight={700}>Media & Files</Typography>
          <Typography variant="body2" color={BRAND.textMuted}>
            Everything here is Ace's toolkit — images for social posts, documents for reference, codebases to maintain, and templates to reuse. Upload it, and Ace can use it.
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <StatBox label="Sources" value={stats.totalSources || 0} icon={<StorageIcon sx={{ fontSize: 16 }} />} />
        <StatBox label="Chunks" value={stats.totalChunks || 0} icon={<DataObjectIcon sx={{ fontSize: 16 }} />} />
        <StatBox label="Size" value={stats.totalSizeFormatted || '0 KB'} icon={<InsertDriveFileIcon sx={{ fontSize: 16 }} />} />
      </Box>

      {/* Upload & Ingest Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        {/* Upload Zone */}
        <Paper
          sx={{
            flex: 1, p: 3, textAlign: 'center', cursor: 'pointer',
            border: `2px dashed ${dragOver ? BRAND.secondary : BRAND.border}`,
            background: dragOver ? alpha(BRAND.secondary, 0.05) : 'transparent',
            transition: 'all 0.2s',
            '&:hover': { borderColor: BRAND.primaryLight, background: alpha(BRAND.primary, 0.03) },
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.js,.jsx,.ts,.tsx,.py,.json,.html,.css"
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files)}
          />
          <CloudUploadIcon sx={{ fontSize: 36, color: BRAND.textMuted, mb: 1 }} />
          <Typography variant="body2" fontWeight={600}>
            {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
          </Typography>
          <Typography variant="caption" color={BRAND.textMuted}>
            Docs, templates, PDFs, spreadsheets, code files — anything Ace should know about
          </Typography>
          {uploading && <LinearProgress sx={{ mt: 1 }} />}
        </Paper>

        {/* Connect Codebase */}
        <Paper sx={{ flex: 1, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CodeIcon sx={{ color: BRAND.secondary }} />
            <Typography fontWeight={600}>Connect a Project</Typography>
          </Box>
          <Typography variant="caption" color={BRAND.textMuted} sx={{ display: 'block', mb: 1 }}>
            Point Ace to a website, app, or project folder — it indexes the code so it can help maintain, debug, and improve it.
          </Typography>
          <TextField
            fullWidth size="small" placeholder="/path/to/your/project"
            value={folderPath} onChange={(e) => setFolderPath(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth size="small" placeholder="Name (optional)"
            value={sourceName} onChange={(e) => setSourceName(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label="Codebase" size="small" clickable
              onClick={() => setIngestType('codebase')}
              sx={{
                background: ingestType === 'codebase' ? alpha(BRAND.secondary, 0.2) : 'transparent',
                color: ingestType === 'codebase' ? BRAND.secondary : BRAND.textMuted,
                border: `1px solid ${ingestType === 'codebase' ? BRAND.secondary : BRAND.border}`,
              }}
            />
            <Chip
              label="Folder" size="small" clickable
              onClick={() => setIngestType('folder')}
              sx={{
                background: ingestType === 'folder' ? alpha(BRAND.secondary, 0.2) : 'transparent',
                color: ingestType === 'folder' ? BRAND.secondary : BRAND.textMuted,
                border: `1px solid ${ingestType === 'folder' ? BRAND.secondary : BRAND.border}`,
              }}
            />
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained" size="small"
              disabled={!folderPath.trim() || ingesting}
              onClick={handleIngestFolder}
              sx={{ background: BRAND.secondary, '&:hover': { background: BRAND.secondary } }}
            >
              {ingesting ? 'Ingesting...' : 'Ingest'}
            </Button>
          </Box>
          {ingesting && <LinearProgress sx={{ mt: 1 }} />}
        </Paper>
      </Box>

      {/* Sources */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Sources</Typography>
      {loading ? (
        <LinearProgress />
      ) : sources.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <FolderOpenIcon sx={{ fontSize: 48, color: BRAND.textMuted, mb: 1 }} />
          <Typography color={BRAND.textMuted}>Ace's knowledge base is empty</Typography>
          <Typography variant="caption" color={BRAND.textMuted}>
            Upload business docs, brand assets, or connect a project folder — Ace will reference them when researching, posting, emailing, and coding.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {sources.map(s => (
            <SourceCard key={s.id} source={s} onDelete={handleDelete} onReindex={handleReindex} />
          ))}
        </Box>
      )}

      {/* Media Library */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" fontWeight={600}>
          Media Library
          {media.length > 0 && (
            <Chip label={`${media.length}`} size="small" sx={{ ml: 1, height: 20, fontSize: 11, color: BRAND.secondary }} />
          )}
        </Typography>
        <Button size="small" onClick={() => handleScanMedia()} disabled={scanningMedia} sx={{ color: BRAND.textMuted }}>
          <RefreshIcon fontSize="small" sx={{ mr: 0.5 }} /> Rescan
        </Button>
      </Box>

      {/* Media Upload Zone */}
      <Paper
        sx={{
          p: 3, textAlign: 'center', cursor: 'pointer', mb: 2,
          border: `2px dashed ${mediaDragOver ? BRAND.secondary : BRAND.border}`,
          background: mediaDragOver ? alpha(BRAND.secondary, 0.05) : 'transparent',
          transition: 'all 0.2s',
          '&:hover': { borderColor: BRAND.primaryLight, background: alpha(BRAND.primary, 0.03) },
        }}
        onDragOver={(e) => { e.preventDefault(); setMediaDragOver(true); }}
        onDragLeave={() => setMediaDragOver(false)}
        onDrop={handleMediaDrop}
        onClick={() => mediaFileInputRef.current?.click()}
      >
        <input
          ref={mediaFileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          style={{ display: 'none' }}
          onChange={(e) => handleMediaUpload(e.target.files)}
        />
        <CloudUploadIcon sx={{ fontSize: 32, color: BRAND.textMuted, mb: 0.5 }} />
        <Typography variant="body2" fontWeight={600}>
          {uploadingMedia ? 'Uploading...' : 'Drop images, videos, or audio here'}
        </Typography>
        <Typography variant="caption" color={BRAND.textMuted}>
          Brand photos, product shots, video clips — Ace uses these for social media posts
        </Typography>
        {uploadingMedia && <LinearProgress sx={{ mt: 1 }} />}
      </Paper>

      {scanningMedia && <LinearProgress sx={{ mb: 2 }} />}

      {media.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', mb: 2 }}>
          <Typography color={BRAND.textMuted} variant="body2">
            No images or videos yet. Drop files above or click to browse your computer.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          {media.map(m => (
            <Paper key={m.id} sx={{ width: 140, p: 1.5, position: 'relative' }}>
              {m.type === 'image' ? (
                <Box
                  component="img"
                  src={`file://${m.path}`}
                  alt={m.filename}
                  sx={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 1, mb: 1, background: BRAND.bgSurface }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <Box sx={{
                  width: '100%', height: 90, borderRadius: 1, mb: 1,
                  background: alpha(m.type === 'video' ? BRAND.accent : BRAND.info, 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Typography variant="caption" color={BRAND.textMuted}>
                    {m.type === 'video' ? '🎬' : '🎵'} {m.ext}
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 500 }}>{m.filename}</Typography>
              <Typography variant="caption" color={BRAND.textMuted}>{m.sizeFormatted}</Typography>
              {m.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {m.tags.slice(0, 3).map((tag, i) => (
                    <Chip key={i} label={tag} size="small" sx={{ height: 16, fontSize: 9 }} />
                  ))}
                </Box>
              )}
              <Tooltip title="Remove from Ace">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleDeleteMedia(m.id); }}
                  sx={{ position: 'absolute', top: 4, right: 4, color: BRAND.textMuted, background: alpha(BRAND.bg, 0.7), width: 22, height: 22 }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      )}

      {/* Search */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Search Files</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder='Search ingested knowledge (e.g. "API endpoints for deals")'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button
          variant="contained" onClick={handleSearch}
          disabled={!searchQuery.trim() || searching}
          sx={{ px: 3, background: BRAND.primary }}
        >
          <SearchIcon />
        </Button>
      </Box>

      {searching && <LinearProgress sx={{ mb: 2 }} />}

      {searchResults.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {searchResults.map((r, i) => (
            <Paper key={i} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  label={r.fileType || 'text'} size="small"
                  sx={{ height: 20, fontSize: 11, background: alpha(BRAND.secondary, 0.15), color: BRAND.secondary }}
                />
                <Typography variant="body2" fontWeight={600} color={BRAND.primaryLight} noWrap sx={{ flex: 1 }}>
                  {r.filePath}
                </Typography>
                <Chip
                  label={`${Math.round((r.relevance || 0) * 100)}% match`} size="small"
                  sx={{ height: 20, fontSize: 11, color: BRAND.textMuted }}
                />
              </Box>
              <Typography
                variant="body2" color={BRAND.textSecondary}
                sx={{
                  fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap',
                  maxHeight: 150, overflow: 'hidden',
                  background: alpha(BRAND.bg, 0.5), borderRadius: 1, p: 1,
                }}
              >
                {r.content?.substring(0, 600)}
              </Typography>
              {r.metadata?.routes?.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {r.metadata.routes.map((route, ri) => (
                    <Chip key={ri} label={route} size="small" sx={{ height: 20, fontSize: 10, background: alpha(BRAND.success, 0.15), color: BRAND.success }} />
                  ))}
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      <Snackbar
        open={!!snackbar} autoHideDuration={4000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />
    </Box>
  );
}
