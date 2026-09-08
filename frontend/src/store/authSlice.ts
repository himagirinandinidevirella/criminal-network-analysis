import { SESSION_KEYS } from "@/config/runtime";
/**
 * Auth state slice.
 */
import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import * as authService from "@/services/auth";
import { clearSession, apiErrorMessage } from "@/services/api";
import type { LoginResponse, UserProfile } from "@/types/api.types";

interface AuthState {
  user: UserProfile | null;
  role: string | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: authService.getStoredUser(),
  role: authService.getStoredUser()?.role ?? null,
  token: localStorage.getItem(SESSION_KEYS.access),
  loading: false,
  error: null,
};

/** Async login thunk. */
export const loginThunk = createAsyncThunk<
  LoginResponse,
  authService.LoginPayload
>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    return await authService.login(payload);
  } catch (err) {
    return rejectWithValue(apiErrorMessage(err));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.role = null;
      state.token = null;
      clearSession();
    },
    setUser(state, action: PayloadAction<UserProfile>) {
      state.user = action.payload;
      state.role = action.payload.role;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user_profile;
        state.role = action.payload.role;
        state.token = action.payload.access_token;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
