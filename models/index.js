import pool from '../config/db.js';

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        oauth_provider VARCHAR(20),
        oauth_id VARCHAR(255),
        avatar VARCHAR(500) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS test_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        wpm INTEGER NOT NULL,
        raw_wpm INTEGER NOT NULL,
        accuracy DECIMAL(5,2) NOT NULL,
        errors INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        mode VARCHAR(30) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_results_wpm ON test_results(wpm DESC);
      CREATE INDEX IF NOT EXISTS idx_results_created ON test_results(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_results_user ON test_results(user_id);

      CREATE TABLE IF NOT EXISTS race_rooms (
        id SERIAL PRIMARY KEY,
        room_code VARCHAR(10) UNIQUE NOT NULL,
        host_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'waiting',
        mode VARCHAR(30) DEFAULT 'time_30',
        text_content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS race_participants (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES race_rooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        wpm INTEGER DEFAULT 0,
        accuracy DECIMAL(5,2) DEFAULT 0,
        position INTEGER DEFAULT 0,
        progress DECIMAL(5,2) DEFAULT 0,
        finished_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
