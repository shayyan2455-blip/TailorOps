import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

serve(async (_req) => {
  const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
  const smtpUser = Deno.env.get('SMTP_USER') || ''
  const smtpPass = Deno.env.get('SMTP_PASS') || ''
  const smtpFrom = Deno.env.get('SMTP_FROM') || smtpUser

  if (!smtpUser || !smtpPass) {
    return new Response(JSON.stringify({ error: 'SMTP_USER and SMTP_PASS not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_get_pending_emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      return new Response(JSON.stringify({ error: `DB query failed: ${text}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    interface EmailNotification {
      id: string
      to_email: string
      subject: string
      body: string
    }

    const emails: EmailNotification[] = await response.json()
    const results: { id: string; sent: boolean; error?: string }[] = []

    for (const email of emails) {
      try {
        const client = new SmtpClient()
        await client.connectTLS({
          hostname: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
        })

        await client.send({
          from: smtpFrom,
          to: email.to_email,
          subject: email.subject,
          content: email.body,
        })

        await client.close()

        await fetch(`${supabaseUrl}/rest/v1/rpc/admin_mark_email_sent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ p_email_id: email.id }),
        })

        results.push({ id: email.id, sent: true })
      } catch (err) {
        results.push({ id: email.id, sent: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
