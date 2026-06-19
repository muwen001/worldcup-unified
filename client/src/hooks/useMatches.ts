import { useApp } from '../context/AppContext';

export function useMatches() {
  const { state } = useApp();
  return state.matches;
}

export function useMatch(matchId: string | null) {
  const { state } = useApp();
  return state.matches.find((m) => m.id === matchId) || null;
}

export function usePredictions() {
  const { state } = useApp();
  return state.predictions;
}

export function usePrediction(matchId: string | null) {
  const { state } = useApp();
  return state.predictions.find((p) => p.matchId === matchId) || null;
}
