/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { AppState, AppAction, DualPrediction } from '../types';
import { dataService } from '../services/dataService';
import { generateDualPredictions, generateDualPrediction } from '../services/dualPredictionEngine';

const initialState: AppState = {
  matches: [],
  predictions: [],
  selectedMatchId: null,
  teamRatings: {},
  isLoading: true,
  lastUpdated: new Date().toISOString(),
  sourceStatus: [],
  dataErrors: [],
  isRealTime: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MATCHES':
      return { ...state, matches: action.payload };
    case 'SET_PREDICTIONS':
      return { ...state, predictions: action.payload };
    case 'ADD_PREDICTION': {
      const existing = state.predictions.find((p) => p.matchId === action.payload.matchId);
      if (existing) {
        return {
          ...state,
          predictions: state.predictions.map((p) =>
            p.matchId === action.payload.matchId ? action.payload : p
          ),
        };
      }
      return { ...state, predictions: [...state.predictions, action.payload] };
    }
    case 'SET_SELECTED_MATCH':
      return { ...state, selectedMatchId: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LAST_UPDATED':
      return { ...state, lastUpdated: action.payload };
    case 'SET_SOURCE_STATUS':
      return { ...state, sourceStatus: action.payload };
    case 'SET_DATA_ERRORS':
      return { ...state, dataErrors: action.payload };
    case 'SET_REAL_TIME':
      return { ...state, isRealTime: action.payload };
    case 'SET_TEAM_RATINGS':
      return { ...state, teamRatings: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  refreshData: () => Promise<void>;
  predictMatch: (matchId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data from backend
  const loadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await dataService.fetchMatches();
      dispatch({ type: 'SET_MATCHES', payload: result.matches });
      dispatch({ type: 'SET_SOURCE_STATUS', payload: result.sourceStatus });
      dispatch({ type: 'SET_DATA_ERRORS', payload: result.errors });
      dispatch({ type: 'SET_REAL_TIME', payload: result.isRealTime });
      dispatch({ type: 'SET_LAST_UPDATED', payload: result.lastUpdated });

      // Generate dual predictions
      const predictions = generateDualPredictions(result.matches);
      dispatch({ type: 'SET_PREDICTIONS', payload: predictions });
    } catch (err) {
      dispatch({
        type: 'SET_DATA_ERRORS',
        payload: [`Data load failed: ${err instanceof Error ? err.message : String(err)}`],
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for updates — setTimeout loop prevents overlapping requests
  useEffect(() => {
    let active = true;

    async function poll(): Promise<void> {
      if (!active) return;
      try {
        await loadData();
      } catch {
        // Silently ignore polling errors
      }
      if (active) {
        pollingRef.current = setTimeout(poll, 60_000);
      }
    }

    // Start first poll after initial delay
    pollingRef.current = setTimeout(poll, 60_000);

    return () => {
      active = false;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [loadData]);

  // Refresh data
  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Generate prediction for a specific match
  const predictMatch = useCallback(
    (matchId: string) => {
      const match = state.matches.find((m) => m.id === matchId);
      if (!match) return;

      const prediction = generateDualPrediction(match);
      dispatch({ type: 'ADD_PREDICTION', payload: prediction });
    },
    [state.matches]
  );

  return (
    <AppContext.Provider value={{ state, dispatch, refreshData, predictMatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
