import { createServer } from 'node:http';
import { Server } from 'socket.io';

const PORT = 3001;
const FRONTEND_ORIGIN = 'http://localhost:5173';

/*
 * ============================================================
 * ESTADO COMPARTIDO EN MEMORIA
 * ============================================================
 *
 * Esta estructura es la única fuente de verdad del backend.
 *
 * Se pierde cuando reiniciamos el servidor.
 *
 * Estructura:
 *
 * blueprints
 *   └── author
 *        └── name
 *             ├── name
 *             └── points
 */

const blueprints = new Map();

function blueprintKey(author, name) {
  return `${author}::${name}`;
}

function clonePoints(points = []) {
  return points.map((point) => ({
    x: point.x,
    y: point.y,
  }));
}

function cloneBlueprint(author, blueprint) {
  return {
    author,
    name: blueprint.name,
    points: clonePoints(blueprint.points),
  };
}

function saveBlueprint(author, blueprint) {
  blueprints.set(
    blueprintKey(author, blueprint.name),
    {
      name: blueprint.name,
      points: clonePoints(blueprint.points),
    }
  );
}

function getBlueprint(author, name) {
  const blueprint = blueprints.get(blueprintKey(author, name));

  if (!blueprint) {
    return null;
  }

  return cloneBlueprint(author, blueprint);
}

function getAllBlueprints() {
  return Array.from(blueprints.entries()).map(([key, blueprint]) => {
    const [author] = key.split('::');

    return cloneBlueprint(author, blueprint);
  });
}

function getBlueprintsByAuthor(author) {
  return Array.from(blueprints.entries())
    .filter(([key]) => key.startsWith(`${author}::`))
    .map(([key, blueprint]) => {
      const [blueprintAuthor] = key.split('::');

      return cloneBlueprint(blueprintAuthor, blueprint);
    });
}

/*
 * ============================================================
 * DATOS INICIALES
 * ============================================================
 *
 * Son los mismos datos que teníamos en apiMock.js.
 */

saveBlueprint('jmiranda', {
  name: 'plano-a',
  points: [
    { x: 30, y: 30 },
    { x: 120, y: 60 },
    { x: 180, y: 140 },
    { x: 260, y: 90 },
  ],
});

saveBlueprint('jmiranda', {
  name: 'plano-b',
  points: [
    { x: 40, y: 200 },
    { x: 90, y: 250 },
    { x: 160, y: 220 },
    { x: 220, y: 260 },
    { x: 300, y: 200 },
  ],
});

saveBlueprint('agomez', {
  name: 'casa-1',
  points: [
    { x: 20, y: 20 },
    { x: 200, y: 20 },
    { x: 200, y: 150 },
    { x: 20, y: 150 },
    { x: 20, y: 20 },
  ],
});

/*
 * ============================================================
 * HTTP SERVER
 * ============================================================
 */

const httpServer = createServer(async (request, response) => {
  /*
   * CORS
   */
  response.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  /*
   * Preflight CORS
   */
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(
    request.url,
    `http://${request.headers.host || `localhost:${PORT}`}`
  );


  // ------------------------------------------------------------
  // GET /health
  // Health check básico del servicio
  // ------------------------------------------------------------
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'blueprints-realtime',
      blueprints: blueprints.size,
    });
    return;
  }

  /*
   * ------------------------------------------------------------
   * GET /api/blueprints
   * GET /api/blueprints?author=agomez
   * ------------------------------------------------------------
   */

  if (request.method === 'GET' && url.pathname === '/api/blueprints') {
    const author = url.searchParams.get('author');

    const result = author
      ? getBlueprintsByAuthor(author)
      : getAllBlueprints();

    sendJson(response, 200, result);
    return;
  }

  /*
   * ------------------------------------------------------------
   * GET /api/blueprints/:author/:name
   * ------------------------------------------------------------
   */

  const blueprintMatch = url.pathname.match(
    /^\/api\/blueprints\/([^/]+)\/([^/]+)$/
  );

  if (request.method === 'GET' && blueprintMatch) {
    const author = decodeURIComponent(blueprintMatch[1]);
    const name = decodeURIComponent(blueprintMatch[2]);

    const blueprint = getBlueprint(author, name);

    if (!blueprint) {
      sendJson(response, 404, {
        error: `Blueprint "${name}" de "${author}" no encontrado`,
      });
      return;
    }

    sendJson(response, 200, blueprint);
    return;
  }

  /*
   * ------------------------------------------------------------
   * POST /api/blueprints
   * ------------------------------------------------------------
   */

  if (request.method === 'POST' && url.pathname === '/api/blueprints') {
    try {
      const body = await readJsonBody(request);

      const { author, name, points = [] } = body;

      if (
        typeof author !== 'string' ||
        !author.trim() ||
        typeof name !== 'string' ||
        !name.trim() ||
        !Array.isArray(points)
      ) {
        sendJson(response, 400, {
          error: 'author, name y points son obligatorios y válidos',
        });
        return;
      }

      const key = blueprintKey(author, name);

      if (blueprints.has(key)) {
        sendJson(response, 409, {
          error: `Blueprint "${name}" de "${author}" ya existe`,
        });
        return;
      }

      const blueprint = {
        name,
        points: clonePoints(points),
      };

      saveBlueprint(author, blueprint);

      const created = cloneBlueprint(author, blueprint);

      /*
       * Notificar a todos los clientes conectados.
       */
      io.emit('blueprint-created', created);

      console.log(
        `[REST] Blueprint creado: ${author}/${name}`
      );

      sendJson(response, 201, created);
      return;
    } catch (error) {
      console.error('[REST] Error creando blueprint:', error);

      sendJson(response, 400, {
        error: 'JSON inválido',
      });

      return;
    }
  }

  /*
   * ------------------------------------------------------------
   * PUT /api/blueprints/:author/:name
   * ------------------------------------------------------------
   */

  if (request.method === 'PUT' && blueprintMatch) {
    try {
      const author = decodeURIComponent(blueprintMatch[1]);
      const name = decodeURIComponent(blueprintMatch[2]);

      const existing = getBlueprint(author, name);

      if (!existing) {
        sendJson(response, 404, {
          error: `Blueprint "${name}" de "${author}" no encontrado`,
        });
        return;
      }

      const body = await readJsonBody(request);

      const points = body.points;

      if (!Array.isArray(points)) {
        sendJson(response, 400, {
          error: 'points debe ser un arreglo',
        });
        return;
      }

      const updated = {
        name,
        points: clonePoints(points),
      };

      saveBlueprint(author, updated);

      const result = cloneBlueprint(author, updated);

      /*
       * Notificar a todos los clientes.
       */
      io.emit('blueprint-updated', result);

      /*
       * Si hay clientes dentro de la room específica,
       * también reciben la actualización del canvas.
       */
      io.to(roomFor(author, name)).emit('blueprint-update', result);

      console.log(
        `[REST] Blueprint actualizado: ${author}/${name}`
      );

      sendJson(response, 200, result);
      return;
    } catch (error) {
      console.error('[REST] Error actualizando blueprint:', error);

      sendJson(response, 400, {
        error: 'JSON inválido',
      });

      return;
    }
  }

  /*
   * ------------------------------------------------------------
   * DELETE /api/blueprints/:author/:name
   * ------------------------------------------------------------
   */

  if (request.method === 'DELETE' && blueprintMatch) {
    const author = decodeURIComponent(blueprintMatch[1]);
    const name = decodeURIComponent(blueprintMatch[2]);

    const key = blueprintKey(author, name);

    if (!blueprints.has(key)) {
      sendJson(response, 404, {
        error: `Blueprint "${name}" de "${author}" no encontrado`,
      });
      return;
    }

    blueprints.delete(key);

    const deleted = {
      author,
      name,
    };

    /*
     * Notificar a todos los clientes.
     */
    io.emit('blueprint-deleted', deleted);

    console.log(
      `[REST] Blueprint eliminado: ${author}/${name}`
    );

    sendJson(response, 200, deleted);
    return;
  }

  /*
   * ------------------------------------------------------------
   * Ruta no encontrada
   * ------------------------------------------------------------
   */

  sendJson(response, 404, {
    error: 'Ruta no encontrada',
  });
});

/*
 * ============================================================
 * SOCKET.IO
 * ============================================================
 */

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

/*
 * Convención de rooms:
 *
 * blueprints.{author}.{name}
 */

function roomFor(author, name) {
  return `blueprints.${author}.${name}`;
}

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Cliente conectado: ${socket.id}`);

  /*
   * ----------------------------------------------------------
   * JOIN ROOM
   * ----------------------------------------------------------
   */

  socket.on('join-room', (room) => {
    if (!room || typeof room !== 'string') {
      console.log(
        `[Socket.IO] Room inválida recibida de ${socket.id}`
      );
      return;
    }

    socket.join(room);

    console.log(
      `[Socket.IO] ${socket.id} se unió a la room: ${room}`
    );

    /*
     * Intentamos obtener el blueprint correspondiente.
     *
     * Room:
     * blueprints.agomez.casa-1
     */

    const match = room.match(/^blueprints\.([^.]*)\.(.+)$/);

    if (!match) {
      return;
    }

    const author = match[1];
    const name = match[2];

    const blueprint = getBlueprint(author, name);

    if (!blueprint) {
      console.log(
        `[Socket.IO] Blueprint no encontrado para room: ${room}`
      );
      return;
    }

    /*
     * El cliente que acaba de entrar recibe inmediatamente
     * el estado actual del servidor.
     */

    socket.emit('blueprint-update', blueprint);

    console.log(
      `[Socket.IO] Estado inicial enviado a ${socket.id}: ${author}/${name}`
    );
  });

  /*
   * ----------------------------------------------------------
   * LEAVE ROOM
   * ----------------------------------------------------------
   */

  socket.on('leave-room', (room) => {
    if (!room || typeof room !== 'string') {
      return;
    }

    socket.leave(room);

    console.log(
      `[Socket.IO] ${socket.id} salió de la room: ${room}`
    );
  });

  /*
   * ----------------------------------------------------------
   * DRAW EVENT
   * ----------------------------------------------------------
   *
   * Este evento modifica directamente el estado compartido.
   */

  socket.on('draw-event', (payload) => {
    console.log('[Socket.IO] draw-event recibido:', payload);

    if (!payload || typeof payload !== 'object') {
      console.log('[Socket.IO] Payload inválido');
      return;
    }

    const { room, author, name, point } = payload;

    if (
      typeof room !== 'string' ||
      typeof author !== 'string' ||
      typeof name !== 'string' ||
      !point ||
      typeof point.x !== 'number' ||
      typeof point.y !== 'number'
    ) {
      console.log(
        '[Socket.IO] Payload de draw-event incompleto'
      );
      return;
    }

    const key = blueprintKey(author, name);
    const blueprint = blueprints.get(key);

    if (!blueprint) {
      console.log(
        `[Socket.IO] No existe ${author}/${name}`
      );
      return;
    }

    /*
     * Agregar el nuevo punto al estado compartido.
     */

    blueprint.points.push({
      x: point.x,
      y: point.y,
    });

    const updated = cloneBlueprint(author, blueprint);

    console.log(
      `[Socket.IO] Blueprint actualizado por dibujo: ${author}/${name}`
    );

    /*
     * Todos los clientes de la room reciben el nuevo estado.
     */

    io.to(room).emit('blueprint-update', updated);

    /*
     * También notificamos el cambio general.
     *
     * Esto permitirá actualizar tablas/listados en otros clientes.
     */

    io.emit('blueprint-updated', updated);
  });

  /*
   * ----------------------------------------------------------
   * DISCONNECT
   * ----------------------------------------------------------
   */

  socket.on('disconnect', (reason) => {
    console.log(
      `[Socket.IO] Cliente desconectado: ${socket.id} (${reason})`
    );
  });
});

/*
 * ============================================================
 * HELPERS HTTP
 * ============================================================
 */

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });

  response.end(JSON.stringify(data));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

/*
 * ============================================================
 * START SERVER
 * ============================================================
 */

httpServer.listen(PORT, () => {
  console.log(
    `[Backend] Servidor escuchando en http://localhost:${PORT}`
  );

  console.log(
    `[Backend] REST: http://localhost:${PORT}/api/blueprints`
  );

  console.log(
    `[Backend] Socket.IO activo`
  );

  console.log(
    `[Backend] Blueprints iniciales: ${blueprints.size}`
  );
});