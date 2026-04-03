/**
 * useAceChat — SSE streaming hook for the Ace embed widget.
 * Manages message state, streaming, and server communication.
 *
 * Auth: Sends `Authorization: Bearer <authToken>` on every request.
 * Without a valid token, the server returns 401.
 */
import { useState, useRef, useCallback } from 'react';

export function useAceChat({ serverUrl = '/api/ace', conversationId = 'default', authToken = '' }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [thinking, setThinking] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Build auth headers
  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    // Add user message immediately
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setThinking('Ace is thinking...');
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const baseUrl = serverUrl.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: text, conversationId }),
        signal: controller.signal,
      });

      // Handle auth failure
      if (res.status === 401) {
        setError('Unauthorized. You must be an admin to use Ace.');
        setThinking(null);
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'thinking') {
              setThinking(data.content);
            } else if (data.type === 'response') {
              const content = data.content || {};
              const aceMsg = {
                role: 'assistant',
                content: content.message || '',
                toolsUsed: content.toolsUsed || [],
                question: content.question || null,
                pendingActions: content.pendingActions || null,
                timestamp: new Date().toISOString(),
              };
              setMessages(prev => [...prev, aceMsg]);
              setThinking(null);
            } else if (data.type === 'error') {
              setError(data.content);
              setThinking(null);
            } else if (data.type === 'done') {
              setThinking(null);
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
      setThinking(null);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [serverUrl, conversationId, isLoading, getHeaders]);

  const stopProcessing = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    try {
      const baseUrl = serverUrl.replace(/\/$/, '');
      await fetch(`${baseUrl}/stop`, { method: 'POST', headers: getHeaders() });
    } catch { /* ignore */ }
    setIsLoading(false);
    setThinking(null);
  }, [serverUrl, getHeaders]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setThinking(null);
  }, []);

  return {
    messages,
    isLoading,
    thinking,
    error,
    sendMessage,
    stopProcessing,
    clearMessages,
  };
}
