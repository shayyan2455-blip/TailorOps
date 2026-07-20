// Supabase Edge Function — Process pending email notifications
//
// This function reads unsent emails from the `email_notifications` table
// and sends them via Resend. It can be triggered:
//   1. Manually:    supabase functions invoke process-emails
//   2. Via webhook: database webhook on email_notifications INSERT
//   3. Via cron:    pg_cron or a scheduled Vercel job
//
// Environment variables (set via `supabase secrets set`):
//   RESEND_API_KEY  — Resend API key
//   APP_URL         — frontend URL (default: https://tailorops.vercel.app)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface EmailNotification {
  id: string
  to_email: string
  subject: string
  body: string
}

serve(async (_req) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
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
    // Fetch pending emails from the database
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

    const emails: EmailNotification[] = await response.json()
    const results: { id: string; sent: boolean; error?: string }[] = []

    for (const email of emails) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'TailorOps <notifications@tailorops.com>',
            to: [email.to_email],
            subject: email.subject,
            text: email.body,
          }),
        })

        if (!resendRes.ok) {
          const errText = await resendRes.text()
          results.push({ id: email.id, sent: false, error: errText })
          continue
        }

        // Mark as sent
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
