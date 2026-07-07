import { useEffect, useRef, useState } from "react";
import {
  CLOUD_AUTOSYNC_CHANGED_EVENT,
  getCloudAuthState,
  isCloudAutoSyncEnabled,
  onCloudAuthStateChange,
  pushLocalSaveToCloud,
} from "../services/fraktumCloudSync";
import { useGameStore } from "../useGameStore";

const AUTO_SYNC_DEBOUNCE_MS = 2400;

export function CloudAutoSync() {
  const [enabled, setEnabled] = useState(() => isCloudAutoSyncEnabled());
  const [signedIn, setSignedIn] = useState(false);
  const timerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    getCloudAuthState().then((auth) => {
      if (!mounted) return;
      setSignedIn(Boolean(auth.user));
    }).catch(() => {
      if (mounted) setSignedIn(false);
    });

    const unsubscribeAuth = onCloudAuthStateChange((user) => {
      setSignedIn(Boolean(user));
    });

    const handleAutoSyncToggle = () => {
      setEnabled(isCloudAutoSyncEnabled());
    };

    window.addEventListener(CLOUD_AUTOSYNC_CHANGED_EVENT, handleAutoSyncToggle);

    return () => {
      mounted = false;
      unsubscribeAuth();
      window.removeEventListener(CLOUD_AUTOSYNC_CHANGED_EVENT, handleAutoSyncToggle);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !signedIn) return;

    const unsubscribe = useGameStore.subscribe(() => {
      if (syncingRef.current) return;

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        syncingRef.current = true;
        pushLocalSaveToCloud()
          .catch((error) => {
            console.warn("[FRAKTUM] Cloud auto-sync failed:", error);
          })
          .finally(() => {
            syncingRef.current = false;
          });
      }, AUTO_SYNC_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, signedIn]);

  return null;
}
