import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, fullName, role, tempPassword, shopName } = req.body

  if (!email || !fullName || !role || !tempPassword) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase not configured (missing URL or SERVICE_ROLE_KEY)' })
  }

  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser
  const appUrl = process.env.APP_URL || 'https://tailorops.vercel.app'

  if (!smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP not configured' })
  }

  try {
    // 1. Create auth user via Supabase Admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      return res.status(400).json({ error: `Auth API error: ${errBody}` })
    }

    const authUser = await createRes.json()

    // 2. Create profile in public.profiles via the API
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        id: authUser.id,
        tenant_id: req.body.tenantId,
        full_name: fullName,
        role,
        tailor_id: req.body.tailorId || null,
      }),
    })

    if (!profileRes.ok) {
      // Rollback: delete the auth user we just created
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      })
      const errBody = await profileRes.text()
      return res.status(400).json({ error: `Profile API error: ${errBody}` })
    }

    // 3. Send invitation email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    })

    const body = [
      `Hi ${fullName},`,
      '',
      `You have been invited to join ${shopName || 'your shop'} on TailorOps.`,
      '',
      `Role: ${role}`,
      `Email: ${email}`,
      `Temporary password: ${tempPassword}`,
      '',
      `Sign in at: ${appUrl}`,
      '',
      'Please change your password after first login.',
      '',
      '—',
      'TailorOps',
    ].join('\n')

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: `You've been invited to TailorOps`,
      text: body,
    })

    return res.status(200).json({ sent: true, user_id: authUser.id })
  } catch (err) {
    console.error('Invite failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
