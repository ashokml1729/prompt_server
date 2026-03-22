import pool from '../config/db.js';

export function setupSocketHandlers(io) {
  const rooms = new Map(); // roomCode -> { players, text, status, countdown }

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', async ({ roomCode, user }) => {
      try {
        const roomResult = await pool.query(
          'SELECT * FROM race_rooms WHERE room_code = $1',
          [roomCode.toUpperCase()]
        );

        if (roomResult.rows.length === 0) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const room = roomResult.rows[0];
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = user.id;
        socket.username = user.username;

        // Track in memory
        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, {
            players: new Map(),
            text: room.text_content,
            status: room.status,
            hostId: room.host_id,
          });
        }

        const roomData = rooms.get(roomCode);
        roomData.players.set(socket.id, {
          id: user.id,
          username: user.username,
          avatar: user.avatar || '',
          progress: 0,
          wpm: 0,
          accuracy: 100,
          finished: false,
        });

        // Add to DB if not already
        const existingParticipant = await pool.query(
          'SELECT id FROM race_participants WHERE room_id = $1 AND user_id = $2',
          [room.id, user.id]
        );
        if (existingParticipant.rows.length === 0) {
          await pool.query(
            'INSERT INTO race_participants (room_id, user_id) VALUES ($1, $2)',
            [room.id, user.id]
          );
        }

        // Broadcast updated player list
        io.to(roomCode).emit('room-update', {
          players: Array.from(roomData.players.values()),
          status: roomData.status,
          hostId: roomData.hostId,
          text: roomData.text,
        });
      } catch (err) {
        console.error('Join room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('start-race', ({ roomCode, text }) => {
      const roomData = rooms.get(roomCode);
      if (!roomData) return;

      roomData.status = 'countdown';
      roomData.text = text;

      // Update DB
      pool.query(
        "UPDATE race_rooms SET status = 'racing', text_content = $1 WHERE room_code = $2",
        [text, roomCode]
      );

      io.to(roomCode).emit('race-countdown', { text });

      // 3-2-1 countdown
      let count = 3;
      const countdownInterval = setInterval(() => {
        io.to(roomCode).emit('countdown-tick', { count });
        count--;
        if (count < 0) {
          clearInterval(countdownInterval);
          roomData.status = 'racing';
          io.to(roomCode).emit('race-start', { text });
        }
      }, 1000);
    });

    socket.on('player-progress', ({ roomCode, progress, wpm, accuracy }) => {
      const roomData = rooms.get(roomCode);
      if (!roomData) return;

      const player = roomData.players.get(socket.id);
      if (player) {
        player.progress = progress;
        player.wpm = wpm;
        player.accuracy = accuracy;

        io.to(roomCode).emit('progress-update', {
          players: Array.from(roomData.players.values()),
        });
      }
    });

    socket.on('player-finished', async ({ roomCode, wpm, accuracy }) => {
      const roomData = rooms.get(roomCode);
      if (!roomData) return;

      const player = roomData.players.get(socket.id);
      if (player) {
        player.finished = true;
        player.progress = 100;
        player.wpm = wpm;
        player.accuracy = accuracy;

        // Calculate position
        const finishedCount = Array.from(roomData.players.values()).filter(
          (p) => p.finished
        ).length;
        player.position = finishedCount;

        // Update DB
        const roomResult = await pool.query(
          'SELECT id FROM race_rooms WHERE room_code = $1',
          [roomCode]
        );
        if (roomResult.rows.length > 0) {
          await pool.query(
            `UPDATE race_participants SET wpm = $1, accuracy = $2, position = $3, finished_at = NOW()
             WHERE room_id = $4 AND user_id = $5`,
            [wpm, accuracy, finishedCount, roomResult.rows[0].id, socket.userId]
          );
        }

        io.to(roomCode).emit('progress-update', {
          players: Array.from(roomData.players.values()),
        });

        // Check if all finished
        const allFinished = Array.from(roomData.players.values()).every(
          (p) => p.finished
        );
        if (allFinished) {
          roomData.status = 'finished';
          io.to(roomCode).emit('race-finished', {
            players: Array.from(roomData.players.values()),
          });

          await pool.query(
            "UPDATE race_rooms SET status = 'finished' WHERE room_code = $1",
            [roomCode]
          );
        }
      }
    });

    socket.on('disconnect', () => {
      if (socket.roomCode) {
        const roomData = rooms.get(socket.roomCode);
        if (roomData) {
          roomData.players.delete(socket.id);

          if (roomData.players.size === 0) {
            rooms.delete(socket.roomCode);
          } else {
            io.to(socket.roomCode).emit('room-update', {
              players: Array.from(roomData.players.values()),
              status: roomData.status,
              hostId: roomData.hostId,
              text: roomData.text,
            });
          }
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
