import { io } from 'socket.io-client';

const SOCKET_BASE_URL =
  import.meta.env.VITE_IO_BASE || 'http://localhost:3001';

let socket = null;

function connect() {
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_BASE_URL, {
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO] Conectado: ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Desconectado: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.IO] Error de conexión:', error.message);
    });
  } else {
    socket.connect();
  }

  return socket;
}

function disconnect() {
  if (socket) {
    socket.disconnect();
  }
}

function getSocket() {
  return socket;
}

function joinRoom(room) {
  const currentSocket = connect();
  currentSocket.emit('join-room', room);
}

function leaveRoom(room) {
  if (!socket) return;
  socket.emit('leave-room', room);
}

function drawPoint(payload) {
  const currentSocket = connect();
  currentSocket.emit('draw-event', payload);
}

/**
 * Evento recibido cuando el contenido de un blueprint
 * cambia dentro de una sala.
 */
function onBlueprintUpdate(callback) {
  const currentSocket = connect();

  currentSocket.on('blueprint-update', callback);

  return () => {
    currentSocket.off('blueprint-update', callback);
  };
}

/**
 * Evento global: se creó un blueprint.
 */
function onBlueprintCreated(callback) {
  const currentSocket = connect();

  currentSocket.on('blueprint-created', callback);

  return () => {
    currentSocket.off('blueprint-created', callback);
  };
}

/**
 * Evento global: se actualizó un blueprint.
 */
function onBlueprintUpdated(callback) {
  const currentSocket = connect();

  currentSocket.on('blueprint-updated', callback);

  return () => {
    currentSocket.off('blueprint-updated', callback);
  };
}

/**
 * Evento global: se eliminó un blueprint.
 */
function onBlueprintDeleted(callback) {
  const currentSocket = connect();

  currentSocket.on('blueprint-deleted', callback);

  return () => {
    currentSocket.off('blueprint-deleted', callback);
  };
}

function onConnect(callback) {
  const currentSocket = connect();

  currentSocket.on('connect', callback);

  return () => {
    currentSocket.off('connect', callback);
  };
}

function onDisconnect(callback) {
  const currentSocket = connect();

  currentSocket.on('disconnect', callback);

  return () => {
    currentSocket.off('disconnect', callback);
  };
}

export default {
  connect,
  disconnect,
  getSocket,
  joinRoom,
  leaveRoom,
  drawPoint,

  onBlueprintUpdate,
  onBlueprintCreated,
  onBlueprintUpdated,
  onBlueprintDeleted,

  onConnect,
  onDisconnect,
};
