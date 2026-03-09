// API helper functions for Ace Studio
// All paths are relative — Vite proxy handles dev, same-origin handles prod.

export async function fetchProjects() {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  const data = await res.json();
  return data.data || data.projects || data;
}

export async function fetchFileTree(projectName) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/files`);
  if (!res.ok) throw new Error(`Failed to fetch file tree: ${res.status}`);
  const data = await res.json();
  return data.data || data.files || data;
}

export async function fetchFile(projectName, filePath) {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/file?path=${encodeURIComponent(filePath)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const data = await res.json();
  return data.data || data;
}

export async function updateFile(projectName, filePath, content) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) throw new Error(`Failed to update file: ${res.status}`);
  return res.json();
}

export async function createProject(name, type, description) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, description }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  return res.json();
}

export async function deleteProject(projectName) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`);
  return res.json();
}

export function downloadProject(name) {
  window.open(`/api/projects/${encodeURIComponent(name)}/download`, '_blank');
}

export async function openInVSCode(name) {
  const res = await fetch(`/api/projects/${encodeURIComponent(name)}/open-editor`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to open in VS Code: ${res.status}`);
  return res.json();
}

/**
 * Stream chat with Ace via SSE.
 * The server emits JSON lines prefixed with `data: `.
 * Event types: thinking, response, done, error.
 *
 * @param {string} message
 * @param {string} conversationId
 * @param {string|null} project — optional project name for Studio context
 * @param {(event: {type:string, content:any}) => void} onEvent  — called for every SSE event
 * @param {() => void} onDone — called when the stream is complete
 * @returns {() => void} abort function
 */
export function chatStream(message, conversationId, project, onEvent, onDone) {
  const controller = new AbortController();

  (async () => {
    try {
      const body = { message, conversationId };
      if (project) body.project = project;

      const res = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(trimmed.slice(6));
            onEvent(payload);
            if (payload.type === 'done' || payload.type === 'error') {
              onDone?.();
              return;
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
      onDone?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', content: err.message });
        onDone?.();
      }
    }
  })();

  return () => controller.abort();
}

export async function executeActions(actions) {
  const res = await fetch('/api/execute-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actions }),
  });
  if (!res.ok) throw new Error(`Failed to execute actions: ${res.status}`);
  return res.json();
}

// Deploy API functions

export async function getDeployTargets() {
  const res = await fetch('/api/deploy/targets');
  if (!res.ok) throw new Error(`Failed to fetch deploy targets: ${res.status}`);
  return res.json();
}

export async function deployProject(projectName, target, options = {}) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, options }),
  });
  if (!res.ok) throw new Error(`Failed to deploy project: ${res.status}`);
  return res.json();
}

export async function getDeployHistory(projectName) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/deploys`);
  if (!res.ok) throw new Error(`Failed to fetch deploy history: ${res.status}`);
  return res.json();
}

export async function fetchLastModified(projectName) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/lastModified`);
  if (!res.ok) throw new Error(`Failed to fetch lastModified: ${res.statusText}`);
  return res.json();
}

// Google Drive API functions

export async function getGoogleStatus() {
    const res = await fetch('/api/google/status');
    if (!res.ok) throw new Error(`Failed to get Google status: ${res.status}`);
    return res.json();
}

export async function getGoogleAuthUrl() {
    const res = await fetch('/api/google/auth-url');
    if (!res.ok) throw new Error(`Failed to get Google auth URL: ${res.status}`);
    return res.json();
}

export async function listGoogleDriveFiles(options) {
    const query = new URLSearchParams(options).toString();
    const res = await fetch(`/api/google/drive/files?${query}`);
    if (!res.ok) throw new Error(`Failed to list Google Drive files: ${res.status}`);
    return res.json();
}

export async function importFromGoogleDrive(folderId, fileIds) {
    const res = await fetch('/api/google/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, fileIds }),
    });
    if (!res.ok) throw new Error(`Failed to import from Google Drive: ${res.status}`);
    return res.json();
}

// Version history API functions

export async function getFileHistory(projectName, filePath) {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/history?path=${encodeURIComponent(filePath)}`
  );
  if (!res.ok) throw new Error(`Failed to get file history: ${res.status}`);
  const data = await res.json();
  return data.history; // array of { timestamp, size, relativePath }
}

export async function restoreFileVersion(projectName, filePath, timestamp) {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, timestamp }),
  });
  if (!res.ok) throw new Error(`Failed to restore file version: ${res.status}`);
  return res.json();
}
