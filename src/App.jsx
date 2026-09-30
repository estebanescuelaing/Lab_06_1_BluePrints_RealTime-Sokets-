import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Route, Routes } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CreateBlueprintPage from './pages/CreateBlueprintPage.jsx';
import EditBlueprintPage from './pages/EditBlueprintPage.jsx';

// Prueba de que Socket.IO funciona
import SocketTest from './components/SocketTest.jsx';

import socketService from './services/socketService.js';

import {
  remoteBlueprintCreated,
  remoteBlueprintUpdated,
  remoteBlueprintDeleted,
} from './features/blueprints/blueprintsSlice.js';

function RealtimeSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    /*
     * Conectamos una sola vez al servidor Socket.IO.
     */
    socketService.connect();

    /*
     * ========================================================
     * BLUEPRINT CREADO
     * ========================================================
     */

    const removeCreatedListener =
      socketService.onBlueprintCreated((blueprint) => {
        console.log(
          '[Realtime] Blueprint creado:',
          blueprint
        );

        dispatch(
          remoteBlueprintCreated(blueprint)
        );
      });

    /*
     * ========================================================
     * BLUEPRINT ACTUALIZADO
     * ========================================================
     */

    const removeUpdatedListener =
      socketService.onBlueprintUpdated((blueprint) => {
        console.log(
          '[Realtime] Blueprint actualizado:',
          blueprint
        );

        dispatch(
          remoteBlueprintUpdated(blueprint)
        );
      });

    /*
     * ========================================================
     * BLUEPRINT ELIMINADO
     * ========================================================
     */

    const removeDeletedListener =
      socketService.onBlueprintDeleted((blueprint) => {
        console.log(
          '[Realtime] Blueprint eliminado:',
          blueprint
        );

        dispatch(
          remoteBlueprintDeleted(blueprint)
        );
      });

    /*
     * ========================================================
     * CLEANUP
     * ========================================================
     *
     * Cuando App se desmonta, quitamos los listeners.
     *
     * Esto evita listeners duplicados.
     */

    return () => {
      removeCreatedListener();
      removeUpdatedListener();
      removeDeletedListener();
    };
  }, [dispatch]);

  return null;
}

function App() {
  return (
    <>
      <RealtimeSync />

      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/socket-test"
          element={<SocketTest />}
        />

        <Route
          path="/new"
          element={
            <PrivateRoute>
              <CreateBlueprintPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/edit/:author/:name"
          element={
            <PrivateRoute>
              <EditBlueprintPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;