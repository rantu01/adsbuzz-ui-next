const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
  });

  const contentType = res.headers.get('Content-Type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => '');
  }

  if (!res.ok) {
    const message = data?.message || (typeof data === 'string' && data) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/**
 * Uploads an image (base64 data URL or raw bytes) to the backend and returns
 * the publicly reachable URL. Used by the sale checkout flow to persist the
 * payment screenshot instead of embedding a large data URL in the invoice doc.
 */
export async function uploadScreenshot({ name = 'screenshot.png', data }) {
  if (!data) return '';
  const payload = {
    name,
    data: typeof data === 'string' && data.startsWith('data:') ? data : `data:image/png;base64,${data}`,
  };
  const result = await apiFetch('/api/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result?.url || '';
}
