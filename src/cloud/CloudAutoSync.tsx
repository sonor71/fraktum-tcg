import { useEffect, useRef, useState } from "react";
import {
  CLOUD_AUTOSYNC_CHANGED_EVENT,
  getCloudAuthState,
  getCloudSaveMeta,
  isCloudAutoSyncEnabled,
  onCloudAuthStateChange,
  pullCloudSaveToLocal,
  pushLocalSaveToCloud,
  setCloudAutoSyncEnabled,
} from "../services/fraktumCloudSync";
import { useGameStore } from "../useGameStore";

const AUTO_SYNC_DEBOUNCE_MS = 1600;

export function CloudAutoSync() {
  const [enabled, setEnabled] = useState(() => isCloudAutoSyncEnabled());
  const [signedIn, setSignedIn] = useState(false);
  const timerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const pulledForUserRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getCloudAuthState()
      .then((auth) => {
        if (!mounted) return;
        setSignedIn(Boolean(auth.user));
        if (auth.user) {
          setCloudAutoSyncEnabled(true);
          setEnabled(true);
        }
      })
      .catch(() => {
        if (mounted) setSignedIn(false);
      });

    const unsubscribeAuth = onCloudAuthStateChange((user) => {
      setSignedIn(Boolean(user));
      if (user) {
        setCloudAutoSyncEnabled(true);
        setEnabled(true);
      } else {
        pulledForUserRef.current = null;
      }
    });

    const handleAutoSyncToggle = () => {
      setEnabled(isCloudAutoSyncEnabled());
    };

    window.addEventListener(CLOUD_AUTOSYNC_CHANGED_EVENT, handleAutoSyncToggle);
    window.addEventListener("fraktum:cloud-auth-handoff", handleAutoSyncToggle);

    return () => {
      mounted = false;
      unsubscribeAuth();
      window.removeEventListener(CLOUD_AUTOSYNC_CHANGED_EVENT, handleAutoSyncToggle);
      window.removeEventListener("fraktum:cloud-auth-handoff", handleAutoSyncToggle);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !signedIn) return;

    let cancelled = false;

    getCloudAuthState()
      .then(async (auth) => {
        const userId = auth.user?.id;
        if (!userId || pulledForUserRef.current === userId || cancelled) return;

        pulledForUserRef.current = userId;
        syncingRef.current = true;

        try {
          const meta = await getCloudSaveMeta();
          if (meta?.hasSave) await pullCloudSaveToLocal();
          else await pushLocalSaveToCloud();
        } catch (error) {
          console.warn("[FRAKTUM] Initial cloud sync failed:", error);
        } finally {
          syncingRef.current = false;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled, signedIn]);

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
