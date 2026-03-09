import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Preview from './components/Preview';
import ChatPanel from './components/ChatPanel';
import CodeViewer from './components/CodeViewer';
import MonacoEditor from './components/MonacoEditor';
import NewProjectModal from './components/NewProjectModal';
import DeployPanel from './components/DeployPanel';
import HistoryPanel from './components/HistoryPanel';
import GoogleDriveImporter from './components/GoogleDriveImporter';
import BusinessProfileWizard from './components/BusinessProfileWizard';
import KanbanBoard from './components/KanbanBoard';
import { fetchFile, downloadProject, openInVSCode, updateFile, fetchLastModified } from './api';
import { eventBus, EVENTS } from '../../core/events/EventBus';

const LANG_MAP = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.json': 'json',
  '.md': 'markdown', '.markdown': 'markdown', '.py': 'python',
  '.xml': 'xml', '.svg': 'xml',
};

export default function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const previewRef = useRef(null);
  const [vscodeStatus, setVscodeStatus] = useState(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGoogleDriveImporter, setShowGoogleDriveImporter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBusinessProfileWizard, setShowBusinessProfileWizard] = useState(false);
  const lastModifiedRef = useRef(0);
  const pollIntervalRef = useRef(null);

  // View mode state
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code' | 'split' | 'pipeline'
  const [isAutonomous, setIsAutonomous] = useState(false);

  // Click-to-select element from preview
  const [selectedElement, setSelectedElement] = useState(null);

  // Multi-file tab state (replaces single-file selectedFileContent / selectedFileName)
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState(null);

  // Derive selected file info for any legacy references
  const activeFile = openFiles.find((f) => f.filePath === activeFilePath);
  const selectedFileContent = activeFile?.content || null;
  const selectedFileName = activeFile?.filePath || null;

  // Clear open files when project changes
  useEffect(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, [selectedProject?.name]);

  const handleSelectProject = useCallback((project) => {
    setSelectedProject(project);
  }, []);

  const handleProjectCreated = useCallback((project) => {
    setShowNewProject(false);
    setProjectRefreshKey((k) => k + 1);
    setSelectedProject(project);
  }, []);

  const handleProjectDeleted = useCallback(() => {
    setSelectedProject(null);
    setProjectRefreshKey((k) => k + 1);
  }, []);

  // Called by ChatPanel when CodeAgent creates a new project via chat
  const handleChatProjectCreated = useCallback(({ name, type }) => {
    setProjectRefreshKey((k) => k + 1);   // refresh sidebar project list
    setSelectedProject({ name, type });    // auto-select the new project
    setViewMode('preview');               // switch to preview mode
  }, []);

  const lastRefreshRef = useRef(0);
  const refreshPreview = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return; // debounce 1s
    lastRefreshRef.current = now;
    setRefreshing(true);
    previewRef.current?.refresh();
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Refresh open file contents from disk (e.g., after Ace edits files via chat)
  const refreshOpenFiles = useCallback(async () => {
    if (!selectedProject || openFiles.length === 0) return;
    const updated = await Promise.all(
      openFiles.map(async (f) => {
        // Only refresh files that haven't been locally modified by the user
        if (f.content !== f.savedContent) return f;
        try {
          const response = await fetchFile(f.projectName, f.filePath);
          const newContent = response.content;
          if (newContent !== undefined && newContent !== f.content) {
            return { ...f, content: newContent, savedContent: newContent };
          }
        } catch { /* ignore fetch errors */ }
        return f;
      })
    );
    setOpenFiles(updated);
  }, [openFiles, selectedProject]);

  const handleRefreshPreview = useCallback(() => {
    refreshPreview();
    refreshOpenFiles(); // Also refresh editor tabs when preview refreshes
  }, [refreshPreview, refreshOpenFiles]);

  const handleDownloadZip = useCallback(() => {
    if (selectedProject) {
      downloadProject(selectedProject.name);
    }
  }, [selectedProject]);

  const handleOpenInVSCode = useCallback(async () => {
    if (!selectedProject) return;
    try {
      await openInVSCode(selectedProject.name);
      setVscodeStatus('Opened in VS Code');
    } catch (err) {
      setVscodeStatus(`Error: ${err.message}`);
    }
    setTimeout(() => setVscodeStatus(null), 3000);
  }, [selectedProject]);

  // File selection handler — opens file in a tab (or activates existing tab)
  const handleFileSelect = useCallback(async (projectName, filePath) => {
    try {
      // Check if file is already open
      const existing = openFiles.find((f) => f.filePath === filePath);
      if (existing) {
        setActiveFilePath(filePath);
        setViewMode((prev) => (prev === 'preview' ? 'split' : prev));
        return;
      }

      const response = await fetchFile(projectName, filePath);
      const dot = filePath.lastIndexOf('.');
      const ext = dot !== -1 ? filePath.slice(dot).toLowerCase() : '';

      setOpenFiles((prev) => [
        ...prev,
        {
          filePath,
          content: response.content,
          savedContent: response.content,
          language: LANG_MAP[ext] || 'plaintext',
          projectName,
        },
      ]);
      setActiveFilePath(filePath);
      setViewMode((prev) => (prev === 'preview' ? 'split' : prev));
    } catch (err) {
      console.error('Failed to fetch file:', err);
    }
  }, [openFiles]);

  // Tab operations
  const handleTabSelect = useCallback((filePath) => {
    setActiveFilePath(filePath);
  }, []);

  const handleTabClose = useCallback((filePath) => {
    setOpenFiles((prev) => prev.filter((f) => f.filePath !== filePath));
    setActiveFilePath((prev) => {
      if (prev === filePath) {
        const remaining = openFiles.filter((f) => f.filePath !== filePath);
        return remaining.length > 0 ? remaining[remaining.length - 1].filePath : null;
      }
      return prev;
    });
  }, [openFiles]);

  const handleContentChange = useCallback((filePath, newContent) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.filePath === filePath ? { ...f, content: newContent } : f))
    );
  }, []);

  const handleSaveFile = useCallback(async (projectName, filePath, content) => {
    await updateFile(projectName, filePath, content);
    setOpenFiles((prev) =>
      prev.map((f) => (f.filePath === filePath ? { ...f, savedContent: content } : f))
    );
    // Auto-refresh preview after save
    refreshPreview();
  }, [refreshPreview]);

  // Poll for external changes (e.g. Ace via Telegram edits)
  useEffect(() => {
    if (!selectedProject) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    // Initial fetch of lastModified
    fetchLastModified(selectedProject.name)
      .then(data => { lastModifiedRef.current = data.lastModified; })
      .catch(() => {});

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await fetchLastModified(selectedProject.name);
        if (data.lastModified > lastModifiedRef.current) {
          lastModifiedRef.current = data.lastModified;
          refreshPreview();
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedProject?.name, refreshPreview]);

  // Keyboard shortcuts: Ctrl+1 → preview, Ctrl+2 → code, Ctrl+3 → split
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      switch (e.key) {
        case '1':
          e.preventDefault();
          setViewMode('preview');
          break;
        case '2':
          e.preventDefault();
          setViewMode('code');
          break;
        case '3':
          e.preventDefault();
          setViewMode('split');
          break;
          case '4':
          e.preventDefault();
          setViewMode('pipeline');
          break;
          default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for element selection from preview iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'ace-element-selected') {
        setSelectedElement({
          tag: e.data.tag,
          text: e.data.text,
          selector: e.data.selector,
          outerHTML: e.data.outerHTML,
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const clearSelectedElement = useCallback(() => setSelectedElement(null), []);

  useEffect(() => {
    const handleBrainThinking = () => setIsAutonomous(true);
    const handleBrainThoughtComplete = () => setIsAutonomous(false);

    eventBus.on(EVENTS.BRAIN_THINKING, handleBrainThinking);
    eventBus.on(EVENTS.BRAIN_THOUGHT_COMPLETE, handleBrainThoughtComplete);

    return () => {
      eventBus.off(EVENTS.BRAIN_THINKING, handleBrainThinking);
      eventBus.off(EVENTS.BRAIN_THOUGHT_COMPLETE, handleBrainThoughtComplete);
    };
  }, []);

  return (
    <div className="studio-app">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <h1 className="brand">Ace Studio</h1>
        </div>
        <div className="top-bar-center">
          {selectedProject ? (
            <span className="project-name-display">
              <span className="project-type-badge">{selectedProject.type || 'project'}</span>
              {selectedProject.name}
            </span>
          ) : (
            <span className="no-project-hint">No project selected</span>
          )}
        </div>
        <div className="top-bar-right">
          {isAutonomous && <span className="autonomous-badge">Autonomous</span>}
          <button className="btn-action" onClick={() => setIsAutonomous(!isAutonomous)}>
            {isAutonomous ? 'Disengage' : 'Engage'} Autonomous Mode
          </button>
          {selectedProject && (
            <>
              <button className="btn-action btn-download" onClick={handleDownloadZip} title="Download as ZIP">
                📥 Download ZIP
              </button>
              <button className="btn-action btn-vscode" onClick={handleOpenInVSCode} title="Open in VS Code">
                💻 Open in VS Code
              </button>
              <button className="btn-action btn-deploy" onClick={() => setShowDeploy(true)} title="Deploy Project">
                🚀 Deploy
              </button>
              {vscodeStatus && <span className="vscode-status">{vscodeStatus}</span>}
            </>
          )}
          <button className="btn-new-project" onClick={() => setShowNewProject(true)}>
            + New Project
          </button>
          <button className="btn-action" onClick={() => setShowGoogleDriveImporter(true)}>
          Import from Google Drive
          </button>
          <button className="btn-action" onClick={() => setShowBusinessProfileWizard(true)}>
          Business Profile
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="panels">
        <Sidebar
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onProjectDeleted={handleProjectDeleted}
          onFileSelect={handleFileSelect}
          refreshKey={projectRefreshKey}
        />

        <div className="center-panel">
          {/* View mode toolbar */}
          <div className="view-toolbar">
            <button
              className={`view-toolbar-btn${viewMode === 'preview' ? ' active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Preview (Ctrl+1)"
            >
              🖥️ Preview
            </button>
            <button
              className={`view-toolbar-btn${viewMode === 'code' ? ' active' : ''}`}
              onClick={() => setViewMode('code')}
              title="Code (Ctrl+2)"
            >
              📝 Code
            </button>
            <button
              className={`view-toolbar-btn${viewMode === 'split' ? ' active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split (Ctrl+3)"
            >
              ⬛ Split
              </button>
              <button
              className={`view-toolbar-btn${viewMode === 'pipeline' ? ' active' : ''}`}
              onClick={() => setViewMode('pipeline')}
              title="Pipeline (Ctrl+4)"
              >
              📊 Pipeline
              </button>
              {activeFilePath && (
              <button
              className={`view-toolbar-btn${showHistory ? ' active' : ''}`}
              onClick={() => setShowHistory((v) => !v)}
              title="Version History"
              >
              🕐 History
              </button>
              )}
              </div>

          {refreshing && (
            <div className="refresh-indicator">🔄 Refreshing...</div>
          )}

          {/* View content based on mode */}
          {viewMode === 'preview' && (
            <div className="view-content">
            <Preview ref={previewRef} project={selectedProject} />
            </div>
            )}
            
            {viewMode === 'code' && (
            <div className="view-content">
            <MonacoEditor
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onSave={handleSaveFile}
            onContentChange={handleContentChange}
            />
            </div>
            )}
            
            {viewMode === 'split' && (
            <div className="view-content split-view">
            <div className="split-top">
            <Preview ref={previewRef} project={selectedProject} />
            </div>
            <div className="split-bottom">
            <MonacoEditor
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onSave={handleSaveFile}
            onContentChange={handleContentChange}
            />
            </div>
            </div>
            )}
            
            {viewMode === 'pipeline' && (
            <div className="view-content">
            <KanbanBoard />
            </div>
            )}
            
            {showHistory && activeFilePath && selectedProject && (
            <HistoryPanel
              projectName={selectedProject.name}
              filePath={activeFilePath}
              onRestore={async () => {
                setShowHistory(false);
                // Re-fetch the file content to update the editor
                try {
                  const response = await fetchFile(selectedProject.name, activeFilePath);
                  setOpenFiles((prev) =>
                    prev.map((f) =>
                      f.filePath === activeFilePath
                        ? { ...f, content: response.content, savedContent: response.content }
                        : f
                    )
                  );
                  refreshPreview();
                } catch (err) {
                  console.error('Failed to refresh file after restore:', err);
                }
              }}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>

        <ChatPanel
          project={selectedProject}
          onRefreshPreview={handleRefreshPreview}
          onProjectCreated={handleChatProjectCreated}
          selectedElement={selectedElement}
          onClearSelectedElement={clearSelectedElement}
        />
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal
          onCreated={handleProjectCreated}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {showDeploy && selectedProject && (
        <DeployPanel
          projectName={selectedProject.name}
          onClose={() => setShowDeploy(false)}
        />
      )}

      <GoogleDriveImporter
        show={showGoogleDriveImporter}
        onClose={() => setShowGoogleDriveImporter(false)}
        />
        {showBusinessProfileWizard && (
        <BusinessProfileWizard
        onComplete={() => setShowBusinessProfileWizard(false)}
        />
        )}
        </div>
        );
        }
