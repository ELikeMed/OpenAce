/**
 * AceWidget — Drop-in chat widget for OpenAce.
 *
 * 3 display modes:
 *   "fab"    — Floating circle button (bottom corner) with spade logo. DEFAULT.
 *   "button" — Pill-shaped "Ask Ace" button. Place anywhere (header, sidebar, etc).
 *   "inline" — Chat panel renders directly inside a container. No floating.
 *
 * Usage:
 *   import { AceWidget } from '@openace/embed';
 *
 *   // Floating (default)
 *   <AceWidget serverUrl="/api/ace" />
 *
 *   // Button in header
 *   <nav>
 *     <AceWidget mode="button" serverUrl="/api/ace" theme="dark" />
 *   </nav>
 *
 *   // Inline panel in a sidebar
 *   <div style={{ width: 400, height: 600 }}>
 *     <AceWidget mode="inline" serverUrl="/api/ace" />
 *   </div>
 */
import React, { useState, useCallback } from 'react';
import { useAceChat } from './hooks/useAceChat.js';
import { useLicense } from './hooks/useLicense.js';
import { ChatWindow } from './components/ChatWindow.jsx';

// ── OpenAce Spade Logo (inline SVG — no external files) ──
export const AceLogo = ({ size = 28, color = 'currentColor', className = '' }) => (
  <svg
    viewBox="0 0 100 120"
    width={size}
    height={size}
    className={className}
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Spade shape */}
    <path d="M50 8 C50 8, 5 50, 5 72 C5 90, 20 98, 35 90 C42 86, 47 80, 50 72 C53 80, 58 86, 65 90 C80 98, 95 90, 95 72 C95 50, 50 8, 50 8Z" />
    {/* Stem */}
    <path d="M44 88 L44 112 C44 115, 46 116, 50 116 C54 116, 56 115, 56 112 L56 88 C54 90, 52 91, 50 91 C48 91, 46 90, 44 88Z" />
  </svg>
);

// ── Small icons ──
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function AceWidget({
  serverUrl = '/api/ace',
  authToken = '',
  mode = 'fab',
  position = 'bottom-right',
  theme = 'light',
  accentColor,
  greeting,
  buttonLabel = 'Ask Ace',
  conversationId = 'default',
}) {
  const [isOpen, setIsOpen] = useState(mode === 'inline');

  const {
    messages,
    isLoading,
    thinking,
    error,
    sendMessage,
    stopProcessing,
  } = useAceChat({ serverUrl, conversationId, authToken });

  const {
    license,
    showWatermark,
    showUpgrade,
  } = useLicense({ serverUrl, authToken });

  const handleQuestionSelect = useCallback((choice) => {
    sendMessage(choice);
  }, [sendMessage]);

  const themeClass = theme === 'dark' ? 'ace-dark' : '';
  const posClass = position === 'bottom-left' ? 'ace-bottom-left' : 'ace-bottom-right';

  // Inject CSS on first render (once)
  if (typeof document !== 'undefined' && !document.getElementById('ace-widget-styles')) {
    const style = document.createElement('style');
    style.id = 'ace-widget-styles';
    try {
      style.textContent = typeof __ACE_CSS__ !== 'undefined' ? __ACE_CSS__ : '';
    } catch { /* CSS loaded via separate file or <link> tag */ }
    document.head.appendChild(style);
  }

  const chatWindow = (
    <ChatWindow
      messages={messages}
      isLoading={isLoading}
      thinking={thinking}
      error={error}
      license={license}
      showWatermark={showWatermark}
      showUpgrade={showUpgrade}
      greeting={greeting}
      onSend={sendMessage}
      onStop={stopProcessing}
      onClose={mode === 'inline' ? null : () => setIsOpen(false)}
      onQuestionSelect={handleQuestionSelect}
      accentColor={accentColor}
    />
  );

  // ── MODE: inline — no floating, renders directly ──
  if (mode === 'inline') {
    return (
      <div className={`ace-widget ${themeClass} ace-inline`}>
        <div className="ace-inline-container">
          <div className="ace-chat-window ace-visible ace-inline-panel">
            {chatWindow}
          </div>
        </div>
      </div>
    );
  }

  // ── MODE: button — pill button placed anywhere ──
  if (mode === 'button') {
    return (
      <div className={`ace-widget ${themeClass} ace-button-mode`}>
        {/* Trigger button */}
        <button
          className="ace-trigger-btn"
          onClick={() => setIsOpen(!isOpen)}
          style={accentColor ? { background: accentColor } : undefined}
        >
          <AceLogo size={18} color="currentColor" />
          <span>{buttonLabel}</span>
        </button>

        {/* Popover chat window */}
        <div className={`ace-popover-anchor ${posClass}`}>
          <div className={`ace-chat-window ace-popover-window ${isOpen ? 'ace-visible' : ''}`}>
            {chatWindow}
          </div>
        </div>
      </div>
    );
  }

  // ── MODE: fab (default) — floating action button ──
  return (
    <div className={`ace-widget ${themeClass}`}>
      <div className={`ace-widget-container ${posClass}`}>
        {/* Chat Window */}
        <div className={`ace-chat-window ${isOpen ? 'ace-visible' : ''}`}>
          {chatWindow}
        </div>

        {/* FAB with OpenAce spade logo */}
        <button
          className={`ace-fab ${isOpen ? 'ace-open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close Ace' : 'Open Ace'}
          style={accentColor ? { '--ace-primary': accentColor, background: accentColor } : undefined}
        >
          <div className="ace-fab-inner">
            {isOpen ? (
              <CloseIcon />
            ) : (
              <AceLogo size={30} color="white" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
