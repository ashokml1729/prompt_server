import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { period = 'all', mode } = req.query;
    const limit = parseInt(req.query.limit) || 100;

    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = "AND tr.created_at >= NOW() - INTERVAL '1 day'";
    } else if (period === 'weekly') {
      dateFilter = "AND tr.created_at >= NOW() - INTERVAL '7 days'";
    }

    let modeFilter = '';
    const params = [limit];
    if (mode) {
      modeFilter = `AND tr.mode = $2`;
      params.push(mode);
    }

    const result = await pool.query(
      `SELECT 
        tr.id, tr.wpm, tr.accuracy, tr.mode, tr.created_at,
        u.username, u.avatar, u.id as user_id
       FROM test_results tr
       JOIN users u ON tr.user_id = u.id
       WHERE 1=1 ${dateFilter} ${modeFilter}
       ORDER BY tr.wpm DESC
       LIMIT $1`,
      params
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
