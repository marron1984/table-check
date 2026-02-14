import { useState } from "react";

export function Login({ onLogin }: { onLogin: (staffId: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = name.trim() || "管理者";
    // demo-staff はシードで作成済みのADMINアカウント
    onLogin("demo-staff", displayName);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>TableCheck CRM</h1>
          <p>スタッフログイン</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <label className="form-label">表示名</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="例: 山田太郎"
              autoFocus
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
            デモ環境: 管理者権限でログインします
          </p>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
