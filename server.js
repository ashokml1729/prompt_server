import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import pool from './config/db.js';
import { initDB } from './models/index.js';
import { setupSocketHandlers } from './socket/handler.js';

import authRoutes from './routes/auth.js';
import resultsRoutes from './routes/results.js';
import leaderboardRoutes from './routes/leaderboard.js';
import profileRoutes from './routes/profile.js';
import roomsRoutes from './routes/rooms.js';
import feedbackRoutes from './routes/feedback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Passport Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL: '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const username = profile.displayName.replace(/\s+/g, '_').toLowerCase().slice(0, 20);

        // Check if user exists
        let result = await pool.query(
          'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
          ['google', profile.id]
        );

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        // Check by email
        result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
          // Link Google to existing account
          await pool.query(
            'UPDATE users SET oauth_provider = $1, oauth_id = $2 WHERE id = $3',
            ['google', profile.id, result.rows[0].id]
          );
          return done(null, result.rows[0]);
        }

        // Create new user
        let uniqueUsername = username;
        let counter = 1;
        while (true) {
          const existing = await pool.query('SELECT id FROM users WHERE username = $1', [uniqueUsername]);
          if (existing.rows.length === 0) break;
          uniqueUsername = `${username}${counter}`;
          counter++;
        }

        result = await pool.query(
          'INSERT INTO users (username, email, oauth_provider, oauth_id, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [uniqueUsername, email, 'google', profile.id, profile.photos?.[0]?.value || '']
        );

        done(null, result.rows[0]);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
app.use(passport.initialize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/feedback', feedbackRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await initDB();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
