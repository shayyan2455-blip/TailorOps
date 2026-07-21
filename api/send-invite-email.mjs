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

      // If duplicate email — use SQL RPC to clean up stale user (reliable,
      // unlike the Auth Admin list endpoint which may ignore filters).
      if (errBody.code === '23505') {
        // Delete stale auth user via RPC (handles FK cleanup internally)
        const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/force_remove_stale_auth_user`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_email: email }),
        })
        if (!rpcRes.ok) {
          const rpcErr = await rpcRes.text()
          console.error('force_remove_stale_auth_user RPC failed:', rpcErr)
          // Non-fatal — proceed even if RPC fails (e.g. function not deployed yet)
        } else {
          const removedId = await rpcRes.json()
          console.log('force_remove_stale_auth_user removed:', removedId)
        }

        // Create fresh auth user (with retry for ghost identities)
        let reCreateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
          }),
        })
        // If still 23505 after RPC cleanup, try one more time (ghost identity)
        if (!reCreateRes.ok) {
          const reErr = await reCreateRes.json().catch(() => ({}))
          if (reErr.code === '23505') {
            // Ghost identity — delete via Auth Admin API directly with a list endpoint that works
            const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?filter%5Bemail%5D=eq.${encodeURIComponent(email)}`, { headers })
            if (listRes.ok) {
              const listData = await listRes.json()
              const ghostUser = listData.users?.[0]
              if (ghostUser?.id) {
                await fetch(`${supabaseUrl}/auth/v1/admin/users/${ghostUser.id}`, { method: 'DELETE', headers })
              }
            }
            // Retry create
            reCreateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: { full_name: fullName, role },
              }),
            })
          }
        }
        if (!reCreateRes.ok) {
          const reErr = await reCreateRes.json().catch(() => ({}))
          console.error('Auth Admin RECREATE failed:', reCreateRes.status, reErr)
          return res.status(500).json({ error: `Failed to recreate user: ${reCreateRes.status} ${JSON.stringify(reErr)}` })
        }
        const reCreated = await reCreateRes.json()
        authUserId = reCreated.id
      } else {
        // Some other error
        return res.status(400).json({ error: `Auth API error: ${errBody.msg || errBody.error || JSON.stringify(errBody)}` })
      }
    }

    // 2. Upsert profile (handles orphaned users where profile was deleted)
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
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
