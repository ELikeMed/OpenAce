/**
 * Auth helpers for cloud mode.
 * Wraps fetch() to attach JWT tokens automatically.
 * In local mode, behaves like normal fetch.
 */

export function getToken() {
  return localStorage.getItem('ace_token');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('ace_user') || 'null');
  } catch { return null; }
}

export function isAuthenticated() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('ace_token');
  localStorage.removeItem('ace_user');
  window.location.reload();
}

/**
 * Fetch wrapper that attaches the JWT token if available.
 * Drop-in replacement for fetch() in cloud mode.
 */
export function authFetch(url, options = {}) {
  const token = getToken();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return fetch(url, options);
}
