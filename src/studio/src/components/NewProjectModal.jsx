import React, { useState } from 'react';
import { createProject } from '../api';
import './NewProjectModal.css';

const TEMPLATES = [
  { type: 'landing-page', icon: '🎯', name: 'Landing Page', desc: 'Marketing landing page with hero, features, CTA' },
  { type: 'react-app',    icon: '⚛️', name: 'React App',    desc: 'Vite + React 18 with routing' },
  { type: 'react-native', icon: '📱', name: 'React Native', desc: 'Expo-based mobile app' },
  { type: 'next-app',     icon: '▲',  name: 'Next.js App',  desc: 'Next.js with pages and SSR' },
  { type: 'web-app',      icon: '🌐', name: 'Web App',      desc: 'Vanilla HTML/CSS/JS web app' },
  { type: 'widget',       icon: '🧩', name: 'Widget',       desc: 'Embeddable widget component' },
  { type: 'express-api',  icon: '🔌', name: 'Express API',  desc: 'Express.js REST API' },
  { type: 'fullstack',    icon: '🏗️', name: 'Full-Stack',   desc: 'Full-stack (React + Express)' },
  { type: 'static-site',  icon: '📄', name: 'Static Site',  desc: 'Simple static HTML site' },
];

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NewProjectModal({ onCreated, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const slug = slugify(name);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  const handleNext = () => {
    if (selectedTemplate) {
      setStep(2);
      setError('');
    }
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleCreate = async () => {
    if (!slug) { setError('Please enter a project name'); return; }
    setError('');
    setCreating(true);
    try {
      const result = await createProject(slug, selectedTemplate.type, description);
      onCreated?.({ name: slug, type: selectedTemplate.type, description, ...result });
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose?.();
    if (step === 2 && e.key === 'Enter' && !e.shiftKey && slug) handleCreate();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">New Project</h2>
          <span className="modal-step-indicator">Step {step} of 2</span>
        </div>

        {/* Step 1: Choose Template */}
        {step === 1 && (
          <div className="modal-step modal-step-1">
            <p className="modal-subtitle">Choose a template</p>
            <div className="template-grid">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.type}
                  className={`template-card${selectedTemplate?.type === tpl.type ? ' selected' : ''}`}
                  onClick={() => handleSelectTemplate(tpl)}
                  type="button"
                >
                  <span className="template-card-icon">{tpl.icon}</span>
                  <span className="template-card-name">{tpl.name}</span>
                  <span className="template-card-desc">{tpl.desc}</span>
                </button>
              ))}
            </div>

            {error && <div className="modal-error">{error}</div>}

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="modal-btn modal-btn-create"
                onClick={handleNext}
                disabled={!selectedTemplate}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Project Details */}
        {step === 2 && (
          <div className="modal-step modal-step-2">
            {/* Selected template summary */}
            <div className="selected-template-bar">
              <span className="selected-template-icon">{selectedTemplate.icon}</span>
              <span className="selected-template-name">{selectedTemplate.name}</span>
              <button className="modal-btn-change" onClick={handleBack} type="button">
                ← Change
              </button>
            </div>

            <label className="modal-label">
              Project Name
              <input
                className="modal-input"
                type="text"
                placeholder="My Awesome App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {slug && <span className="modal-slug-preview">Slug: {slug}</span>}
            </label>

            <label className="modal-label">
              Description <span className="modal-optional">(optional)</span>
              <textarea
                className="modal-textarea"
                placeholder="What is this project about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </label>

            {error && <div className="modal-error">{error}</div>}

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={handleBack} disabled={creating}>
                ← Back
              </button>
              <button
                className="modal-btn modal-btn-create"
                onClick={handleCreate}
                disabled={creating || !slug}
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
