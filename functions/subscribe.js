// Cloudflare Pages Function: POST /subscribe
// Captures an email, sends the PDF guide via Resend, notifies hello@.
// Expects env.RESEND_API_KEY to be set in Cloudflare Pages > Settings > Environment Variables.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    let email = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = (body.email || '').trim().toLowerCase();
    } else {
      const form = await request.formData();
      email = (form.get('email') || '').trim().toLowerCase();
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }

    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return json({ ok: false, error: 'Email service not configured.' }, 500);
    }

    const from = 'NutrientPairs <hello@nutrientpairs.com>';

    const deliveryRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        reply_to: 'hello@nutrientpairs.com',
        subject: 'Your free guide: The 10 Pairs Most People Are Getting Wrong',
        html: deliveryHtml(),
        text: deliveryText(),
      }),
    });

    if (!deliveryRes.ok) {
      const errText = await deliveryRes.text();
      console.error('Resend delivery failed:', deliveryRes.status, errText);
      return json({ ok: false, error: 'Could not send the guide right now. Please try again in a moment.' }, 502);
    }

    // Admin notification, fire and forget. Do not block the response on it.
    context.waitUntil(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: 'hello@nutrientpairs.com',
          subject: `New subscriber: ${email}`,
          text: `New Free Guide signup:\n\nEmail: ${email}\nTime:  ${new Date().toISOString()}\nIP:    ${request.headers.get('cf-connecting-ip') || 'unknown'}\nUA:    ${request.headers.get('user-agent') || 'unknown'}\n`,
        }),
      }).catch((err) => console.error('Admin notification failed:', err))
    );

    return json({ ok: true });
  } catch (err) {
    console.error('subscribe handler error:', err);
    return json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function deliveryHtml() {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f3ee;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d4cfc4;border-radius:4px;">
      <tr><td style="padding:32px 32px 8px 32px;">
        <div style="font-family:'DM Mono',Menlo,monospace;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#4a6741;">Your free guide</div>
        <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:26px;font-weight:700;color:#1a1a18;margin:8px 0 16px 0;line-height:1.2;">The 10 Pairs Most People Are Getting Wrong</h1>
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1a1a18;line-height:1.65;margin:0 0 24px 0;">Thanks for subscribing. Your guide covers the nutrient combinations with the biggest gap between how widely known they are and how often people actually take them together.</p>
        <p style="margin:0 0 28px 0;">
          <a href="https://nutrientpairs.com/nutrient-pairs-guide.pdf" style="background:#4a6741;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:500;display:inline-block;">Download the guide (PDF)</a>
        </p>
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a18;line-height:1.65;">
          <p style="margin:0 0 8px 0;font-weight:500;">A few of the 10:</p>
          <ul style="padding-left:20px;margin:0 0 20px 0;color:#7a7870;">
            <li style="margin-bottom:6px;">Why high-dose D3 alone may deposit calcium in the wrong places</li>
            <li style="margin-bottom:6px;">The "ignition switch" mineral that activates your D3 supplement</li>
            <li style="margin-bottom:6px;">The one nutrient that triples iron absorption (almost no prescription mentions it)</li>
            <li style="margin-bottom:6px;">The protective companion almost nobody taking NMN is told about</li>
          </ul>
        </div>
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#7a7870;line-height:1.65;margin:0 0 8px 0;">Want the pairs matched to your age, lifestyle, and goals? Try the <a href="https://nutrientpairs.com/explorer.html" style="color:#4a6741;text-decoration:underline;">Explorer</a>. More pair research at <a href="https://nutrientpairs.com" style="color:#4a6741;text-decoration:underline;">nutrientpairs.com</a>.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #d4cfc4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#7a7870;line-height:1.6;">
        NutrientPairs content is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider before starting any supplement regimen.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function deliveryText() {
  return `Your free guide is here.

Download "The 10 Pairs Most People Are Getting Wrong":
https://nutrientpairs.com/nutrient-pairs-guide.pdf

A few of the 10:
- Why high-dose D3 alone may deposit calcium in the wrong places
- The "ignition switch" mineral that activates your D3 supplement
- The one nutrient that triples iron absorption
- The protective companion almost nobody taking NMN is told about

Want the pairs matched to your age, lifestyle, and goals? Try the Explorer:
https://nutrientpairs.com/explorer.html

More pair research at nutrientpairs.com

---
NutrientPairs content is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider before starting any supplement regimen.
`;
}
