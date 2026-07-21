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

  const headers = {
    'Content-Type': 'application/json',
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
  }

  try {
    let authUserId

    // 1. Try to create auth user — may fail if email already exists
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      }),
    })

    if (createRes.ok) {
      const created = await createRes.json()
      authUserId = created.id
    } else {
      const errBody = await createRes.json()

      // If duplicate email — find and reuse existing auth user
      if (errBody.code === '23505') {
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?filter[email]=eq.${encodeURIComponent(email)}`, { headers })
        if (!listRes.ok) {
          return res.status(500).json({ error: 'Failed to look up existing user' })
        }
        const list = await listRes.json()
        const existing = list.users?.[0]
        if (!existing) {
          return res.status(500).json({ error: 'Email claimed but user not found' })
        }

        authUserId = existing.id

        // Reset password
        const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
          }),
        })
        if (!updateRes.ok) {
          return res.status(500).json({ error: 'Failed to update existing user password' })
        }
      } else {
        // Some other error
        return res.status(400).json({ error: `Auth API error: ${errBody.msg || errBody.error || JSON.stringify(errBody)}` })
      }
    }

    // 2. Upsert profile (handles orphaned users where profile was deleted)
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        id: authUserId,
        tenant_id: req.body.tenantId,
        full_name: fullName,
        role,
        tailor_id: req.body.tailorId || null,
      }),
    })

    if (!profileRes.ok) {
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

    return res.status(200).json({ sent: true, user_id: authUserId })
  } catch (err) {
    console.error('Invite failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
