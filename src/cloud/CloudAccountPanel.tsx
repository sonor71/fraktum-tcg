import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  CLOUD_AUTOSYNC_CHANGED_EVENT,
  getCloudAuthState,
  getCloudSaveMeta,
  isCloudAutoSyncEnabled,
  onCloudAuthStateChange,
  pullCloudSaveToLocal,
  pushLocalSaveToCloud,
  requestCloudEmailCode,
  setCloudAutoSyncEnabled,
  signOutCloud,
  verifyCloudEmailCode,
  type CloudAuthState,
  type CloudSaveMeta,
} from "../services/fraktumCloudSync";
import { useGameStore } from "../useGameStore";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function normalizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: 18,
  border: "1px solid rgba(149, 228, 255, 0.16)",
  borderRadius: 22,
  background:
    "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025)), rgba(3, 8, 15, 0.72)",
  boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const stepStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid rgba(145, 224, 255, 0.12)",
  borderRadius: 16,
  background: "rgba(2, 8, 15, 0.42)",
};

const stepTitleStyle: CSSProperties = {
  color: "#eaf8ff",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.05em",
};

const inputStyle: CSSProperties = {
  minWidth: 220,
  minHeight: 44,
  padding: "0 12px",
  border: "1px solid rgba(145, 224, 255, 0.18)",
  borderRadius: 12,
  color: "#eff9ff",
  background: "rgba(3, 9, 17, 0.88)",
  outline: "none",
};

const codeInputStyle: CSSProperties = {
  ...inputStyle,
  width: 220,
  minWidth: 220,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "0.24em",
  textAlign: "center",
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  border: "1px solid rgba(138, 225, 255, 0.22)",
  borderRadius: 12,
  color: "#edf9ff",
  background:
    "linear-gradient(180deg, rgba(46, 120, 153, 0.64), rgba(41, 24, 94, 0.82))",
  fontWeight: 900,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  ...buttonStyle,
  background:
    "linear-gradient(180deg, rgba(31, 49, 68, 0.72), rgba(7, 14, 23, 0.9))",
};

const mutedStyle: CSSProperties = {
  color: "rgba(229, 242, 252, 0.68)",
  fontSize: 12,
  lineHeight: 1.45,
};

export function CloudAccountPanel() {
  const playerName = useGameStore((state) => state.playerName);

  const [authState, setAuthState] = useState<CloudAuthState>({
    configured: false,
    user: null,
  });
  const [saveMeta, setSaveMeta] = useState<CloudSaveMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState(playerName || "");
  const [sentEmail, setSentEmail] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [autoSync, setAutoSync] = useState(isCloudAutoSyncEnabled());
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const accountEmail = authState.user?.email ?? "";
  const currentEmail = useMemo(
    () => (sentEmail || email).trim().toLowerCase(),
    [email, sentEmail],
  );

  async function refresh() {
    setLoading(true);
    setErrorMessage("");

    try {
      const nextAuthState = await getCloudAuthState();
      setAuthState(nextAuthState);

      if (nextAuthState.user) {
        setSaveMeta(await getCloudSaveMeta().catch(() => null));
      } else {
        setSaveMeta(null);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();

    const unsubscribe = onCloudAuthStateChange(() => {
      void refresh();
    });

    const handleAutoSyncChange = () => {
      setAutoSync(isCloudAutoSyncEnabled());
    };

    window.addEventListener(
      CLOUD_AUTOSYNC_CHANGED_EVENT,
      handleAutoSyncChange,
    );

    return () => {
      unsubscribe();
      window.removeEventListener(
        CLOUD_AUTOSYNC_CHANGED_EVENT,
        handleAutoSyncChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!displayName && playerName) setDisplayName(playerName);
  }, [displayName, playerName]);

  async function runCloudAction(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setErrorMessage("");

    try {
      await action();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function handleRequestCode() {
    void runCloudAction(async () => {
      const result = await requestCloudEmailCode(email, displayName);
      setSentEmail(result.email);
      setCodeRequested(true);
      setCode("");
      setMessage(
        `Код отправлен на ${result.email}. Введи его в поле «Код из письма» ниже.`,
      );

      window.setTimeout(() => {
        codeInputRef.current?.focus();
      }, 0);
    });
  }

  function handleVerifyCode(event?: FormEvent) {
    event?.preventDefault();

    void runCloudAction(async () => {
      if (!currentEmail) {
        throw new Error("Сначала укажи почту и запроси код.");
      }

      if (!code.trim()) {
        throw new Error("Введи код из письма.");
      }

      await verifyCloudEmailCode(currentEmail, code, displayName);
      setCode("");
      setCodeRequested(false);
      setMessage("Вход выполнен. Аккаунт FRAKTUM подключён.");
      await refresh();
    });
  }

  function handleSignOut() {
    void runCloudAction(async () => {
      await signOutCloud();
      setMessage("Вы вышли из FRAKTUM Cloud.");
      await refresh();
    });
  }

  function handlePushSave() {
    void runCloudAction(async () => {
      const result = await pushLocalSaveToCloud();
      setMessage(
        `Локальный прогресс загружен в облако. Revision ${result.revision}.`,
      );
      setSaveMeta(await getCloudSaveMeta().catch(() => null));
    });
  }

  function handlePullSave() {
    void runCloudAction(async () => {
      const result = await pullCloudSaveToLocal();
      setMessage(
        `Облачный прогресс загружен. Revision ${result.revision ?? "—"}.`,
      );
      setSaveMeta(await getCloudSaveMeta().catch(() => null));
    });
  }

  function handleToggleAutoSync() {
    const next = !autoSync;
    setCloudAutoSyncEnabled(next);
    setAutoSync(next);
    setMessage(
      next
        ? "Автосинхронизация включена."
        : "Автосинхронизация выключена.",
    );
  }

  if (loading) {
    return (
      <section style={panelStyle}>
        <strong>FRAKTUM Cloud</strong>
        <span style={mutedStyle}>Проверка аккаунта...</span>
      </section>
    );
  }

  if (!authState.configured) {
    return (
      <section style={panelStyle}>
        <strong>FRAKTUM Cloud</strong>
        <span style={mutedStyle}>
          Supabase не настроен. Добавь VITE_SUPABASE_URL и
          VITE_SUPABASE_ANON_KEY в .env/.env.local и в Vercel Environment
          Variables, затем пересобери проект.
        </span>
      </section>
    );
  }

  if (authState.user) {
    return (
      <section style={panelStyle}>
        <div style={{ ...rowStyle, justifyContent: "space-between" }}>
          <div>
            <strong>FRAKTUM Cloud подключён</strong>
            <div style={mutedStyle}>{accountEmail}</div>
          </div>
          <button
            type="button"
            style={ghostButtonStyle}
            onClick={handleSignOut}
            disabled={busy}
          >
            Выйти
          </button>
        </div>

        <div style={rowStyle}>
          <button
            type="button"
            style={buttonStyle}
            onClick={handlePushSave}
            disabled={busy}
          >
            Загрузить прогресс в облако
          </button>
          <button
            type="button"
            style={ghostButtonStyle}
            onClick={handlePullSave}
            disabled={busy || !saveMeta?.hasSave}
          >
            Скачать прогресс из облака
          </button>
          <button
            type="button"
            style={ghostButtonStyle}
            onClick={handleToggleAutoSync}
            disabled={busy}
          >
            Autosync: {autoSync ? "ON" : "OFF"}
          </button>
        </div>

        <span style={mutedStyle}>
          Cloud save:{" "}
          {saveMeta?.hasSave
            ? `revision ${saveMeta.revision ?? "—"}, ${formatDate(saveMeta.updatedAt)}`
            : "пока нет сохранения"}
        </span>

        {message ? (
          <span style={{ ...mutedStyle, color: "#baffdd" }}>{message}</span>
        ) : null}
        {errorMessage ? (
          <span style={{ ...mutedStyle, color: "#ffb3b3" }}>
            {errorMessage}
          </span>
        ) : null}
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div>
        <strong>Вход в FRAKTUM Cloud</strong>
        <div style={mutedStyle}>
          Пароль не нужен. Сначала запроси код, затем введи его во втором поле.
        </div>
      </div>

      <div style={stepStyle}>
        <div style={stepTitleStyle}>ШАГ 1 — ПОЛУЧИТЬ КОД</div>
        <div style={rowStyle}>
          <input
            style={inputStyle}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (sentEmail && event.target.value.trim() !== sentEmail) {
                setCodeRequested(false);
                setSentEmail("");
                setCode("");
              }
            }}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="email@example.com"
            disabled={busy}
          />
          <input
            style={inputStyle}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ник игрока"
            disabled={busy}
          />
          <button
            type="button"
            style={buttonStyle}
            onClick={handleRequestCode}
            disabled={busy || !email.trim()}
          >
            {codeRequested ? "Отправить код ещё раз" : "Получить код"}
          </button>
        </div>
      </div>

      <form style={stepStyle} onSubmit={handleVerifyCode}>
        <div style={stepTitleStyle}>ШАГ 2 — ВВЕСТИ КОД ИЗ ПИСЬМА</div>
        <div style={mutedStyle}>
          {codeRequested
            ? `Код отправлен на ${sentEmail}. Вставь его в поле ниже.`
            : "Поле уже доступно. После отправки письма введи сюда полученный код."}
        </div>
        <div style={rowStyle}>
          <input
            ref={codeInputRef}
            style={codeInputStyle}
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            placeholder="000000"
            aria-label="Код из письма"
            disabled={busy}
          />
          <button
            type="submit"
            style={buttonStyle}
            disabled={busy || !code.trim() || !currentEmail}
          >
            Подтвердить код и войти
          </button>
        </div>
      </form>

      {message ? (
        <span style={{ ...mutedStyle, color: "#baffdd" }}>{message}</span>
      ) : null}
      {errorMessage ? (
        <span style={{ ...mutedStyle, color: "#ffb3b3" }}>
          {errorMessage}
        </span>
      ) : null}
    </section>
  );
}
