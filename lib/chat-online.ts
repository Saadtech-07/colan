/** In-memory presence registry (shared by Socket.IO server and REST APIs). */
const socketsByUser = new Map<string, Set<string>>();

export function registerChatSocket(userId: string, socketId: string): void {
  const existing = socketsByUser.get(userId) ?? new Set<string>();
  existing.add(socketId);
  socketsByUser.set(userId, existing);
}

export function unregisterChatSocket(userId: string, socketId: string): void {
  const existing = socketsByUser.get(userId);
  if (!existing) return;
  existing.delete(socketId);
  if (existing.size === 0) {
    socketsByUser.delete(userId);
  } else {
    socketsByUser.set(userId, existing);
  }
}

export function getOnlineUserIds(): Set<string> {
  return new Set(socketsByUser.keys());
}

export function isUserOnline(userId: string): boolean {
  return socketsByUser.has(userId);
}
