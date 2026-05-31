const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  get:    (path)       => req('GET',    path),
  post:   (path, body) => req('POST',   path, body),
  patch:  (path, body) => req('PATCH',  path, body),
  delete: (path)       => req('DELETE', path),

  // For multipart/form-data uploads (browser sets Content-Type + boundary automatically)
  upload: async (path, formData) => {
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
