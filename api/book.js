import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slot_id, email, whatsapp, activity, session_date, session_time } = req.body;

  if (!email && !whatsapp) return res.status(400).json({ error: 'Email or WhatsApp required' });
  if (!activity)           return res.status(400).json({ error: 'Activity required' });

  try {
    // Check capacity if slot_id provided
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
      .insert([{
        slot_id:      slot_id || null,
        email:        email || null,
        whatsapp:     whatsapp || null,
        activity,
        session_date: session_date || new Date().toISOString().split('T')[0],
        session_time: session_time || '10:00',
        status:       'confirmed',
        reminder_sent: false
      }])
      .select().single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, bookingId: booking.id });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
