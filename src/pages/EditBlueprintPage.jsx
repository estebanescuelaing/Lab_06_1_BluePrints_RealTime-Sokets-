import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import BlueprintCanvas from '../components/BlueprintCanvas.jsx';
import socketService from '../services/socketService.js';

import {
  clearCurrent,
  deleteBlueprint,
  openBlueprint,
  selectCurrentBlueprint,
  selectDeleteError,
  selectDeleteStatus,
  selectUpdateError,
  selectUpdateStatus,
  updateBlueprint,
} from '../features/blueprints/blueprintsSlice.js';

/**
 * Página protegida:
 * - carga un blueprint mediante REST
 * - sincroniza los puntos mediante Socket.IO
 * - permite guardar mediante PUT
 * - permite eliminar mediante DELETE
 */
function EditBlueprintPage() {
  const { author, name } = useParams();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const current = useSelector(selectCurrentBlueprint);

  const updateStatus = useSelector(selectUpdateStatus);
  const updateError = useSelector(selectUpdateError);

  const deleteStatus = useSelector(selectDeleteStatus);
  const deleteError = useSelector(selectDeleteError);

  const [points, setPoints] = useState([]);
  const [socketStatus, setSocketStatus] =
    useState('Desconectado');

  const room = `blueprints.${author}.${name}`;

  /*
   * ============================================================
   * 1. CARGAR BLUEPRINT MEDIANTE REST
   * ============================================================
   */

  useEffect(() => {
    dispatch(
      openBlueprint({
        author,
        name,
      })
    );

    return () => {
      dispatch(clearCurrent());
    };
  }, [dispatch, author, name]);

  /*
   * ============================================================
   * 2. CARGAR LOS PUNTOS RECIBIDOS DESDE REDUX
   * ============================================================
   */

  useEffect(() => {
    if (
      current?.author === author &&
      current?.name === name
    ) {
      setPoints(current.points ?? []);
    }
  }, [current, author, name]);

  /*
   * ============================================================
   * 3. CONECTAR SOCKET.IO Y ENTRAR A LA ROOM
   * ============================================================
   */

  useEffect(() => {
    const socket = socketService.connect();

    function handleConnect() {
      console.log(
        `[EditBlueprintPage] Socket conectado. Entrando a ${room}`
      );

      setSocketStatus('Conectado');

      socketService.joinRoom(room);
    }

    function handleDisconnect() {
      console.log(
        '[EditBlueprintPage] Socket desconectado'
      );

      setSocketStatus('Desconectado');
    }

    function handleBlueprintUpdate(payload) {
      if (!payload?.points) {
        return;
      }

      /*
       * Ignorar actualizaciones de otros blueprints.
       */
      if (
        payload.author !== undefined &&
        payload.author !== null &&
        payload.author !== author
      ) {
        return;
      }

      if (
        payload.name !== undefined &&
        payload.name !== null &&
        payload.name !== name
      ) {
        return;
      }

      console.log(
        '[EditBlueprintPage] blueprint-update recibido:',
        payload
      );

      setPoints(payload.points);
    }

    /*
     * Si ya estaba conectado cuando montó el componente.
     */
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const removeBlueprintListener =
      socketService.onBlueprintUpdate(
        handleBlueprintUpdate
      );

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);

      removeBlueprintListener();

      socketService.leaveRoom(room);
    };
  }, [author, name, room]);

  /*
   * ============================================================
   * 4. AGREGAR PUNTO
   * ============================================================
   */

  function handleAddPoint(point) {
    console.log(
      '[EditBlueprintPage] Enviando draw-event:',
      point
    );

    socketService.drawPoint({
      room,
      author,
      name,
      point,
    });
  }

  /*
   * ============================================================
   * 5. DESHACER ÚLTIMO PUNTO
   * ============================================================
   *
   * Por ahora es una operación local.
   * Los cambios se guardan definitivamente al presionar
   * "Guardar cambios".
   */

  function handleRemoveLastPoint() {
    setPoints((prev) => prev.slice(0, -1));
  }

  /*
   * ============================================================
   * 6. GUARDAR CAMBIOS
   * ============================================================
   */

  async function handleSave(event) {
    event.preventDefault();

    console.log(
      '[EditBlueprintPage] Guardando blueprint:',
      {
        author,
        name,
        points,
      }
    );

    const result = await dispatch(
      updateBlueprint({
        author,
        name,
        points,
      })
    );

    if (updateBlueprint.fulfilled.match(result)) {
      console.log(
        '[EditBlueprintPage] Blueprint actualizado correctamente:',
        result.payload
      );

      navigate('/');
    } else {
      console.error(
        '[EditBlueprintPage] Error actualizando blueprint:',
        result.payload || result.error
      );
    }
  }

  /*
   * ============================================================
   * 7. ELIMINAR
   * ============================================================
   */

  async function handleDelete() {
    if (
      !window.confirm(
        `¿Eliminar el plano "${name}" de ${author}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    const result = await dispatch(
      deleteBlueprint({
        author,
        name,
      })
    );

    if (deleteBlueprint.fulfilled.match(result)) {
      navigate('/');
    }
  }

  /*
   * ============================================================
   * 8. ESTADO DE CARGA
   * ============================================================
   */

  if (!current) {
    return (
      <div className="container">
        <p className="text-muted">
          Cargando plano…
        </p>
      </div>
    );
  }

  /*
   * ============================================================
   * 9. INTERFAZ
   * ============================================================
   */

  return (
    <div className="container">
      <h2 className="h4 mb-3">
        Editar plano:{' '}
        <span className="fw-semibold">
          {name}
        </span>{' '}
        ({author})
      </h2>

      <div className="mb-3">
        <span className="small text-muted">
          Tiempo real:{' '}
          <strong
            className={
              socketStatus === 'Conectado'
                ? 'text-success'
                : 'text-danger'
            }
          >
            {socketStatus}
          </strong>
        </span>
      </div>

      <div className="row">
        <div className="col-md-6">
          <p className="text-muted small mb-2">
            Haz clic sobre el lienzo para agregar más
            puntos ({points.length} en total).
          </p>

          <div className="d-flex gap-2 mb-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleRemoveLastPoint}
              disabled={points.length === 0}
            >
              Deshacer último punto
            </button>
          </div>

          {updateError && (
            <div className="alert alert-danger py-2">
              {updateError}
            </div>
          )}

          {updateStatus === 'succeeded' && (
            <div className="alert alert-success py-2">
              Cambios guardados.
            </div>
          )}

          {deleteError && (
            <div className="alert alert-danger py-2">
              {deleteError}
            </div>
          )}

          <div className="d-flex gap-2">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={
                updateStatus === 'loading'
              }
            >
              {updateStatus === 'loading'
                ? 'Guardando…'
                : 'Guardar cambios'}
            </button>

            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={handleDelete}
              disabled={
                deleteStatus === 'loading'
              }
            >
              {deleteStatus === 'loading'
                ? 'Eliminando…'
                : 'Eliminar plano'}
            </button>
          </div>
        </div>

        <div className="col-md-6">
          <BlueprintCanvas
            points={points}
            onAddPoint={handleAddPoint}
          />
        </div>
      </div>
    </div>
  );
}

export default EditBlueprintPage;