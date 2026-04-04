/**
 * ChatWindow — Message list + input area for the Ace widget.
 * Header features the OpenAce spade logo with branded text.
 */
import React, { useRef, useEffect, useState } from 'react';
import { Message } from './Message.jsx';
import { UpgradeBanner } from './UpgradeBanner.jsx';
import { AceLogo } from '../AceWidget.jsx';

// SVG icons as inline components (no icon library needed)
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export function ChatWindow({
  messages,
  isLoading,
  thinking,
  error,
  license,
  showWatermark,
  showUpgrade,
  greeting,
  onSend,
  onStop,
  onClose,
  onQuestionSelect,
  accentColor,
}) {
  const [input, setInput] = useState('');
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus input when window opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Dynamic accent color override
  const style = accentColor ? {
    '--ace-primary': accentColor,
    '--ace-primary-hover': accentColor,
    '--ace-bg-message-user': accentColor,
    '--ace-shadow-button': `0 4px 16px ${accentColor}66`,
  } : undefined;

  const wrapperStyle = {
    ...style,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  };

  return (
    <div style={wrapperStyle}>
      {/* ── Header with OpenAce branding ── */}
      <div className="ace-header">
        <div className="ace-header-left">
          <div className="ace-header-logo">
            <AceLogo size={24} color="white" />
          </div>
          <div className="ace-header-info">
            <h3>
              <span className="ace-header-open">Open</span><span className="ace-header-ace">Ace</span>
            </h3>
            <span>AI Executive Assistant</span>
          </div>
        </div>
        {onClose && (
          <button className="ace-header-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Upgrade banner */}
      {showUpgrade && <UpgradeBanner license={license} />}

      {/* Messages */}
      <div className="ace-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="ace-greeting">
            <div className="ace-greeting-logo">
              <AceLogo size={36} color="var(--ace-primary)" />
            </div>
            <h4>Hey, I'm Ace!</h4>
            <p>{greeting || "Your AI executive assistant. Ask me to research leads, send emails, analyze SEO, generate blog posts, and more."}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message
            key={i}
            message={msg}
            onQuestionSelect={(choice) => onQuestionSelect?.(choice)}
          />
        ))}

        {/* Thinking indicator */}
        {thinking && (
          <div className="ace-thinking">
            <div className="ace-thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span>{thinking}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="ace-message ace-message-ace">
            <div className="ace-bubble" style={{ color: '#ef4444' }}>
              Something went wrong: {error}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="ace-input-area">
        <div className="ace-input-wrapper">
          <textarea
            ref={inputRef}
            className="ace-input"
            placeholder="Ask Ace anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        {isLoading ? (
          <button className="ace-send-btn" onClick={onStop} title="Stop">
            <StopIcon />
          </button>
        ) : (
          <button
            className="ace-send-btn"
            onClick={handleSubmit}
            disabled={!input.trim()}
            title="Send"
          >
            <SendIcon />
          </button>
        )}
      </div>

      {/* Watermark */}
      {showWatermark && (
        <div className="ace-watermark">
          <a href="https://openaceai.com" target="_blank" rel="noopener noreferrer">
            <AceLogo size={10} color="currentColor" className="ace-watermark-logo" />
            Powered by OpenAce
          </a>
        </div>
      )}
    </div>
  );
}
