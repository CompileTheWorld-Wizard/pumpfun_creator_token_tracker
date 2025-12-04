const API_BASE = '/api/stream';

async function request(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function startStream() {
  return request('/api/stream/start', {
    method: 'POST',
  });
}

export async function stopStream() {
  return request('/api/stream/stop', {
    method: 'POST',
  });
}

export async function getStreamStatus() {
  return request('/api/stream/status', {
    method: 'GET',
  });
}

