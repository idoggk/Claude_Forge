/** Trigger a browser download for in-memory content. Nothing is uploaded anywhere. */
export function downloadBlob(blob: Blob, filename: string): void {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'download';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}
