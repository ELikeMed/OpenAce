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

/**
 * Attach the JWT to every same-origin request, once, globally.
 *
 * The app has ~66 bare fetch() calls and none of them used authFetch, so the
 * token was never sent and every private route came back 401. Patching fetch
 * itself fixes all of them at once — including any added later.
 */
export function installAuthFetch() {
  if (typeof window === 'undefined' || window.__aceAuthFetchInstalled) return;
  window.__aceAuthFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
    if (!sameOrigin) return originalFetch(input, init);

    const token = getToken();
    const next = { ...init };

    if (token) {
      const headers = new Headers(
        init.headers || (typeof input !== 'string' ? input.headers : undefined)
      );
      // Don't clobber a call that set its own Authorization header
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      next.headers = headers;
    }

    // Keep the ace_sid cookie flowing so anonymous visitors keep their bucket
    if (!next.credentials) next.credentials = 'same-origin';

    return originalFetch(input, next);
  };
}
