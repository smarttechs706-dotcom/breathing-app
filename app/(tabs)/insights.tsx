// See app/(tabs)/home.tsx for why this is a deep import — CONFIRMED
// correct on-device via instrumented debugging (see PROGRESS.md).
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useCallback, useEffect, useState } from 'react';

import { friendlyError } from '../../src/api/apiErrors';
import { fetchInsights, type InsightsResponse } from '../../src/api/client';
import { InsightsScreen } from '../../src/features/insights/InsightsScreen';
import { useRefreshOnNewCheckin } from '../../src/state/checkinSignal';

// Insights tab. The data loading, error and retry are unchanged from the
// previous version of this file; the screen itself lives in
// src/features/insights/ (computations in insightsModel.ts).
export default function InsightsTab() {
  const tabBarHeight = useBottomTabBarHeight();
  // null = still loading (first fetch, or a retry in flight).
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setInsights(null);
    fetchInsights()
      .then(setInsights)
      .catch((err) => setError(friendlyError(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // D-02: this tab now survives a completed session (see checkinSignal.ts);
  // refresh silently so the numbers/chart include it.
  const refreshAfterCheckin = useCallback(() => {
    fetchInsights()
      .then(setInsights)
      .catch(() => {});
  }, []);
  useRefreshOnNewCheckin(refreshAfterCheckin);

  return (
    <InsightsScreen insights={insights} error={error} onRetry={load} tabBarHeight={tabBarHeight} />
  );
}
