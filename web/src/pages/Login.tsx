import { useState } from "react";

export function Login({ onLogin }: { onLogin: (staffId: string, name: string) => void }) {
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim()) {
      setError("スタッフIDを入力してください");
      return;
    }
    onLogin(staffId.trim(), name.trim() || staffId.trim());
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
            <label className="form-label">スタッフID</label>
            <input
              className="form-input"
              type="text"
              value={staffId}
              onChange={(e) => { setStaffId(e.target.value); setError(""); }}
              placeholder="例: staff-001"
              autoFocus
            />
          </div>
          <div className="form-row">
            <label className="form-label">表示名（任意）</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田太郎"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
