/**
 * ToolChip — Shows which tools Ace used during a response.
 */
import React from 'react';
import { TOOL_LABELS } from '../../shared/constants.js';

const ICON_MAP = {
  search: '\u{1F50D}',
  web: '\u{1F310}',
  history: '\u{1F4C1}',
  memory: '\u{1F9E0}',
  email: '\u{2709}\uFE0F',
  sms: '\u{1F4AC}',
  phone: '\u{1F4DE}',
  people: '\u{1F465}',
  save: '\u{1F4BE}',
  pipeline: '\u{1F4CA}',
  move: '\u{27A1}\uFE0F',
  block: '\u{1F6AB}',
  contacts: '\u{1F4D1}',
  schedule: '\u{23F0}',
  target: '\u{1F3AF}',
  calendar: '\u{1F4C5}',
  social: '\u{1F4E3}',
  content: '\u{1F4DD}',
  media: '\u{1F5BC}\uFE0F',
  form: '\u{1F4CB}',
  code: '\u{1F4BB}',
  note: '\u{1F4CC}',
  database: '\u{1F5C4}\uFE0F',
  deploy: '\u{1F680}',
  seo: '\u{1F4C8}',
  blog: '\u{270D}\uFE0F',
};

export function ToolChip({ toolName }) {
  const info = TOOL_LABELS[toolName];
  if (!info) return null;

  const icon = ICON_MAP[info.icon] || '\u{2699}\uFE0F';

  return (
    <span className="ace-tool-chip">
      <span className="ace-tool-chip-icon">{icon}</span>
      {info.label}
    </span>
  );
}
