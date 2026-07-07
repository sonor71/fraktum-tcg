import { useEffect, useMemo, useState } from "react";
import {
  getCloudAuthState,
  getCloudSaveMeta,
  isCloudAutoSyncEnabled,
  isCloudAutoSyncEnabled as readAutoSync,
  onCloudAuthStateChange,
  pullCloudSaveToLocal,
  pushLocalSaveToCloud,
  setCloudAutoSyncEnabled,
  signInCloud,
  signOutCloud,
  signUpCloud,
  type CloudSaveMeta,
} from "../services/fraktumCloudSync";
import type { FraktumCloudUser } from "../services/supabaseClient";
import { useGameStore } from "../useGameStore";
import "./CloudAccountPanel.css";

type CloudMode = "login" | "register";

type NoticeKind = "idle" | "ok" | "warn" | "error";

function formatDate(value: string | null | undefined) {
  if (!value) return "нет облачного сейва";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Supabase error.";
}

export function CloudAccountPanel() {
  const playerName = useGameStore((state) => state.playerName);
  const level = useGameStore((state) => state.level);
  const coins = useGameStore((state) => state.coins);
  const premium = useGameStore((state) => state.premium);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const deckIds = useGameStore((state) => state.deckIds);

  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState<FraktumCloudUser | null>(null);
  const [mode, setMode] = useState<CloudMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(playerName);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<CloudSaveMeta | null>(null);
  const [autoSync, setAutoSync] = useState(() => readAutoSync());
  const [noticeKind, setNoticeKind] = useState<NoticeKind>("idle");
  const [notice, setNotice] = useState("Supabase не подключён к этой вкладке.");

  const localSummary = useMemo(() => ({
    level,
    coins,
    premium,
    cards: ownedCards.length,
    deck: deckIds.length,
  }), [coins, deckIds.length, level, ownedCards.length, premium]);

  const refreshCloudState = async () => {
    const auth = await getCloudAuthState();
    setConfigured(auth.configured);
    setUser(auth.user);

    if (!auth.configured) {
      setNoticeKind("warn");
      setNotice("Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local, затем перезапусти dev-сервер.");
      return;
    }

    if (!auth.user) {
      setMeta(null);
      setNoticeKind("idle");
      setNotice("Войди в Supabase-аккаунт, чтобы сохранять карты, монеты, уровень и колоду в облаке.");
      return;
    }

    const cloudMeta = await getCloudSaveMeta();
    setMeta(cloudMeta);
    setNoticeKind(cloudMeta?.hasSave ? "ok" : "warn");
    setNotice(cloudMeta?.hasSave ? `Облачный сейв найден. Revision ${cloudMeta.revision ?? 0}.` : "Аккаунт есть, но облачного сейва ещё нет. Нажми Upload local save.");
  };

  useEffect(() => {
    refreshCloudState().catch((error) => {
      setNoticeKind("error");
      setNotice(getErrorMessage(error));
    });

    const unsubscribe = onCloudAuthStateChange(() => {
      refreshCloudState().catch((error) => {
        setNoticeKind("error");
        setNotice(getErrorMessage(error));
      });
    });

    return unsubscribe;
  }, []);

  const runCloudAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await refreshCloudState();
    } catch (error) {
      setNoticeKind("error");
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAuthSubmit = () => runCloudAction(async () => {
    if (mode === "login") {
      await signInCloud(email, password);
      setNoticeKind("ok");
      setNotice("Вход выполнен. Теперь можно загрузить или отправить сейв.");
    } else {
      await signUpCloud(email, password, displayName || playerName);
      setNoticeKind("ok");
      setNotice("Аккаунт создан. Если Supabase требует email-confirmation, подтверди почту.");
    }
  });

  const handleUpload = () => runCloudAction(async () => {
    const result = await pushLocalSaveToCloud();
    setAutoSync(isCloudAutoSyncEnabled());
    setNoticeKind("ok");
    setNotice(`Локальный профиль загружен в облако. Revision ${result.revision}.`);
  });

  const handleDownload = () => runCloudAction(async () => {
    const result = await pullCloudSaveToLocal();
    setNoticeKind("ok");
    setNotice(`Облачный профиль применён. Revision ${result.revision ?? 0}.`);
  });

  const handleSignOut = () => runCloudAction(async () => {
    await signOutCloud();
    setMeta(null);
    setUser(null);
    setAutoSync(false);
    setNoticeKind("idle");
    setNotice("Выход выполнен.");
  });

  const toggleAutoSync = () => {
    const next = !autoSync;
    setCloudAutoSyncEnabled(next);
    setAutoSync(next);
    setNoticeKind(next ? "ok" : "warn");
    setNotice(next ? "Auto-sync включён. Изменения локального профиля будут отправляться в Supabase." : "Auto-sync выключен.");
  };

  return (
    <div className="cloudAccountPanel">
      <div className="cloudAccountHead">
        <div>
          <span>Supabase account</span>
          <strong>{user ? user.email ?? user.id : configured ? "Not signed in" : "Not configured"}</strong>
        </div>
        <i className={`cloudStatusDot ${user ? "is-online" : configured ? "is-idle" : "is-offline"}`} />
      </div>

      <div className="cloudLocalSummary" aria-label="Local save summary">
        <span>LVL <b>{localSummary.level}</b></span>
        <span>COINS <b>{localSummary.coins}</b></span>
        <span>PREMIUM <b>{localSummary.premium}</b></span>
        <span>CARDS <b>{localSummary.cards}</b></span>
        <span>DECK <b>{localSummary.deck}</b></span>
      </div>

      <p className={`cloudNotice is-${noticeKind}`}>{notice}</p>

      {!configured ? (
        <div className="cloudSetupBox">
          <b>Нужно создать .env.local</b>
          <code>VITE_SUPABASE_URL=...</code>
          <code>VITE_SUPABASE_ANON_KEY=...</code>
          <small>Service role key сюда не вставлять.</small>
        </div>
      ) : null}

      {configured && !user ? (
        <div className="cloudAuthForm">
          <div className="cloudModeTabs">
            <button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => setMode("login")}>Login</button>
            <button className={mode === "register" ? "is-active" : ""} type="button" onClick={() => setMode("register")}>Register</button>
          </div>

          {mode === "register" ? (
            <label>
              <span>Nickname</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="FRAKTUM name" />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>

          <label>
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="min 6 characters" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>

          <button className="cloudPrimaryBtn" type="button" disabled={busy || email.trim().length < 3 || password.length < 6} onClick={handleAuthSubmit}>
            {busy ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </div>
      ) : null}

      {configured && user ? (
        <div className="cloudSyncActions">
          <div className="cloudMetaRow">
            <span>Cloud save</span>
            <b>{formatDate(meta?.updatedAt)}</b>
          </div>

          <button type="button" disabled={busy} onClick={handleUpload}>Upload local save</button>
          <button type="button" disabled={busy || !meta?.hasSave} onClick={handleDownload}>Download cloud save</button>
          <button type="button" disabled={busy} onClick={toggleAutoSync}>{autoSync ? "Disable auto-sync" : "Enable auto-sync"}</button>
          <button className="cloudDangerBtn" type="button" disabled={busy} onClick={handleSignOut}>Sign out</button>
        </div>
      ) : null}
    </div>
  );
}
