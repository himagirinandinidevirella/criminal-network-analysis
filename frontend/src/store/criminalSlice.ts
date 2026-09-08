/**
 * Criminal state slice — search results, current profile, FIR analysis.
 */
import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { get, post } from "@/services/api";
import type {
  Criminal,
  CriminalProfile,
  FIRAnalysisResult,
} from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";

interface CriminalState {
  list: Criminal[];
  total: number;
  current: CriminalProfile | null;
  firResult: FIRAnalysisResult | null;
  loading: boolean;
  error: string | null;
  profileRequestId: string | null;
}

const initialState: CriminalState = {
  list: [],
  total: 0,
  current: null,
  firResult: null,
  loading: false,
  error: null,
  profileRequestId: null,
};

export const fetchCriminals = createAsyncThunk(
  "criminal/fetchCriminals",
  async (params: Record<string, unknown>) => {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    );
    return get<Paginated<Criminal>>(`/api/criminals/?${query.toString()}`);
  },
);

export const fetchProfile = createAsyncThunk(
  "criminal/fetchProfile",
  async (id: string) => get<CriminalProfile>(`/api/criminals/${id}`),
);

export const analyzeFir = createAsyncThunk(
  "criminal/analyzeFir",
  async (payload: { fir_text: string; language: string }) =>
    post<FIRAnalysisResult>("/api/criminals/analyze-fir", payload),
);

const criminalSlice = createSlice({
  name: "criminal",
  initialState,
  reducers: {
    clearCurrent(state) {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCriminals.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCriminals.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchCriminals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to load criminals";
      })
      .addCase(fetchProfile.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.profileRequestId = action.meta.requestId;
        if (state.current?.person.id !== action.meta.arg) state.current = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        if (state.profileRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.current = action.payload;
        state.error = null;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        if (state.profileRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.error.message ?? "Failed to load profile";
      })
      .addCase(analyzeFir.fulfilled, (state, action) => {
        state.firResult = action.payload;
      });
  },
});

export const { clearCurrent } = criminalSlice.actions;
export default criminalSlice.reducer;
