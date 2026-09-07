/**
 * Redux store configuration.
 */
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import criminalReducer from "./criminalSlice";
import alertReducer from "./alertSlice";
import networkReducer from "./networkSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    criminal: criminalReducer,
    alerts: alertReducer,
    network: networkReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
