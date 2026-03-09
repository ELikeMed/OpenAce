import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatStream, executeActions } from '../api';
import './ChatPanel.css';

function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

// Very minimal markdown-ish rendering: code blocks and bold
function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return text;

  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const newlineIdx = inner.indexOf('\n');
      const lang = newlineIdx > 0 ? inner.slice(0, newlineIdx).trim() : '';
      const code = newlineIdx > 0 ? inner.slice(newlineIdx + 1) : inner;
      return (
        <pre key={i} className="chat-code-block">
          {lang && <div className="chat-code-lang">{lang}</div>}
          <code>{code}</code>
        </pre>
      );
    }
    // Bold: **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {boldParts.map((bp, j) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <strong key={j}>{bp.slice(2, -2)}</strong>;
          }
          // Preserve newlines
          return bp.split('\n').map((line, k, arr) => (
            <React.Fragment key={`${j}-${k}`}>
              {line}
              {k < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        })}
      </span>
    );
  });
}

// Confirmation card rendered below assistant messages that have pending pipeline actions
function PendingActionsCard({ actions, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => actions.map(() => true));
  const [assignees, setAssignees] = useState(() => actions.map(() => 'ace'));
  const [loading, setLoading] = useState(false);

  const toggleSelect = (i) => setSelected((s) => s.map((v, idx) => (idx === i ? !v : v)));
  const setAssignee = (i, val) => setAssignees((a) => a.map((v, idx) => (idx === i ? val : v)));

  const handleConfirm = async () => {
    setLoading(true);
    const confirmed = actions
      .filter((_, i) => selected[i])
      .map((action) => {
        const globalIdx = actions.indexOf(action);
        return { ...action, assigned_to: assignees[globalIdx] };
      });
    await onConfirm(confirmed);
  };

  const checkedCount = selected.filter(Boolean).length;

  return (
    <div className="pending-actions-card">
      <div className="pending-actions-header">
        <span className="pending-actions-icon">📋</span>
        <span>
          Ace wants to add <strong>{checkedCount}</strong> task{checkedCount !== 1 ? 's' : ''} to your pipeline:
        </span>
      </div>
      <div className="pending-actions-list">
        {actions.map((action, i) => (
          <div key={i} className={`pending-action-item${!selected[i] ? ' unchecked' : ''}`}>
            <input
              type="checkbox"
              checked={selected[i]}
              onChange={() => toggleSelect(i)}
              className="pending-action-check"
            />
            <div className="pending-action-info">
              <span className="pending-action-title">{action.title}</span>
              {action.priority && (
                <span className={`pending-action-priority priority-${action.priority}`}>
                  {action.priority}
                </span>
              )}
              {action.description && (
                <span className="pending-action-desc">{action.description}</span>
              )}
            </div>
            <select
              className="pending-action-assignee"
              value={assignees[i]}
              onChange={(e) => setAssignee(i, e.target.value)}
            >
              <option value="ace">Ace</option>
              <option value="me">Me</option>
              <option value="team">Team</option>
            </select>
          </div>
        ))}
      </div>
      <div className="pending-actions-footer">
        <button
          className="pending-actions-confirm"
          onClick={handleConfirm}
          disabled={loading || checkedCount === 0}
        >
          {loading ? 'Adding…' : `✅ Add ${checkedCount} to Pipeline`}
        </button>
        <button className="pending-actions-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ChatPanel({ project, onRefreshPreview, onProjectCreated, selectedElement, onClearSelectedElement }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const conversationId = useRef(generateId());
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const pendingActionsRef = useRef(null);
  const newProjectRef = useRef(null); // {name, type} when CodeAgent creates a project

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, thinkingText]);

  // Reset conversation when project changes
  useEffect(() => {
    conversationId.current = generateId();
    setMessages([]);
    setThinkingText('');
    setStreaming(false);
    if (abortRef.current) { abortRef.current(); abortRef.current = null; }
  }, [project?.name]);

  const handleConfirmActions = useCallback(async (msgIndex, confirmedActions) => {
    try {
      const result = await executeActions(confirmedActions);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex ? { ...m, actionsConfirmed: true, actionsResult: result } : m
        )
      );
    } catch (err) {
      console.error('Failed to execute actions:', err);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? { ...m, actionsConfirmed: true, actionsResult: { success: false, error: err.message } }
            : m
        )
      );
    }
  }, []);

  const handleCancelActions = useCallback((msgIndex) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, actionsConfirmed: true } : m))
    );
  }, []);

  const handleSend = useCallback(() => {
    let text = input.trim();
    if (!text || streaming) return;

    // Prepend element context if user selected something in the preview
    if (selectedElement) {
      text = `[ELEMENT: <${selectedElement.tag}> "${selectedElement.text}"] ${text}`;
      onClearSelectedElement?.();
    }

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setThinkingText('');
    pendingActionsRef.current = null;
    newProjectRef.current = null;

    let responseContent = '';

    const abort = chatStream(
      text,
      conversationId.current,
      project?.name || null,
      (event) => {
        switch (event.type) {
          case 'thinking':
            setThinkingText(event.content || '');
            break;
          case 'response': {
            // Extract text from the response object
            const resp = event.content;
            let msgText = '';
            if (typeof resp === 'string') {
              msgText = resp;
            } else if (resp?.message) {
              msgText = resp.message;
            } else if (resp?.response) {
              msgText = resp.response;
            } else if (resp?.data?.message) {
              msgText = resp.data.message;
            } else if (resp?.data?.summary) {
              msgText = resp.data.summary;
            } else {
              msgText = JSON.stringify(resp, null, 2);
            }
            responseContent = msgText;
            // Capture pending pipeline actions if any
            if (resp?.pendingActions && Array.isArray(resp.pendingActions) && resp.pendingActions.length > 0) {
              pendingActionsRef.current = resp.pendingActions;
            }
            // Detect if CodeAgent created a new project
            const createdName = resp?.data?.data?.projectName || resp?.data?.projectName;
            const createdType = resp?.data?.data?.projectType || resp?.data?.projectType;
            if (createdName) {
              newProjectRef.current = { name: createdName, type: createdType || 'project' };
            }
            break;
          }
          case 'error':
            responseContent = `⚠️ Error: ${event.content}`;
            break;
          default:
            break;
        }
      },
      () => {
        // Done
        setStreaming(false);
        setThinkingText('');
        if (responseContent) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: responseContent,
              ts: Date.now(),
              pendingActions: pendingActionsRef.current || null,
              actionsConfirmed: false,
            },
          ]);
          pendingActionsRef.current = null;
        }
        // If CodeAgent built a new project, notify parent to show it
        if (newProjectRef.current) {
          onProjectCreated?.(newProjectRef.current);
          newProjectRef.current = null;
        }
        // Auto-refresh preview after Ace responds
        onRefreshPreview?.();
      }
    );

    abortRef.current = abort;
  }, [input, streaming, project, onRefreshPreview, selectedElement, onClearSelectedElement]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">💬 Chat with Ace</span>
        {project && <span className="chat-project-ctx">{project.name}</span>}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !streaming && (
          <div className="chat-empty">
            {project
              ? `Ask Ace to modify "${project.name}" — e.g. "Add a contact form section"`
              : 'Select a project, then chat with Ace to build and modify it.'}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-bubble">
              {renderMarkdown(msg.content)}
            </div>
            {/* Confirmation card for assistant messages with pending pipeline actions */}
            {msg.role === 'assistant' && msg.pendingActions && !msg.actionsConfirmed && (
              <PendingActionsCard
                actions={msg.pendingActions}
                onConfirm={(confirmed) => handleConfirmActions(idx, confirmed)}
                onCancel={() => handleCancelActions(idx)}
              />
            )}
            {/* Success summary after confirmation */}
            {msg.role === 'assistant' && msg.actionsConfirmed && msg.actionsResult && (
              <div className="pending-actions-result">
                {msg.actionsResult.success
                  ? `✅ Added ${msg.actionsResult.results?.filter((r) => r.success).length || 0} item(s) to pipeline`
                  : `⚠️ ${msg.actionsResult.error || 'Some actions failed'}`}
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-bubble chat-thinking">
              <span className="thinking-dots">●●●</span>
              {thinkingText && <span className="thinking-text">{thinkingText}</span>}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {selectedElement && (
          <div className="selected-element-badge">
            <span className="selected-element-tag">&lt;{selectedElement.tag}&gt;</span>
            <span className="selected-element-text">
              {selectedElement.text.length > 60 ? selectedElement.text.substring(0, 60) + '…' : selectedElement.text}
            </span>
            <button className="selected-element-dismiss" onClick={onClearSelectedElement} title="Clear selection">✕</button>
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedElement ? 'Describe what to change…' : project ? `Ask Ace about ${project.name}…` : 'Select a project first…'}
            disabled={streaming}
            rows={2}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
