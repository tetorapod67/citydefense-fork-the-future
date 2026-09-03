import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">CD</span>
          <div>
            <p className="product-name">CityDefense: Fork the Future</p>
            <p className="product-subtitle">Gate 1 · Disposable Demo Town</p>
          </div>
        </div>
        <div className="login-copy">
          <h1 id="login-title">Enter the active Seat</h1>
          <p>
            Authenticate with the three-part demo identity before opening the
            live city surface. Credentials are disposable and isolated from
            production accounts.
          </p>
        </div>
        <LoginForm />
        <p className="security-note">
          This proof environment accepts no personal credentials and exposes no
          password or session value to Site Tools.
        </p>
      </section>
      <aside className="login-visual" aria-label="Gate 1 proof scope">
        <div className="signal-grid" aria-hidden="true" />
        <div className="login-visual-content">
          <p>Live proof scope</p>
          <h2>One district. One stamp. One durable history.</h2>
          <dl>
            <div><dt>Branch</dt><dd>BRANCH-MAIN</dd></div>
            <div><dt>Target</dt><dd>district:CENTRAL_WARD</dd></div>
            <div><dt>Persistence</dt><dd>Cloudflare D1</dd></div>
          </dl>
        </div>
      </aside>
    </main>
  );
}
