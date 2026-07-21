import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, fullName, role, tempPassword, shopName } = req.body

  if (!email || !fullName || !role || !tempPassword) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser
  const appUrl = process.env.APP_URL || 'https://tailorops.vercel.app'

  if (!smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP not configured' })
  }

  try {
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

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Email send failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
