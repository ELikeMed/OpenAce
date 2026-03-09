import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import './Preview.css';

// Script injected into preview iframe for Alt+Click element selection
const SELECTION_SCRIPT = `
(function() {
  if (window.__aceSelectionActive) return;
  window.__aceSelectionActive = true;

  let highlighted = null;
  const HIGHLIGHT_STYLE = '2px solid #7C6FE0';
  let originalOutline = '';

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      path += '.' + el.className.trim().split(/\\s+/).join('.');
    }
    return path;
  }

  // Show hover highlight on Alt+mouseover
  document.addEventListener('mouseover', function(e) {
    if (!e.altKey) return;
    if (highlighted && highlighted !== e.target) {
      highlighted.style.outline = originalOutline;
    }
    highlighted = e.target;
    originalOutline = highlighted.style.outline;
    highlighted.style.outline = HIGHLIGHT_STYLE;
  });

  document.addEventListener('mouseout', function(e) {
    if (highlighted === e.target) {
      highlighted.style.outline = originalOutline;
      highlighted = null;
    }
  });

  // Alt+Click to select element
  document.addEventListener('click', function(e) {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    const text = (el.textContent || '').trim().substring(0, 200);
    const tag = el.tagName.toLowerCase();
    const selector = getSelector(el);
    let outerSnippet = (el.outerHTML || '').substring(0, 500);

    // Clear highlight
    if (highlighted) {
      highlighted.style.outline = originalOutline;
    }

    // Persistent selection highlight
    el.style.outline = HIGHLIGHT_STYLE;
    highlighted = el;
    originalOutline = '';

    window.parent.postMessage({
      type: 'ace-element-selected',
      tag: tag,
      text: text,
      selector: selector,
      outerHTML: outerSnippet
    }, '*');
  }, true);
})();
`;

const Preview = forwardRef(function Preview({ project }, ref) {
  const iframeRef = useRef(null);
  const [iframeKey, setIframeKey] = useState(0);

  const previewUrl = project
    ? `/projects/${encodeURIComponent(project.name)}/${project.entryPoint || 'index.html'}`
    : null;

  // Inject selection script when iframe loads
  const handleIframeLoad = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentDocument) return;
      const script = iframe.contentDocument.createElement('script');
      script.textContent = SELECTION_SCRIPT;
      iframe.contentDocument.body.appendChild(script);
    } catch (e) {
      // Cross-origin or sandbox restriction — silently ignore
    }
  }, []);

  const refresh = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.location.reload();
        // Re-inject selection script after soft reload
        setTimeout(() => handleIframeLoad(), 300);
      } catch {
        // Fallback: remount if reload fails
        setIframeKey((k) => k + 1);
      }
    } else {
      setIframeKey((k) => k + 1);
    }
  }, [handleIframeLoad]);

  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  // Refresh when project changes
  useEffect(() => {
    if (project) setIframeKey((k) => k + 1);
  }, [project?.name]);

  const openInTab = () => {
    if (previewUrl) window.open(previewUrl, '_blank');
  };

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <span className="preview-label">
          {project ? `Preview — ${project.name}` : 'Preview'}
        </span>
        <div className="preview-actions">
          {project && (
            <span className="preview-hint">Hold Alt + Click to select an element</span>
          )}
          <button className="preview-btn" onClick={refresh} disabled={!project} title="Refresh Preview">
            ↻ Refresh
          </button>
          <button className="preview-btn" onClick={openInTab} disabled={!project} title="Open in new tab">
            ↗ Open
          </button>
        </div>
      </div>
      <div className="preview-content">
        {project && previewUrl ? (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            className="preview-iframe"
            src={previewUrl}
            title={`Preview: ${project.name}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={handleIframeLoad}
          />
        ) : (
          <div className="preview-placeholder">
            <div className="preview-placeholder-icon">🖥️</div>
            <p>Select a project to preview</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default Preview;
