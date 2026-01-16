import React from "react";
import { keycloak } from "./auth/keycloak";

export default function App() {
  const [ready, setReady] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [token, setToken] = React.useState<string | undefined>(undefined);

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
          // refresh 실패면 세션 만료 가능
          setAuthenticated(false);
          setToken(undefined);
        }
      }, 10_000);
    })();
  }, []);

  if (!ready) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Keycloak SPA Demo</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
      </div>

      <div>authenticated: {String(authenticated)}</div>
      <h3>access token</h3>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {token ?? "(no token)"}
      </pre>
    </div>
  );
}
