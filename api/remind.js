
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const sms = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export default async function handler(req, res) {
  // Vercel cron sends GET requests
  if (req.method !== 'GET') return res.status(405).end();

  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2hrs from now

  // Find bookings starting in ~2 hours that haven't been reminded
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .eq('reminder_sent', false);

  let sent = 0;
  for (const b of (bookings || [])) {
    const sessionDT = new Date(`${b.session_date}T${b.session_time}`);
    const diff = sessionDT - now;
    // Send if between 1h45m and 2h15m from now
    if (diff > 105 * 60 * 1000 && diff < 135 * 60 * 1000) {
      const msg = `⏰ Reminder: your "${b.activity}" session starts in ~2 hours! See you soon 🧘`;
      const html = `<h3>⏰ Session Reminder</h3>
        <p>Your <strong>${b.activity}</strong> session starts in about 2 hours.</p>
        <p>See you soon! 🧘‍♀️</p>`;
      try {
        if (b.email)    await mailer.sendMail({ from: process.env.EMAIL_USER, to: b.email, subject: '⏰ Session Reminder', html });
        if (b.whatsapp) await sms.messages.create({ from: process.env.TWILIO_WHATSAPP, to: `whatsapp:${b.whatsapp}`, body: msg });
        await supabase.from('bookings').update({ reminder_sent: true }).eq('id', b.id);
        sent++;
      } catch (e) { console.error('Reminder fail:', e.message); }
    }
  }

  res.json({ success: true, remindersSent: sent });
}
