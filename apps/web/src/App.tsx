import React from "react";
import { keycloak } from "./auth/keycloak";

export default function App() {
  const [ready, setReady] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [token, setToken] = React.useState<string | undefined>(undefined);

  const [me, setMe] = React.useState<any>(null);
  const [meError, setMeError] = React.useState<string | null>(null);
  const [meLoading, setMeLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const ok = await keycloak.init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        checkLoginIframe: false,
      });

      setAuthenticated(ok);
      setToken(keycloak.token);
      setReady(true);

      // 토큰 갱신(만료 60초 전)
      setInterval(async () => {
        if (!keycloak.authenticated) return;
        try {
          const refreshed = await keycloak.updateToken(60);
          if (refreshed) setToken(keycloak.token);
        } catch {
          setAuthenticated(false);
          setToken(undefined);
          setMe(null);
        }
      }, 10_000);
    })();
  }, []);

  async function callMe() {
    setMeError(null);
    setMe(null);

    // 토큰이 없거나 로그인 안 된 상태면 로그인부터
    if (!keycloak.authenticated || !keycloak.token) {
      await keycloak.login();
      return;
    }

    setMeLoading(true);
    try {
      const res = await fetch("http://localhost:3001/me", {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMeError(`GET /me failed: ${res.status} ${JSON.stringify(data)}`);
        return;
      }

      setMe(data);
    } catch (e: any) {
      setMeError(e?.message ?? String(e));
    } finally {
      setMeLoading(false);
    }
  }

  if (!ready) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Keycloak SPA Demo</h1>

      <div
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        {!authenticated ? (
          <button onClick={() => keycloak.login()}>Login</button>
        ) : (
          <button
            onClick={() =>
              keycloak.logout({ redirectUri: window.location.origin })
            }
          >
            Logout
          </button>
        )}

        <button onClick={() => setToken(keycloak.token)}>
          Refresh view token
        </button>

        <button onClick={callMe} disabled={meLoading}>
          {meLoading ? "Calling /me..." : "Call /me"}
        </button>
      </div>

      <div>authenticated: {String(authenticated)}</div>

      <h3>access token</h3>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {token ?? "(no token)"}
      </pre>

      <h3>/me response</h3>
      {meError && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color: "crimson",
          }}
        >
          {meError}
        </pre>
      )}
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {me ? JSON.stringify(me, null, 2) : "(empty)"}
      </pre>
    </div>
  );
}
