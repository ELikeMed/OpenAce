/**
 * QuestionCard — Renders ACE_QUESTION interactive options.
 * When user clicks an option, it sends that choice as a new message.
 */
import React, { useState } from 'react';

export function QuestionCard({ question, onSelect }) {
  const [selected, setSelected] = useState(null);

  if (!question || !question.options || question.options.length === 0) return null;

  const handleSelect = (option, index) => {
    if (selected !== null) return; // already answered
    setSelected(index);
    if (onSelect) onSelect(option.label || option);
  };

  return (
    <div className="ace-question-card">
      {question.text && <p>{question.text}</p>}
      <div className="ace-question-options">
        {question.options.map((opt, i) => {
          const label = typeof opt === 'string' ? opt : opt.label;
          const isSelected = selected === i;
          return (
            <button
              key={i}
              className="ace-question-option"
              onClick={() => handleSelect(opt, i)}
              disabled={selected !== null}
              style={isSelected ? {
                borderColor: 'var(--ace-primary)',
                background: 'rgba(99, 102, 241, 0.1)',
              } : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
