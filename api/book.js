import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS — must be first, before anything else
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body
  const body = req.body || {};
  const { email, whatsapp, activity, session_date, session_time, slot_id } = body;

  if (!email && !whatsapp) {
    return res.status(400).json({ error: 'Email or WhatsApp required' });
  }
  if (!activity) {
    return res.status(400).json({ error: 'Activity required' });
  }

  // Connect to Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Insert booking
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      slot_id:       slot_id || null,
      email:         email || null,
      whatsapp:      whatsapp || null,
      activity:      activity,
      session_date:  session_date || new Date().toISOString().split('T')[0],
      session_time:  session_time || '10:00',
      status:        'confirmed',
      reminder_sent: false
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, bookingId: data.id });
}
