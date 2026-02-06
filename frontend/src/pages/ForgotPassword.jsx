import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setStatus("");
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.post("/auth/forgot-password", { email: cleanEmail });
      setStatus(res.data?.msg || "Check your email for a reset link");
    } catch (err) {
      setError(err?.response?.data?.msg || "Request failed");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h2 className="auth-title">Forgot Password</h2>

        {error && <p className="auth-error">{error}</p>}
        {status && <p className="auth-link">{status}</p>}

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
