"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [accountId, setAccountId] = useState("DEMO-CITY");
  const [seatId, setSeatId] = useState("PLANNER-01");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account_id: accountId.trim(),
          seat_id: seatId,
          seat_password: password,
        }),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? "The Account, Seat, or seat-specific password did not match."
          : "The demo login service is unavailable. Try again shortly.");
        return;
      }
      window.location.assign("/play");
    } catch {
      setError("The demo login service is unavailable. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        <span>Account ID</span>
        <input
          autoComplete="username"
          name="account_id"
          onChange={(event) => setAccountId(event.target.value)}
          required
          value={accountId}
        />
      </label>
      <label>
        <span>Seat ID</span>
        <select
          name="seat_id"
          onChange={(event) => setSeatId(event.target.value)}
          value={seatId}
        >
          <option value="OWNER">OWNER</option>
          <option value="SENTINEL-01">SENTINEL-01</option>
          <option value="PLANNER-01">PLANNER-01</option>
        </select>
      </label>
      <label>
        <span>Seat-specific password</span>
        <input
          autoComplete="current-password"
          name="seat_password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={submitting} type="submit">
        {submitting ? "Authenticating…" : "Open City Surface"}
      </button>
    </form>
  );
}
