
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

async function sendEmail(to, subject, html) {
  if (!to || !process.env.EMAIL_USER) return;
  await mailer.sendMail({
    from: `"Evryday Evrywhr Yoga" <${process.env.EMAIL_USER}>`,
    to, subject, html
  });
}

async function sendWhatsApp(to, body) {
  if (!to || !process.env.TWILIO_SID) return;
  await sms.messages.create({
    from: process.env.TWILIO_WHATSAPP,
    to: `whatsapp:${to}`,
    body
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slot_id, email, whatsapp, activity, session_date, session_time } = req.body;

  if (!email && !whatsapp) return res.status(400).json({ error: 'Email or WhatsApp required' });
  if (!activity)           return res.status(400).json({ error: 'Activity required' });

  // Check capacity
  if (slot_id) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot_id)
      .eq('session_date', session_date)
      .eq('status', 'confirmed');

    const { data: slot } = await supabase
      .from('slots').select('capacity').eq('id', slot_id).single();

    if (slot && count >= slot.capacity) {
      return res.status(409).json({ error: 'Slot is fully booked' });
    }
  }

  // Save booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert([{ slot_id, email, whatsapp, activity, session_date, session_time, status: 'confirmed', reminder_sent: false }])
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Send confirmation
  const html = `
    <h2>🐒 Session Confirmed!</h2>
    <p>Your <strong>${activity}</strong> session is booked for
       <strong>${session_date} at ${session_time}</strong>.</p>
    <p>You'll get a reminder 2 hours before. See you soon! 🧘</p>
    <p style="color:#999;font-size:12px">Booking ID: ${booking.id}</p>
  `;
  const msg = `🐒 Confirmed! "${activity}" on ${session_date} at ${session_time}. Reminder 2hrs before. See you! 🧘`;

  try {
    await sendEmail(email, '✅ Session Confirmed!', html);
    await sendWhatsApp(whatsapp, msg);

    // Notify admin
    await sendEmail(
      process.env.EMAIL_USER,
      `📅 New Booking: ${activity}`,
      `<p>New booking from ${email || whatsapp}<br>
       Activity: <strong>${activity}</strong><br>
       Date: ${session_date} at ${session_time}</p>`
    );
  } catch (e) {
    console.error('Notification error:', e.message);
  }

  res.json({ success: true, bookingId: booking.id });
}
