import React, { useState, useEffect } from 'react';
import { fetchProjects, fetchFileTree, deleteProject } from '../api';
import './Sidebar.css';

export default function Sidebar({ selectedProject, onSelectProject, onProjectDeleted, onFileSelect, refreshKey }) {
  const [projects, setProjects] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch projects
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProjects()
      .then((p) => { if (!cancelled) setProjects(Array.isArray(p) ? p : []); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Fetch file tree when project changes
  useEffect(() => {
    if (!selectedProject) { setFileTree([]); return; }
    let cancelled = false;
    setTreeLoading(true);
    setExpandedDirs(new Set());
    fetchFileTree(selectedProject.name)
      .then((t) => { if (!cancelled) setFileTree(Array.isArray(t) ? t : []); })
      .catch(() => { if (!cancelled) setFileTree([]); })
      .finally(() => { if (!cancelled) setTreeLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProject?.name]);

  const handleDelete = async (e, projectName) => {
    e.stopPropagation();
    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
    try {
      await deleteProject(projectName);
      onProjectDeleted?.();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const toggleDir = (dirPath) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  // Build a nested tree from flat file list
  const buildTree = (files) => {
    const root = {};
    for (const f of files) {
      const path = typeof f === 'string' ? f : f.path || f.name;
      const size = typeof f === 'object' ? f.size : undefined;
      const parts = path.split('/').filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          node[part] = { __file: true, __path: path, __size: size };
        } else {
          if (!node[part]) node[part] = {};
          node = node[part];
        }
      }
    }
    return root;
  };

  const formatSize = (bytes) => {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTree = (node, prefix = '') => {
    const entries = Object.entries(node).filter(([k]) => !k.startsWith('__'));
    // Sort: dirs first, then files
    entries.sort(([aKey, aVal], [bKey, bVal]) => {
      const aIsFile = aVal.__file;
      const bIsFile = bVal.__file;
      if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
      return aKey.localeCompare(bKey);
    });

    return entries.map(([name, val]) => {
      const fullPath = prefix ? `${prefix}/${name}` : name;
      if (val.__file) {
        const isSelected = selectedFile === val.__path;
        return (
          <div
            key={fullPath}
            className={`tree-file${isSelected ? ' tree-file-selected' : ''}`}
            onClick={() => {
              setSelectedFile(val.__path);
              onFileSelect?.(selectedProject?.name, val.__path);
            }}
          >
            <span className="tree-icon">📄</span>
            <span className="tree-name">{name}</span>
            {val.__size != null && <span className="tree-size">{formatSize(val.__size)}</span>}
          </div>
        );
      }
      const expanded = expandedDirs.has(fullPath);
      return (
        <div key={fullPath} className="tree-dir">
          <div className="tree-dir-header" onClick={() => toggleDir(fullPath)}>
            <span className="tree-icon">{expanded ? '📂' : '📁'}</span>
            <span className="tree-name">{name}</span>
            <span className="tree-arrow">{expanded ? '▾' : '▸'}</span>
          </div>
          {expanded && <div className="tree-children">{renderTree(val, fullPath)}</div>}
        </div>
      );
    });
  };

  const tree = buildTree(fileTree);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-heading">Projects</h3>
        {loading ? (
          <div className="sidebar-loading">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="sidebar-empty">No projects yet</div>
        ) : (
          <ul className="project-list">
            {projects.map((p) => {
              const name = typeof p === 'string' ? p : p.name;
              const type = typeof p === 'object' ? p.type : null;
              const fileCount = typeof p === 'object' ? p.fileCount || p.files : null;
              const isSelected = selectedProject?.name === name;
              return (
                <li
                  key={name}
                  className={`project-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectProject(typeof p === 'object' ? p : { name: p })}
                >
                  <div className="project-item-info">
                    <span className="project-item-name">{name}</span>
                    <div className="project-item-meta">
                      {type && <span className="project-item-type">{type}</span>}
                      {fileCount != null && <span className="project-item-files">{fileCount} files</span>}
                    </div>
                  </div>
                  <button
                    className="project-delete-btn"
                    title="Delete project"
                    onClick={(e) => handleDelete(e, name)}
                  >
                    🗑
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedProject && (
        <div className="sidebar-section file-tree-section">
          <h3 className="sidebar-heading">Files — {selectedProject.name}</h3>
          {treeLoading ? (
            <div className="sidebar-loading">Loading files…</div>
          ) : fileTree.length === 0 ? (
            <div className="sidebar-empty">No files</div>
          ) : (
            <div className="file-tree">{renderTree(tree)}</div>
          )}
        </div>
      )}
    </aside>
  );
}
