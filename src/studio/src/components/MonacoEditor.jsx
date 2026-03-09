import React, { useRef, useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './MonacoEditor.css';

const LANG_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.py': 'python',
  '.xml': 'xml',
  '.svg': 'xml',
};

function detectLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return 'plaintext';
  const ext = filePath.slice(dot).toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

function filenameFromPath(filePath) {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

export default function MonacoEditor({
  openFiles = [],
  activeFilePath,
  onTabSelect,
  onTabClose,
  onSave,
  onContentChange,
}) {
  const editorRef = useRef(null);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const activeFile = openFiles.find((f) => f.filePath === activeFilePath);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  // Handle content changes
  const handleEditorChange = useCallback(
    (value) => {
      if (activeFilePath && onContentChange) {
        onContentChange(activeFilePath, value);
      }
    },
    [activeFilePath, onContentChange]
  );

  // Ctrl+S / Cmd+S save handler
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!activeFile || !onSave) return;

        try {
          await onSave(activeFile.projectName, activeFile.filePath, activeFile.content);
          setSaveIndicator(true);
          setTimeout(() => setSaveIndicator(false), 2000);
        } catch (err) {
          console.error('Save failed:', err);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, onSave]);

  // Focus editor when active tab changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [activeFilePath]);

  if (openFiles.length === 0) {
    return (
      <div className="monaco-editor-container">
        <div className="monaco-empty-state">
          <span className="monaco-empty-icon">📄</span>
          <p>Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monaco-editor-container">
      {/* Tab Bar */}
      <div className="monaco-tab-bar">
        <div className="monaco-tabs-scroll">
          {openFiles.map((file) => {
            const isActive = file.filePath === activeFilePath;
            const isModified = file.content !== file.savedContent;
            return (
              <div
                key={file.filePath}
                className={`monaco-tab${isActive ? ' active' : ''}${isModified ? ' modified' : ''}`}
                onClick={() => onTabSelect(file.filePath)}
                title={file.filePath}
              >
                {isModified && <span className="monaco-tab-dot" />}
                <span className="monaco-tab-name">{filenameFromPath(file.filePath)}</span>
                <button
                  className="monaco-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(file.filePath);
                  }}
                  title="Close"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Indicator */}
      {saveIndicator && (
        <div className="monaco-save-indicator">Saved ✓</div>
      )}

      {/* Monaco Editor */}
      <div className="monaco-editor-wrapper">
        {activeFile && (
          <Editor
            key={activeFile.filePath}
            defaultValue={activeFile.content}
            language={activeFile.language || detectLanguage(activeFile.filePath)}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            onChange={handleEditorChange}
            options={{
              fontSize: 14,
              fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
              lineNumbers: 'on',
              minimap: { enabled: true },
              bracketPairColorization: { enabled: true },
              matchBrackets: 'always',
              autoIndent: 'full',
              wordWrap: 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 8 },
            }}
          />
        )}
      </div>
    </div>
  );
}
