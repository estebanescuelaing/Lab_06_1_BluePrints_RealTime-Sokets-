import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';

import blueprintsService from '../../services/blueprintsService.js';

const EMPTY_PLANS = [];

const initialState = {
  byAuthor: {}, // { [author]: {name, points}[] }
  current: null, // { author, name, points } | null
  status: 'idle',
  error: null,
  openStatus: 'idle',
  openError: null,
  createStatus: 'idle',
  createError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,

  // Snapshots internos para poder revertir un optimistic update
  // si el servidor rechaza la operación.
  _updateSnapshot: null,
  _deleteSnapshot: null,
};

export const fetchByAuthor = createAsyncThunk(
  'blueprints/fetchByAuthor',
  async (author, { rejectWithValue }) => {
    try {
      const plans = await blueprintsService.getByAuthor(author);
      return { author, plans };
    } catch (err) {
      return rejectWithValue(
        err.message || 'Error al consultar los planos del autor'
      );
    }
  }
);

export const openBlueprint = createAsyncThunk(
  'blueprints/openBlueprint',
  async ({ author, name }, { rejectWithValue }) => {
    try {
      const plan = await blueprintsService.getByAuthorAndName(author, name);
      return { author, ...plan };
    } catch (err) {
      return rejectWithValue(
        err.message || 'Error al abrir el plano'
      );
    }
  }
);

export const createBlueprint = createAsyncThunk(
  'blueprints/createBlueprint',
  async ({ author, blueprint }, { rejectWithValue }) => {
    try {
      const created = await blueprintsService.create(author, blueprint);
      return { author, ...created };
    } catch (err) {
      return rejectWithValue(
        err.message || 'Error al crear el plano'
      );
    }
  }
);

export const updateBlueprint = createAsyncThunk(
  'blueprints/updateBlueprint',
  async ({ author, name, points }, { rejectWithValue }) => {
    try {
      const updated = await blueprintsService.update(
        author,
        name,
        { name, points }
      );

      return { author, ...updated };
    } catch (err) {
      return rejectWithValue(
        err.message || 'Error al actualizar el plano'
      );
    }
  }
);

export const deleteBlueprint = createAsyncThunk(
  'blueprints/deleteBlueprint',
  async ({ author, name }, { rejectWithValue }) => {
    try {
      await blueprintsService.remove(author, name);
      return { author, name };
    } catch (err) {
      return rejectWithValue(
        err.message || 'Error al eliminar el plano'
      );
    }
  }
);

const blueprintsSlice = createSlice({
  name: 'blueprints',

  initialState,

  reducers: {
    clearCurrent(state) {
      state.current = null;
    },

    /*
     * ========================================================
     * CAMBIOS RECIBIDOS DESDE OTRO CLIENTE
     * ========================================================
     *
     * Estos reducers NO llaman al servidor.
     *
     * Solamente actualizan Redux cuando Socket.IO nos informa
     * que otro cliente modificó el estado compartido.
     */

    remoteBlueprintCreated(state, action) {
      const { author, name, points = [] } = action.payload;

      if (!author || !name) {
        return;
      }

      const list = state.byAuthor[author] || [];

      /*
       * Evitamos duplicados.
       *
       * Esto es importante porque el cliente que creó el
       * blueprint también recibe el evento Socket.IO.
       */
      const alreadyExists = list.some(
        (plan) => plan.name === name
      );

      if (!alreadyExists) {
        list.push({
          name,
          points,
        });
      }

      state.byAuthor[author] = list;
    },

    remoteBlueprintUpdated(state, action) {
      const { author, name, points = [] } = action.payload;

      if (!author || !name) {
        return;
      }

      const list = state.byAuthor[author];

      /*
       * Actualizar la lista si ese autor ya fue consultado.
       */
      if (list) {
        const index = list.findIndex(
          (plan) => plan.name === name
        );

        if (index !== -1) {
          list[index] = {
            name,
            points,
          };
        }
      }

      /*
       * Si estamos viendo ese blueprint actualmente,
       * también actualizamos current.
       */
      if (
        state.current?.author === author &&
        state.current?.name === name
      ) {
        state.current = {
          author,
          name,
          points,
        };
      }
    },

    remoteBlueprintDeleted(state, action) {
      const { author, name } = action.payload;

      if (!author || !name) {
        return;
      }

      const list = state.byAuthor[author];

      if (list) {
        state.byAuthor[author] = list.filter(
          (plan) => plan.name !== name
        );
      }

      if (
        state.current?.author === author &&
        state.current?.name === name
      ) {
        state.current = null;
      }
    },
  },

  extraReducers: (builder) => {
    builder

      /*
       * ======================================================
       * FETCH BY AUTHOR
       * ======================================================
       */

      .addCase(fetchByAuthor.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })

      .addCase(fetchByAuthor.fulfilled, (state, action) => {
        state.status = 'succeeded';

        state.byAuthor[action.payload.author] =
          action.payload.plans;
      })

      .addCase(fetchByAuthor.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload ?? action.error.message;
      })

      /*
       * ======================================================
       * OPEN BLUEPRINT
       * ======================================================
       */

      .addCase(openBlueprint.pending, (state) => {
        state.openStatus = 'loading';
        state.openError = null;
      })

      .addCase(openBlueprint.fulfilled, (state, action) => {
        state.openStatus = 'succeeded';
        state.current = action.payload;
      })

      .addCase(openBlueprint.rejected, (state, action) => {
        state.openStatus = 'failed';
        state.openError =
          action.payload ?? action.error.message;
      })

      /*
       * ======================================================
       * CREATE BLUEPRINT
       * ======================================================
       */

      .addCase(createBlueprint.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })

      .addCase(createBlueprint.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';

        const { author, ...plan } = action.payload;

        const list = state.byAuthor[author] || [];

        /*
         * Evitamos duplicar el blueprint si el evento
         * Socket.IO ya llegó antes que la respuesta REST.
         */
        const index = list.findIndex(
          (item) => item.name === plan.name
        );

        if (index === -1) {
          list.push(plan);
        } else {
          list[index] = plan;
        }

        state.byAuthor[author] = list;
      })

      .addCase(createBlueprint.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError =
          action.payload ?? action.error.message;
      })

      /*
       * ======================================================
       * UPDATE BLUEPRINT
       * ======================================================
       */

      .addCase(updateBlueprint.pending, (state, action) => {
        state.updateStatus = 'loading';
        state.updateError = null;

        const {
          author,
          name,
          points,
        } = action.meta.arg;

        const list = state.byAuthor[author];

        if (list) {
          const index = list.findIndex(
            (p) => p.name === name
          );

          if (index !== -1) {
            state._updateSnapshot = {
              author,
              name,
              previous: list[index],
            };

            list[index] = {
              name,
              points,
            };
          }
        }

        if (
          state.current?.author === author &&
          state.current?.name === name
        ) {
          state.current = {
            author,
            name,
            points,
          };
        }
      })

      .addCase(updateBlueprint.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state._updateSnapshot = null;

        const { author, ...plan } = action.payload;

        const list = state.byAuthor[author];

        if (list) {
          const index = list.findIndex(
            (p) => p.name === plan.name
          );

          if (index !== -1) {
            list[index] = plan;
          }
        }

        if (
          state.current?.author === author &&
          state.current?.name === plan.name
        ) {
          state.current = {
            author,
            ...plan,
          };
        }
      })

      .addCase(updateBlueprint.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload ?? action.error.message;

        const snapshot = state._updateSnapshot;

        if (snapshot) {
          const list =
            state.byAuthor[snapshot.author];

          if (list) {
            const index = list.findIndex(
              (p) => p.name === snapshot.name
            );

            if (index !== -1) {
              list[index] = snapshot.previous;
            }
          }

          if (
            state.current?.author === snapshot.author &&
            state.current?.name === snapshot.name
          ) {
            state.current = {
              author: snapshot.author,
              ...snapshot.previous,
            };
          }
        }

        state._updateSnapshot = null;
      })

      /*
       * ======================================================
       * DELETE BLUEPRINT
       * ======================================================
       */

      .addCase(deleteBlueprint.pending, (state, action) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;

        const {
          author,
          name,
        } = action.meta.arg;

        const list = state.byAuthor[author];

        if (list) {
          const index = list.findIndex(
            (p) => p.name === name
          );

          if (index !== -1) {
            state._deleteSnapshot = {
              author,
              index,
              plan: list[index],
            };

            list.splice(index, 1);
          }
        }

        if (
          state.current?.author === author &&
          state.current?.name === name
        ) {
          state.current = null;
        }
      })

      .addCase(deleteBlueprint.fulfilled, (state) => {
        state.deleteStatus = 'succeeded';
        state._deleteSnapshot = null;
      })

      .addCase(deleteBlueprint.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError =
          action.payload ?? action.error.message;

        const snapshot = state._deleteSnapshot;

        if (snapshot) {
          const list =
            state.byAuthor[snapshot.author];

          if (list) {
            list.splice(
              snapshot.index,
              0,
              snapshot.plan
            );
          }
        }

        state._deleteSnapshot = null;
      });
  },
});

export const {
  clearCurrent,
  remoteBlueprintCreated,
  remoteBlueprintUpdated,
  remoteBlueprintDeleted,
} = blueprintsSlice.actions;

/*
 * ============================================================
 * SELECTORES
 * ============================================================
 */

export const selectPlansByAuthor =
  (author) => (state) =>
    state.blueprints.byAuthor[author] ?? EMPTY_PLANS;

export const selectCurrentBlueprint =
  (state) => state.blueprints.current;

export const selectFetchStatus =
  (state) => state.blueprints.status;

export const selectFetchError =
  (state) => state.blueprints.error;

export const selectCreateStatus =
  (state) => state.blueprints.createStatus;

export const selectCreateError =
  (state) => state.blueprints.createError;

export const selectUpdateStatus =
  (state) => state.blueprints.updateStatus;

export const selectUpdateError =
  (state) => state.blueprints.updateError;

export const selectDeleteStatus =
  (state) => state.blueprints.deleteStatus;

export const selectDeleteError =
  (state) => state.blueprints.deleteError;
  

const selectAllPlans = (state) => state.blueprints.byAuthor;

export const selectTop5ByPoints = createSelector(
  [selectAllPlans],
  (byAuthor) => {
    const all = Object.entries(byAuthor).flatMap(
      ([author, plans]) =>
        plans.map((p) => ({
          author,
          ...p,
          pointCount: p.points.length,
        }))
    );

    return [...all]
      .sort((a, b) => b.pointCount - a.pointCount)
      .slice(0, 5);
  }
);

export default blueprintsSlice.reducer;