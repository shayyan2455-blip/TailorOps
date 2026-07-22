export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { newPassword, accessToken } = req.body

  if (!newPassword || !accessToken) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      return res.status(response.status).json({ error: errBody.msg || errBody.error || 'Failed to change password' })
    }

    // ---- NEW BLOCK STARTS HERE ----
    // Get the authenticated user's own id from their token — never trust a client-supplied id
    const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    const whoBody = await whoRes.json()
    const userId = whoBody.id

    // Clear the flag using the service role key
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ must_change_password: false }),
    })
    // ---- NEW BLOCK ENDS HERE ----

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Change password failed:', err)
    return res.status(500).json({ error: err.message })
  }
}