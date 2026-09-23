// Email clients do not load the web UI CSS. Use Tabler's card, type and button
// language as inline styles, with a table layout for broad email support.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function renderTablerEmail(subject, body) {
  const content = String(body ?? '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const inner = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(content)?.[1] ?? content;
  const title = escapeHtml(subject);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f5f9;color:#182433;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce1e7;border-radius:8px">
<tr><td style="padding:23px 30px;border-bottom:1px solid #dce1e7"><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#206bc4;margin-right:9px"></span><strong style="font-size:16px;color:#182433">Open Domains</strong><span style="float:right;color:#667382;font-size:12px">Rootminster</span></td></tr>
<tr><td style="padding:28px 30px;color:#182433;font-size:15px;line-height:1.6;overflow-wrap:anywhere"><h1 style="font-size:22px;line-height:1.3;margin:0 0 18px;color:#182433">${title}</h1>${inner}</td></tr>
<tr><td style="padding:20px 30px;border-top:1px solid #dce1e7;color:#667382;font-size:12px">Open Domains · Account and domain notifications</td></tr>
</table></td></tr></table></body></html>`;
}

export function emailPlainText(body) {
  return String(body ?? '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|tr|li)>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}
