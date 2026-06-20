
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { data: recurring } = await supabase
    .from('slots')
    .select('*')
    .not('day_of_week', 'is', null)
    .eq('active', true);

  const { data: oneoffs } = await supabase
    .from('slots')
    .select('*')
    .is('day_of_week', null)
    .eq('active', true)
    .gte('date', new Date().toISOString().split('T')[0]);

  const slots = [];
  const today = new Date();

  // Expand recurring for next 28 days
  for (let d = 0; d < 28; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dow = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    for (const s of (recurring || [])) {
      if (s.day_of_week === dow) {
        const { count } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', s.id)
          .eq('session_date', dateStr)
          .eq('status', 'confirmed');

        if (count < s.capacity) {
          slots.push({ ...s, date: dateStr, type: 'recurring' });
        }
      }
    }
  }

  // Add one-offs
  for (const s of (oneoffs || [])) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', s.id)
      .eq('session_date', s.date)
      .eq('status', 'confirmed');

    if (count < s.capacity) {
      slots.push({ ...s, type: 'oneoff' });
    }
  }

  slots.sort((a, b) =>
    `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)
  );

  res.json(slots);
}
