import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Payload {
  email: string
  full_name: string
  role: 'admin' | 'tailor'
  tailor_id?: string | null
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || (callerProfile.role !== 'owner' && callerProfile.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Only owners and admins can invite members' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }

    const { email, full_name, role, tailor_id }: Payload = await req.json()

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'email, full_name, and role are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    let targetUserId: string | null = null

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', callerProfile.tenant_id)
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'User already exists in this shop' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create auth user
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Ab1!'

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    targetUserId = newUser.user.id

    // Resolve tailor_id
    let resolvedTailorId: string | null = null

    if (role === 'tailor') {
      if (tailor_id && tailor_id !== '__new') {
        resolvedTailorId = tailor_id
      } else {
        // Create new tailor entry
        const { data: newTailor, error: tailorErr } = await supabase
          .from('tailors')
          .insert({
            tenant_id: callerProfile.tenant_id,
            name: full_name,
            active: true,
            invited: true,
          })
          .select('id')
          .single()

        if (tailorErr) {
          // Cleanup: delete the auth user we just created
          await supabase.auth.admin.deleteUser(targetUserId!)
          return new Response(JSON.stringify({ error: tailorErr.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }

        resolvedTailorId = newTailor.id
      }
    }

    // Create profile
    const profilePayload: Record<string, unknown> = {
      id: targetUserId!,
      tenant_id: callerProfile.tenant_id,
      full_name,
      email,
      role,
    }

    if (resolvedTailorId) {
      profilePayload.tailor_id = resolvedTailorId
    }

    const { error: profileErr } = await supabase.from('profiles').insert(profilePayload)

    if (profileErr) {
      // Cleanup auth user
      await supabase.auth.admin.deleteUser(targetUserId!)
      if (resolvedTailorId && !tailor_id) {
        await supabase.from('tailors').delete().eq('id', resolvedTailorId)
      }
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    // If linking to an existing tailor, mark as invited
    if (tailor_id && tailor_id !== '__new') {
      await supabase.from('tailors').update({ invited: true }).eq('id', tailor_id)
    }

    return new Response(JSON.stringify({
      message: 'Invitation sent',
      user_id: targetUserId,
      tailor_id: resolvedTailorId,
      temp_password: tempPassword,
    }), {
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
