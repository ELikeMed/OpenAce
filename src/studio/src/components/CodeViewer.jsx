import React, { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/atom-one-dark.css';
import './CodeViewer.css';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);

const EXT_TO_LANG = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.html': 'xml',
  '.htm': 'xml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

function detectLanguage(filename) {
  if (!filename) return 'javascript';
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return 'javascript';
  const ext = filename.slice(dot).toLowerCase();
  return EXT_TO_LANG[ext] || 'javascript';
}

export default function CodeViewer({ content, filename, language }) {
  const lang = language || detectLanguage(filename);

  const highlighted = useMemo(() => {
    if (!content) return '';
    try {
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      // Fallback: escape HTML and return plain text
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [content, lang]);

  const lines = useMemo(() => {
    if (!content) return [];
    return content.split('\n');
  }, [content]);

  if (!content) {
    return (
      <div className="code-viewer-container">
        <div className="code-viewer-empty">
          <div className="code-viewer-empty-icon">📝</div>
          <p>No file selected</p>
          <p className="code-viewer-empty-hint">Click a file in the sidebar to view its code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="code-viewer-container">
      <div className="code-viewer-header">
        <span className="code-viewer-file-icon">📄</span>
        <span className="code-viewer-filename">{filename || 'untitled'}</span>
        <span className="code-viewer-lang-badge">{lang}</span>
      </div>
      <div className="code-viewer-body">
        <div className="code-viewer-lines" aria-hidden="true">
          {lines.map((_, i) => (
            <div key={i} className="code-viewer-line-num">
              {i + 1}
            </div>
          ))}
        </div>
        <pre className="code-viewer-code">
          <code
            className={`hljs language-${lang}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  );
}
