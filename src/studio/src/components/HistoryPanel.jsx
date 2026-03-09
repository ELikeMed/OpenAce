import React, { useState, useEffect, useCallback } from 'react';
import { getFileHistory, restoreFileVersion } from '../api';
import './HistoryPanel.css';

/**
 * Format bytes into a human-readable string.
 */
function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Return a relative time label like "5 min ago", "2 hours ago", etc.
 */
function timeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

export default function HistoryPanel({ projectName, filePath, onRestore, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringTs, setRestoringTs] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!projectName || !filePath) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await getFileHistory(projectName, filePath);
      setHistory(entries || []);
    } catch (err) {
      setError(err.message);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [projectName, filePath]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRestore = useCallback(async (timestamp) => {
    setRestoringTs(timestamp);
    try {
      await restoreFileVersion(projectName, filePath, timestamp);
      onRestore?.();
    } catch (err) {
      console.error('Restore failed:', err);
      setError(`Restore failed: ${err.message}`);
    } finally {
      setRestoringTs(null);
    }
  }, [projectName, filePath, onRestore]);

  return (
    <div className="history-panel-overlay">
      <div className="history-panel-header">
        <h3>🕐 Version History</h3>
        <button className="history-panel-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <div className="history-panel-filepath" title={filePath}>
        {filePath}
      </div>

      <div className="history-panel-body">
        {loading && (
          <div className="history-loading">
            <div className="spinner" />
            <span>Loading history…</span>
          </div>
        )}

        {error && !loading && (
          <div className="history-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="history-empty">
            <span className="history-empty-icon">📭</span>
            <span>No version history</span>
          </div>
        )}

        {!loading && !error && history.map((entry) => (
          <div className="history-entry" key={entry.timestamp}>
            <div className="history-entry-top">
              <span className="history-entry-time">{timeAgo(entry.timestamp)}</span>
              <span className="history-entry-size">{formatSize(entry.size)}</span>
            </div>
            <div className="history-entry-date">
              {new Date(entry.timestamp).toLocaleString()}
            </div>
            <div className="history-entry-actions">
              <button
                className={`history-btn-restore${restoringTs === entry.timestamp ? ' restoring' : ''}`}
                disabled={restoringTs != null}
                onClick={() => handleRestore(entry.timestamp)}
              >
                {restoringTs === entry.timestamp ? 'Restoring…' : '↩ Restore'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
