import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const submit = async () => {
    setError("");
    setStatus("");
    setResetLink("");
    setCopyStatus("");
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.post("/auth/forgot-password", { email: cleanEmail });
      setStatus(res.data?.msg || "Check your email for a reset link");
      if (res.data?.resetLink) setResetLink(res.data.resetLink);
    } catch (err) {
      setError(err?.response?.data?.msg || "Request failed");
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopyStatus("Link copied");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (err) {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h2 className="auth-title">Forgot Password</h2>

        {error && <p className="auth-error">{error}</p>}
        {status && <p className="auth-link">{status}</p>}
        {resetLink && (
          <>
            <div className="action-row">
              <button
                type="button"
                className="primary-btn"
                onClick={() => window.open(resetLink, "_self")}
              >
                Open Reset Link
              </button>
              <button type="button" className="ghost-btn" onClick={copyResetLink}>
                Copy Link
              </button>
            </div>
            <p className="auth-link">{copyStatus || "Use the link above to reset your password."}</p>
          </>
        )}

        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") submit();
          }}
        />

        <button className="primary-btn" onClick={submit}>
          Send Reset Link
        </button>

        <p className="auth-link">
          Remembered? <Link to="/">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
