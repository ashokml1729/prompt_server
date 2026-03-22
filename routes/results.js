import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Save test result
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { wpm, raw_wpm, accuracy, errors, duration, mode } = req.body;

    if (wpm == null || accuracy == null || duration == null || !mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO test_results (user_id, wpm, raw_wpm, accuracy, errors, duration, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, wpm, raw_wpm || wpm, accuracy, errors || 0, duration, mode]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's test history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT * FROM test_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
