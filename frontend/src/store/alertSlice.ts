/**
 * Alert state slice — active alerts, real-time additions, stats.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { get } from "@/services/api";
import type { Alert, AlertStats } from "@/types/alert.types";

interface AlertState {
  active: Alert[];
  stats: AlertStats | null;
  lastAlert: Alert | null;
  loading: boolean;
  error: string | null;
}

const initialState: AlertState = {
  active: [],
  stats: null,
  lastAlert: null,
  loading: false,
  error: null,
};

export const fetchActiveAlerts = createAsyncThunk(
  "alerts/fetchActive",
  async () => get<Alert[]>("/api/alerts/active")
);

export const fetchAlertStats = createAsyncThunk(
  "alerts/fetchStats",
  async () => get<AlertStats>("/api/alerts/statistics")
);

const alertSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {
    /** Add a real-time alert at the top of the list (deduplicated). */
    pushAlert(state, action: PayloadAction<Alert>) {
      const exists = state.active.some((a) => a.id === action.payload.id);
      if (!exists) {
        state.active.unshift(action.payload);
        state.lastAlert = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveAlerts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActiveAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.active = action.payload;
      })
      .addCase(fetchActiveAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to load alerts";
      })
      .addCase(fetchAlertStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      });
  },
});

export const { pushAlert } = alertSlice.actions;
export default alertSlice.reducer;
