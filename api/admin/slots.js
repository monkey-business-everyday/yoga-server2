
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function checkAdmin(req, res) {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAdmin(req, res)) return;

  if (req.method === 'POST') {
    const { day_of_week, start_time, date, activity, capacity } = req.body;
    const { data, error } = await supabase
      .from('slots')
      .insert([{ day_of_week: day_of_week ?? null, start_time, date: date || null, activity, capacity: capacity || 1 }])
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await supabase.from('slots').update({ active: false }).eq('id', id);
    return res.json({ success: true });
  }

  res.status(405).end();
}
