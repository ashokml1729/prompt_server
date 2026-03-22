import { Router } from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get user profile with stats
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const userResult = await pool.query(
      'SELECT id, username, email, avatar, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_tests,
        COALESCE(ROUND(AVG(wpm)), 0) as avg_wpm,
        COALESCE(MAX(wpm), 0) as best_wpm,
        COALESCE(ROUND(AVG(accuracy)::numeric, 2), 0) as avg_accuracy
       FROM test_results WHERE user_id = $1`,
      [userId]
    );

    const recentResults = await pool.query(
      'SELECT * FROM test_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      stats: statsResult.rows[0],
      recentTests: recentResults.rows,
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3-20 characters' });
      }
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      paramCount++;
      updates.push(`username = $${paramCount}`);
      values.push(username);
    }

    if (avatar !== undefined) {
      paramCount++;
      updates.push(`avatar = $${paramCount}`);
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    paramCount++;
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, avatar, created_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
