/**
 * Network state slice — graph data, communities, key players, statistics.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { get, post } from "@/services/api";
import type {
  Community,
  GraphData,
  KeyPlayers,
  NetworkStatistics,
  PathResult,
} from "@/types/network.types";

interface NetworkState {
  graph: GraphData | null;
  communities: Community[];
  keyPlayers: KeyPlayers | null;
  statistics: NetworkStatistics | null;
  path: PathResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: NetworkState = {
  graph: null,
  communities: [],
  keyPlayers: null,
  statistics: null,
  path: null,
  loading: false,
  error: null,
};

export const fetchFullGraph = createAsyncThunk(
  "network/fetchFullGraph",
  async (filters: Record<string, unknown> = {}) => {
    const query = new URLSearchParams(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)])
    );
    return get<GraphData>(`/api/network/full?${query.toString()}`);
  }
);

export const fetchCommunities = createAsyncThunk(
  "network/fetchCommunities",
  async () => get<Community[]>("/api/network/communities")
);

export const fetchKeyPlayers = createAsyncThunk(
  "network/fetchKeyPlayers",
  async () => get<KeyPlayers>("/api/network/keyplayers")
);

export const fetchStatistics = createAsyncThunk(
  "network/fetchStatistics",
  async () => get<NetworkStatistics>("/api/network/statistics")
);

export const findPath = createAsyncThunk(
  "network/findPath",
  async (payload: { from_id: string; to_id: string }) =>
    post<PathResult>("/api/network/path", payload)
);

const networkSlice = createSlice({
  name: "network",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFullGraph.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFullGraph.fulfilled, (state, action) => {
        state.loading = false;
        state.graph = action.payload;
      })
      .addCase(fetchFullGraph.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to load network";
      })
      .addCase(fetchCommunities.fulfilled, (state, action) => {
        state.communities = action.payload;
      })
      .addCase(fetchKeyPlayers.fulfilled, (state, action) => {
        state.keyPlayers = action.payload;
      })
      .addCase(fetchStatistics.fulfilled, (state, action) => {
        state.statistics = action.payload;
      })
      .addCase(findPath.fulfilled, (state, action) => {
        state.path = action.payload;
      });
  },
});

export default networkSlice.reducer;
