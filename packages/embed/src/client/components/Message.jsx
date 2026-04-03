/**
 * Message — Single chat message bubble with markdown rendering and tool chips.
 */
import React, { useMemo } from 'react';
import { ToolChip } from './ToolChip.jsx';
import { QuestionCard } from './QuestionCard.jsx';

/**
 * Lightweight markdown → HTML (no dependencies).
 * Handles: bold, italic, code, code blocks, links, headings, lists, blockquotes.
 */
function renderMarkdown(text) {
  if (!text) return '';

  let html = text;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.startsWith('<ul>')) return `<ul>${match}</ul>`;
    return match;
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n+/g, '</p><p>');
  // Single newlines → <br> (except inside pre/code)
  html = html.replace(/(?<!\>)\n(?!\<)/g, '<br>');

  // Wrap in <p> if not already block
  if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<blockquote')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function Message({ message, onQuestionSelect }) {
  const isUser = message.role === 'user';
  const htmlContent = useMemo(() => renderMarkdown(message.content), [message.content]);

  return (
    <div className={`ace-message ace-message-${isUser ? 'user' : 'ace'}`}>
      <div
        className="ace-bubble"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Tool chips */}
      {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
        <div className="ace-tool-chips">
          {message.toolsUsed.map((tool, i) => (
            <ToolChip key={i} toolName={tool} />
          ))}
        </div>
      )}

      {/* Interactive question */}
      {!isUser && message.question && (
        <QuestionCard
          question={message.question}
          onSelect={onQuestionSelect}
        />
      )}
    </div>
  );
}
