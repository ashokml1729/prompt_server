# ⌨️ Prompt — Server

> Backend API for **Prompt**, a real-time multiplayer typing speed web application.  
> Built with **Node.js**, **Express**, **PostgreSQL**, and **Socket.io**.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [WebSocket Events](#-websocket-events)
- [Authentication Flow](#-authentication-flow)
- [Email Validation](#-email-validation)
- [Scripts](#-scripts)

---

## 🛠️ Tech Stack

| Package | Purpose |
|---------|---------|
| `express` | HTTP server & routing |
| `pg` | PostgreSQL client |
| `socket.io` | Real-time multiplayer communication |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT session management |
| `passport` + `passport-google-oauth20` | Google OAuth |
| `validator` | RFC-compliant email format validation |
| `resend` | Feedback email delivery |
| `dotenv` | Environment variable management |
| `cors` | Cross-origin request handling |
| `helmet` | HTTP security headers |
| `compression` | Gzip/Brotli response compression |

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- A [Resend](https://resend.com) account — for feedback emails
- A [Google Cloud](https://console.cloud.google.com) project — for OAuth

### 1. Navigate to server directory

```bash
cd server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Fill in all required values
```

### 4. Create the database

```bash
createdb prompt_db
```

### 5. Run database migrations

```bash
npm run migrate
```

### 6. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:3000`

---

## 🔑 Environment Variables

Create a `.env` file in the `/server` root:

```env
# ── Server ─────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── Database ────────────────────────────────────────
DATABASE_URL=postgresql://username:password@localhost:5432/prompt_db

# ── JWT ─────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# ── Google OAuth ────────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# ── Resend (Feedback Emails) ─────────────────────────
RESEND_API_KEY=your_resend_api_key
FEEDBACK_RECIPIENT_EMAIL=ashokbd369@gmail.com

# ── Frontend ─────────────────────────────────────────
CLIENT_URL=http://localhost:5173
```

---

## 📁 Project Structure

```
server/
├── index.js                    # Entry point — Express + Socket.io setup
├── .env.example                # Environment variable template
├── package.json
│
├── db/
│   ├── index.js                # PostgreSQL connection pool
│   └── migrations/
│       └── 001_init.sql        # Initial schema migration
│
├── routes/
│   ├── auth.js                 # Signup, login, OAuth routes
│   ├── tests.js                # Save & fetch test results
│   ├── race.js                 # Race room management
│   ├── leaderboard.js          # Global leaderboard
│   ├── profile.js              # User profile & stats
│   └── feedback.js             # Feedback email
│
├── controllers/
│   ├── authController.js
│   ├── testController.js
│   ├── raceController.js
│   ├── leaderboardController.js
│   ├── profileController.js
│   └── feedbackController.js
│
├── middleware/
│   ├── auth.js                 # JWT verification middleware
│   ├── validate.js             # Request body validation
│   └── errorHandler.js         # Global error handler
│
├── sockets/
│   └── raceSocket.js           # Socket.io race room events
│
└── utils/
    ├── emailValidator.js        # Format check + MX DNS record check
    ├── generateRoomCode.js      # Random room code generator
    └── sendFeedback.js          # Resend API helper
```

---

## 🗄️ Database Schema

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  oauth_provider VARCHAR(50),
  oauth_id      VARCHAR(255),
  avatar_url    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Test Results
CREATE TABLE test_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  wpm        INTEGER        NOT NULL,
  raw_wpm    INTEGER        NOT NULL,
  accuracy   DECIMAL(5,2)   NOT NULL,
  errors     INTEGER        DEFAULT 0,
  duration   INTEGER        NOT NULL,  -- seconds
  mode       VARCHAR(50)    NOT NULL,  -- 'time' | 'words' | 'quote' | 'custom'
  created_at TIMESTAMP      DEFAULT NOW()
);
CREATE INDEX idx_test_results_user_id ON test_results(user_id);
CREATE INDEX idx_test_results_wpm     ON test_results(wpm DESC);
CREATE INDEX idx_test_results_created ON test_results(created_at DESC);

-- Race Rooms
CREATE TABLE race_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code  VARCHAR(10) UNIQUE NOT NULL,
  host_id    UUID REFERENCES users(id),
  status     VARCHAR(20) DEFAULT 'waiting',  -- 'waiting' | 'racing' | 'finished'
  mode       VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Race Participants
CREATE TABLE race_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES race_rooms(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  wpm         INTEGER,
  accuracy    DECIMAL(5,2),
  position    INTEGER,
  finished_at TIMESTAMP
);

-- Feedback
CREATE TABLE feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  created_at TIMESTAMP    DEFAULT NOW()
);
```

---

## 📡 API Endpoints

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | ❌ | Register with email + password |
| POST | `/login` | ❌ | Login with email + password |
| GET | `/google` | ❌ | Initiate Google OAuth |
| GET | `/google/callback` | ❌ | Google OAuth callback |
| POST | `/logout` | ✅ | Logout / invalidate session |

**POST `/signup` — Request body:**
```json
{
  "username": "ashok123",
  "email": "user@example.com",
  "password": "StrongPass@123"
}
```

**POST `/login` — Request body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass@123"
}
```

---

### 📊 Tests — `/api/tests`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ | Save a completed test result |
| GET | `/history` | ✅ | Get current user's test history |

**POST `/` — Request body:**
```json
{
  "wpm": 87,
  "raw_wpm": 91,
  "accuracy": 95.6,
  "errors": 4,
  "duration": 60,
  "mode": "time"
}
```

---

### 🏆 Leaderboard — `/api/leaderboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ❌ | Get global leaderboard |

**Query Parameters:**

| Param | Values | Default |
|-------|--------|---------|
| `period` | `daily` \| `weekly` \| `alltime` | `alltime` |
| `mode` | `time` \| `words` \| `quote` | `time` |
| `limit` | number | `50` |

---

### 👤 Profile — `/api/profile`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/:username` | ❌ | Get public profile + stats |
| PUT | `/` | ✅ | Update username or avatar |

---

### 🏎️ Race — `/api/race`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/rooms` | ✅ | Create a new race room |
| GET | `/rooms` | ✅ | List public available rooms |
| GET | `/rooms/:code` | ✅ | Get room details by code |

---

### 💬 Feedback — `/api/feedback`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ❌ | Send feedback email via Resend |

**POST `/` — Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Great app! Would love a custom theme option."
}
```

---

## 🔌 WebSocket Events

Real-time multiplayer is handled via **Socket.io**.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomCode, userId }` | Join a race room |
| `leave_room` | `{ roomCode }` | Leave a race room |
| `typing_update` | `{ roomCode, wpm, progress }` | Send live typing progress |
| `race_finished` | `{ roomCode, wpm, accuracy }` | Notify race completion |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_update` | `{ participants }` | Updated participant list |
| `race_start` | `{ text, countdown }` | Race is starting |
| `participant_update` | `{ userId, wpm, progress }` | Another participant's live progress |
| `race_end` | `{ results }` | Final race results + rankings |
| `error` | `{ message }` | Error message |

---

## 🔐 Authentication Flow

### Email + Password

```
POST /api/auth/signup
  → Validate email format (regex)
  → Check MX DNS record (confirms domain exists)
  → Check email not already in DB
  → Hash password with bcrypt (rounds: 12)
  → Save user to DB
  → Return JWT

POST /api/auth/login
  → Find user by email
  → bcrypt.compare(enteredPassword, storedHash)
  → Return JWT if match
```

### Google OAuth

```
GET /api/auth/google
  → Redirect to Google consent screen

GET /api/auth/google/callback
  → Receive Google profile
  → Find or create user in DB
  → Return JWT
```

### Protected Routes

All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📧 Email Validation

Two layers of validation applied on every signup:

**Layer 1 — Format check** (via `validator` package):
```js
validator.isEmail(email) // RFC-compliant
```

**Layer 2 — MX Record DNS check** (via Node.js `dns` module):
```js
const records = await dns.promises.resolveMx(domain);
// Rejects if domain has no mail servers
```

> **Note:** A verification email is not sent on signup. Format + MX record checks are used to catch invalid or fake emails without requiring the user to verify.

---

## 📜 Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Start (prod) | `npm start` | Run server with Node |
| Start (dev) | `npm run dev` | Run with nodemon (auto-reload) |
| Migrate | `npm run migrate` | Run SQL migration files |
| Lint | `npm run lint` | Run ESLint |

---

## ⚡ Performance Notes

- **Gzip/Brotli compression** enabled via `compression` middleware
- **PostgreSQL indexes** on `wpm`, `user_id`, and `created_at` for fast leaderboard and history queries
- **Connection pooling** via `pg.Pool` — avoids per-request DB connections
- **Helmet** for secure HTTP headers out of the box
- Minimal dependency footprint — no unnecessary packages

---

<div align="center">
  <p>Part of the <strong>Prompt</strong> typing speed app</p>
  <p>⌨️ Type faster. Think sharper. <strong>Prompt.</strong></p>
</div>
