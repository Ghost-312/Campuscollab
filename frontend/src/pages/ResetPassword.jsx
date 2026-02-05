import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (score <= 2) return { label: "Weak", level: "weak" };
    if (score <= 4) return { label: "Okay", level: "ok" };
    return { label: "Strong", level: "strong" };
  }, [password]);

  const isStrongPassword = value => {
    if (value.length < 8) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
  };

  const submit = async () => {
    setError("");
    setStatus("");
    if (!token) {
      setError("Missing reset token");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be at least 8 characters and include upper, lower, number, and symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setStatus(res.data?.msg || "Password updated");
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(err?.response?.data?.msg || "Reset failed");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h2 className="auth-title">Reset Password</h2>

        {error && <p className="auth-error">{error}</p>}
        {status && <p className="auth-link">{status}</p>}

        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(v => !v)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className={`password-strength strength-${strength.level}`}>
          Strength: {strength.label}
        </div>
        <div className="password-rules">
          Use 8+ chars with upper, lower, number, and symbol.
        </div>

        <div className="password-field">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowConfirm(v => !v)}
          >
            {showConfirm ? "Hide" : "Show"}
          </button>
        </div>

        <button className="primary-btn" onClick={submit}>
          Update Password
        </button>

        <p className="auth-link">
          Back to <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}
