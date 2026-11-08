export function magicLinkEmail(link: string) {
  const text = `Sign in to Daywise\n\nClick the link below to sign in. It works once and expires in 15 minutes.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f2;font-family:Inter,Arial,sans-serif;color:#2b3042">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e8e6df" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Daywise</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#2b3042">Sign in to Daywise</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">Click the button to sign in. The link works once and expires in 15 minutes.</p>
<a href="${link}" style="display:inline-block;background:#2E3A8C;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">Sign in</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280">Or paste this link into your browser:<br><a href="${link}" style="color:#2E3A8C;word-break:break-all">${link}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:#6b7280">If you didn't request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: "Sign in to Daywise", html, text };
}
