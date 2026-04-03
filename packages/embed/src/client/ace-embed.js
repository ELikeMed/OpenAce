/**
 * ace-embed.js — Vanilla JS entry point for script-tag usage.
 *
 * Usage:
 *   <script src="https://cdn.openaceai.com/ace-embed.min.js"></script>
 *   <script>
 *     OpenAce.init({ serverUrl: '/api/ace', theme: 'dark' });
 *   </script>
 *
 * Renders the widget into a Shadow DOM container to isolate styles
 * from the host page. Uses lightweight DOM manipulation (no React needed
 * at runtime — the rollup IIFE bundle includes Preact as React alias).
 */

import { AceWidget } from './AceWidget.jsx';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import cssText from './styles/ace-widget.css';

const CONTAINER_ID = 'openace-embed-root';

function init(config = {}) {
  if (document.getElementById(CONTAINER_ID)) {
    console.warn('[OpenAce] Widget already initialized');
    return;
  }

  // Create host container
  const host = document.createElement('div');
  host.id = CONTAINER_ID;
  host.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;inset:0;';
  document.body.appendChild(host);

  // Use Shadow DOM if available (style isolation from host page)
  let mountTarget;
  if (host.attachShadow) {
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow
    const style = document.createElement('style');
    style.textContent = typeof cssText === 'string' ? cssText : '';
    shadow.appendChild(style);

    // Mount point inside shadow
    mountTarget = document.createElement('div');
    mountTarget.style.cssText = 'pointer-events:auto;';
    shadow.appendChild(mountTarget);
  } else {
    // Fallback: inject into document
    const style = document.createElement('style');
    style.id = 'ace-embed-styles';
    style.textContent = typeof cssText === 'string' ? cssText : '';
    document.head.appendChild(style);
    mountTarget = host;
    host.style.pointerEvents = 'auto';
  }

  // Render widget
  const root = createRoot(mountTarget);
  root.render(createElement(AceWidget, {
    serverUrl: config.serverUrl || '/api/ace',
    authToken: config.authToken || '',
    mode: config.mode || 'fab',
    position: config.position || 'bottom-right',
    theme: config.theme || 'light',
    accentColor: config.accentColor,
    greeting: config.greeting,
    buttonLabel: config.buttonLabel || 'Ask Ace',
    conversationId: config.conversationId || 'default',
  }));

  return {
    destroy: () => {
      root.unmount();
      host.remove();
    }
  };
}

function destroy() {
  const host = document.getElementById(CONTAINER_ID);
  if (host) host.remove();
}

// Expose global
const OpenAce = { init, destroy, version: '1.0.0' };

if (typeof window !== 'undefined') {
  window.OpenAce = OpenAce;
}

export default OpenAce;
