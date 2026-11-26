const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escape text for HTML element content and quoted attributes. Falsy values
// render as an empty string.
export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}
