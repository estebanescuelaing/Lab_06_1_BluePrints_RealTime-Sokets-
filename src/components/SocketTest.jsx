import { useEffect, useState } from 'react';
import socketService from '../services/socketService.js';

const TEST_ROOM = 'blueprints.Esteban.Casa';

function SocketTest() {
  const [status, setStatus] = useState('Desconectado');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const socket = socketService.connect();

    function handleConnect() {
      setStatus(`Conectado (${socket.id})`);
    }

    function handleDisconnect() {
      setStatus('Desconectado');
    }

    function handleBlueprintUpdate(payload) {
      console.log(
        '[SocketTest] blueprint-update recibido:',
        payload
      );

      setEvents((current) => [
        ...current,
        {
          type: 'blueprint-update',
          payload,
        },
      ]);
    }

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('blueprint-update', handleBlueprintUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('blueprint-update', handleBlueprintUpdate);
      socketService.disconnect();
    };
  }, []);

  function handleJoinRoom() {
    socketService.joinRoom(TEST_ROOM);

    setEvents((current) => [
      ...current,
      {
        type: 'join-room',
        room: TEST_ROOM,
      },
    ]);
  }

  function handleLeaveRoom() {
    socketService.leaveRoom(TEST_ROOM);

    setEvents((current) => [
      ...current,
      {
        type: 'leave-room',
        room: TEST_ROOM,
      },
    ]);
  }

  function handleDrawPoint() {
    socketService.drawPoint({
      room: TEST_ROOM,
      author: 'Esteban',
      name: 'Casa',
      point: {
        x: 120,
        y: 80,
      },
    });
  }

  return (
    <div className="container mt-4">
      <h2 className="h4">Prueba Socket.IO</h2>

      <p>
        Estado: <strong>{status}</strong>
      </p>

      <p>
        Room de prueba:
        <br />
        <code>{TEST_ROOM}</code>
      </p>

      <div className="d-flex gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleJoinRoom}
        >
          Unirse a room
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleLeaveRoom}
        >
          Salir de room
        </button>

        <button
          type="button"
          className="btn btn-success"
          onClick={handleDrawPoint}
        >
          Enviar punto
        </button>
      </div>

      <h3 className="h5">Eventos</h3>

      {events.length === 0 ? (
        <p className="text-muted">No hay eventos todavía.</p>
      ) : (
        <pre className="bg-light p-3 rounded">
          {JSON.stringify(events, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default SocketTest;