// Socket.io realtime layer (sdlcgames realtime/socket pattern).
// JWT handshake auth; each user joins room `user:<id>` and their org room
// `org:<orgId>`. Engines never touch `io` directly — they call the emit
// helpers, which are wired to the event bus in registerHandlers().
import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens';
import { logger } from '../utils/logger';

let io: IOServer | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new IOServer(httpServer, {
    cors: { origin: true, credentials: true }, // allow any origin, no restriction
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('unauthorized'));
    try {
      const p = verifyAccessToken(token);
      (socket as any).user = { id: p.sub, role: p.role, organizationId: p.organizationId };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    socket.join(`user:${user.id}`);
    if (user.organizationId) socket.join(`org:${user.organizationId}`);
    logger.debug({ userId: user.id }, 'socket connected');

    // The race client can subscribe to its live session channel.
    socket.on('game:subscribe', (sessionId: string) => socket.join(`session:${sessionId}`));
    socket.on('disconnect', () => logger.debug({ userId: user.id }, 'socket disconnected'));
  });

  logger.info('Socket.io initialised');
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToOrg(orgId: string, event: string, payload: unknown) {
  io?.to(`org:${orgId}`).emit(event, payload);
}

export function emitToSession(sessionId: string, event: string, payload: unknown) {
  io?.to(`session:${sessionId}`).emit(event, payload);
}
