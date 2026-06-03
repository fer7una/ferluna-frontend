import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginAdmin } from "../../api";
import { FieldTooltip } from "./fields";
import { storeAdminSession } from "./session";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const expired = (location.state as { expired?: boolean } | null)?.expired === true;
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(
    expired
      ? "Tu sesión expiró. Vuelve a iniciar sesión."
      : "Introduce la clave de administración.",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password) {
      setError("La clave es obligatoria.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Validando…");

    try {
      const session = await loginAdmin(password);
      storeAdminSession({
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
      });
      navigate("/admin", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
      setStatus("Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel admin-login-panel" aria-labelledby="admin-login-title">
        <header className="admin-header">
          <div>
            <p>Fernando Luna</p>
            <h1 id="admin-login-title">Acceso de administración</h1>
          </div>
          <a href="/">Volver</a>
        </header>

        <form className="admin-token-row" onSubmit={submitLogin}>
          <label className="admin-field">
            <span className="admin-field-label-row">
              <span className="admin-field-label">Clave</span>
              <FieldTooltip text="Clave privada de administracion configurada en el backend." />
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={busy}>
            Entrar
          </button>
        </form>

        <div className="admin-status" aria-live="polite">
          <span>{status}</span>
          {error ? <strong>{error}</strong> : null}
        </div>
      </section>
    </main>
  );
}
