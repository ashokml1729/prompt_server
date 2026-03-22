import { Router } from 'express';
import pool from '../config/db.js';
import { sendFeedbackEmail } from '../utils/email.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Save to DB
    await pool.query(
      'INSERT INTO feedback (name, email, message) VALUES ($1, $2, $3)',
      [name, email, message]
    );

    // Send email
    try {
      await sendFeedbackEmail({ name, email, message });
    } catch (emailErr) {
      console.error('Email send error (feedback saved):', emailErr);
    }

    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
