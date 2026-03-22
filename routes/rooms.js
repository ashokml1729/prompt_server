import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mode = 'time_30', isPrivate = false, textContent } = req.body;
    let roomCode = generateRoomCode();

    // Ensure unique code
    let exists = true;
    while (exists) {
      const check = await pool.query('SELECT id FROM race_rooms WHERE room_code = $1', [roomCode]);
      if (check.rows.length === 0) exists = false;
      else roomCode = generateRoomCode();
    }

    const result = await pool.query(
      `INSERT INTO race_rooms (room_code, host_id, status, mode, text_content)
       VALUES ($1, $2, 'waiting', $3, $4)
       RETURNING *`,
      [roomCode, req.user.id, mode, textContent || null]
    );

    // Add host as participant
    await pool.query(
      'INSERT INTO race_participants (room_id, user_id) VALUES ($1, $2)',
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room by code
router.get('/:code', async (req, res) => {
  try {
    const room = await pool.query(
      'SELECT * FROM race_rooms WHERE room_code = $1',
      [req.params.code.toUpperCase()]
    );

    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const participants = await pool.query(
      `SELECT rp.*, u.username, u.avatar
       FROM race_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1`,
      [room.rows[0].id]
    );

    res.json({
      ...room.rows[0],
      participants: participants.rows,
    });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List public rooms
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username as host_username,
        (SELECT COUNT(*) FROM race_participants WHERE room_id = r.id) as player_count
       FROM race_rooms r
       JOIN users u ON r.host_id = u.id
       WHERE r.status = 'waiting'
       ORDER BY r.created_at DESC
       LIMIT 20`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
