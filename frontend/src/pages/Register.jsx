import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) {
      localStorage.setItem("pendingProjectCode", code.toUpperCase());
    }
  }, [location.search]);

  const register = async () => {
    try {
      await api.post("/auth/register", { name, email, password, role });
      navigate("/");
    } catch (err) {
      alert(err?.response?.data?.msg || "Registration failed");
    }
  };

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

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <h2 className="auth-title">Register</h2>

        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="mentor">Mentor</option>
          <option value="admin">Admin</option>
        </select>

        <button className="primary-btn" onClick={register}>
          Register
        </button>

        <p className="auth-link">
          Already registered? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}
