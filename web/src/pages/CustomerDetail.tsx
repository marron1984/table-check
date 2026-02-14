import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { fetchCustomer, updateCustomer } from "../api";
import { TagBadge } from "../components/TagBadge";
import { ScoreBar } from "../components/ScoreBar";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  // マージ先にリダイレクト
  if (!isLoading && data?.mergedInto) {
    return <Navigate to={`/customers/${data.mergedInto}`} replace />;
  }

  if (isLoading) return <div className="loading">読み込み中...</div>;
  if (!data?.data) return <div className="empty-state"><p>顧客が見つかりません</p></div>;

  const c = data.data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {c.lastName} {c.firstName}
          {c.companyName && <span style={{ fontSize: 14, color: "var(--color-text-muted)", marginLeft: 8 }}>({c.companyName})</span>}
        </h1>
        <button
          className={`btn ${editing ? "btn-outline" : "btn-primary"}`}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "閲覧モード" : "編集"}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        {c.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}
      </div>

      {editing ? (
        <CustomerEditForm customer={c} customerId={id!} onSave={() => {
          setEditing(false);
          queryClient.invalidateQueries({ queryKey: ["customer", id] });
        }} />
      ) : (
        <CustomerView customer={c} />
      )}
    </div>
  );
}

// ---- 閲覧モード ----
function CustomerView({ customer: c }: { customer: CustomerDetailData }) {
  const allergies = parseAllergies(c.allergies);
  const preferences = parseJSON(c.preferences);

  return (
    <div className="customer-card">
      <div>
        <div className="card">
          <div className="customer-section">
            <h3>基本情報</h3>
            <div className="info-row"><span className="info-label">氏名</span>{c.lastName} {c.firstName}</div>
            <div className="info-row"><span className="info-label">かな</span>{c.lastNameKana} {c.firstNameKana}</div>
            <div className="info-row"><span className="info-label">電話</span>{c.phone || "--"}</div>
            <div className="info-row"><span className="info-label">メール</span>{c.email || "--"}</div>
            <div className="info-row"><span className="info-label">言語</span>{c.language || "--"}</div>
            <div className="info-row"><span className="info-label">最終来店</span>{c.lastVisitAt ? format(new Date(c.lastVisitAt), "yyyy/MM/dd") : "--"}</div>
            {c.profileCompleteness != null && (
              <div className="info-row">
                <ScoreBar value={c.profileCompleteness} label="プロファイル充足" color="#2563eb" />
              </div>
            )}
          </div>
        </div>

        {(c.companyName || c.secretaryName || c.conciergeName) && (
          <div className="card">
            <div className="customer-section">
              <h3>法人・紹介</h3>
              {c.companyName && <div className="info-row"><span className="info-label">企業名</span>{c.companyName}</div>}
              {c.companyRole && <div className="info-row"><span className="info-label">役職</span>{c.companyRole}</div>}
              {c.secretaryName && <div className="info-row"><span className="info-label">秘書</span>{c.secretaryName}</div>}
              {c.secretaryPhone && <div className="info-row"><span className="info-label">秘書TEL</span>{c.secretaryPhone}</div>}
              {c.conciergeName && <div className="info-row"><span className="info-label">コンシェルジュ</span>{c.conciergeName}</div>}
              {c.conciergeSource && <div className="info-row"><span className="info-label">紹介元</span>{c.conciergeSource}</div>}
              {c.referrerName && <div className="info-row"><span className="info-label">紹介者</span>{c.referrerName}</div>}
            </div>
          </div>
        )}

        {(allergies.length > 0 || c.dietaryRestrictions || preferences) && (
          <div className="card">
            <div className="customer-section">
              <h3>嗜好・注意</h3>
              {allergies.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>アレルギー:</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: 20, fontSize: 13 }}>
                    {allergies.map((a, i) => (
                      <li key={i} style={{ color: a.severity === "critical" ? "var(--color-danger)" : undefined }}>
                        {a.name} {a.severity && `(${a.severity})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.dietaryRestrictions && (
                <div className="info-row"><span className="info-label">食事制限</span>{c.dietaryRestrictions}</div>
              )}
              {preferences && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {Object.entries(preferences).map(([key, val]) => (
                    <div className="info-row" key={key}>
                      <span className="info-label">{key}</span>{String(val)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {c.internalNote && (
          <div className="card">
            <div className="customer-section">
              <h3>店舗横断メモ</h3>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c.internalNote}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        {(c.ltvScore != null || c.returnProbability90 != null) && (
          <div className="card">
            <div className="customer-section">
              <h3>スコア</h3>
              {c.ltvScore != null && (
                <div className="info-row" style={{ fontSize: 18, fontWeight: 700 }}>
                  LTV: {c.ltvScore.toLocaleString()}円
                </div>
              )}
              {c.returnProbability90 != null && (
                <div className="info-row"><ScoreBar value={c.returnProbability90} label="再来店90日" color="#10b981" /></div>
              )}
              {c.returnProbability180 != null && (
                <div className="info-row"><ScoreBar value={c.returnProbability180} label="再来店180日" color="#0ea5e9" /></div>
              )}
              {c.cancelRisk != null && (
                <div className="info-row"><ScoreBar value={c.cancelRisk} label="キャンセルリスク" color="#ef4444" /></div>
              )}
            </div>
          </div>
        )}

        {c.memberships && c.memberships.length > 0 && (
          <div className="card">
            <div className="customer-section">
              <h3>メンバーシップ</h3>
              {c.memberships.map((m) => (
                <div key={m.id} className="info-row">
                  <span className="info-label">{m.tier}</span>
                  {m.status} ({format(new Date(m.startDate), "yyyy/MM/dd")}〜)
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="customer-section">
            <h3>来店タイムライン ({c.reservations?.length || 0}件)</h3>
            {c.reservations?.length ? (
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>店舗</th>
                    <th>人数</th>
                    <th>状態</th>
                    <th>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {c.reservations.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/reservations/${r.id}`}>
                          {format(new Date(r.dateTime), "M/d HH:mm")}
                        </Link>
                      </td>
                      <td>{r.shop.name}</td>
                      <td>{r.partySize}名</td>
                      <td>{r.status}</td>
                      <td>{r.courseName || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>来店履歴なし</p>
            )}
          </div>
        </div>

        {c.mergedFrom && c.mergedFrom.length > 0 && (
          <div className="card">
            <div className="customer-section">
              <h3>統合元レコード</h3>
              {c.mergedFrom.map((m) => (
                <div key={m.id} className="info-row" style={{ fontSize: 13 }}>
                  {m.lastName} {m.firstName} (ID: {m.id.slice(0, 8)})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 編集モード ----
interface EditFields {
  allergies: string;
  dietaryRestrictions: string;
  preferences: string;
  internalNote: string;
  companyName: string;
  companyRole: string;
  secretaryName: string;
  secretaryPhone: string;
  secretaryEmail: string;
  referrerName: string;
  conciergeName: string;
  conciergeSource: string;
}

type CustomerDetailData = NonNullable<Awaited<ReturnType<typeof fetchCustomer>>["data"]>;

function CustomerEditForm({ customer: c, customerId, onSave }: { customer: CustomerDetailData; customerId: string; onSave: () => void }) {
  const [form, setForm] = useState<EditFields>({
    allergies: c.allergies || "",
    dietaryRestrictions: c.dietaryRestrictions || "",
    preferences: c.preferences || "",
    internalNote: c.internalNote || "",
    companyName: c.companyName || "",
    companyRole: c.companyRole || "",
    secretaryName: c.secretaryName || "",
    secretaryPhone: c.secretaryPhone || "",
    secretaryEmail: c.secretaryEmail || "",
    referrerName: c.referrerName || "",
    conciergeName: c.conciergeName || "",
    conciergeSource: c.conciergeSource || "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCustomer(customerId, data),
    onSuccess: () => onSave(),
    onError: (err: Error) => setError(err.message),
  });

  const set = (field: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 変更があったフィールドのみ送信
    const changes: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(form)) {
      const original = (c as unknown as Record<string, unknown>)[key];
      const originalStr = original != null ? String(original) : "";
      if (value !== originalStr) {
        changes[key] = value || null;
      }
    }

    if (Object.keys(changes).length === 0) {
      onSave();
      return;
    }

    mutation.mutate(changes);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="customer-card">
        <div>
          <div className="card">
            <div className="customer-section">
              <h3>法人・紹介</h3>
              <FormField label="企業名" value={form.companyName} onChange={set("companyName")} />
              <FormField label="役職" value={form.companyRole} onChange={set("companyRole")} />
              <FormField label="秘書" value={form.secretaryName} onChange={set("secretaryName")} />
              <FormField label="秘書TEL" value={form.secretaryPhone} onChange={set("secretaryPhone")} />
              <FormField label="秘書Email" value={form.secretaryEmail} onChange={set("secretaryEmail")} type="email" />
              <FormField label="コンシェルジュ" value={form.conciergeName} onChange={set("conciergeName")} />
              <FormField label="紹介元" value={form.conciergeSource} onChange={set("conciergeSource")} />
              <FormField label="紹介者" value={form.referrerName} onChange={set("referrerName")} />
            </div>
          </div>

          <div className="card">
            <div className="customer-section">
              <h3>嗜好・注意</h3>
              <FormArea label="アレルギー" value={form.allergies} onChange={set("allergies")} placeholder='JSON形式: [{"name":"エビ","severity":"critical"}]' rows={3} />
              <FormField label="食事制限" value={form.dietaryRestrictions} onChange={set("dietaryRestrictions")} />
              <FormArea label="嗜好" value={form.preferences} onChange={set("preferences")} placeholder='JSON形式: {"好み":"赤ワイン"}' rows={3} />
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="customer-section">
              <h3>店舗横断メモ</h3>
              <FormArea label="" value={form.internalNote} onChange={set("internalNote")} placeholder="スタッフ間の共有メモを入力..." rows={8} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onSave}>キャンセル</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

// ---- Form helpers ----
function FormField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="form-row">
      {label && <label className="form-label">{label}</label>}
      <input className="form-input" type={type} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function FormArea({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number; placeholder?: string;
}) {
  return (
    <div className="form-row">
      {label && <label className="form-label">{label}</label>}
      <textarea className="form-input" value={value} onChange={onChange} rows={rows} placeholder={placeholder} />
    </div>
  );
}

// ---- Utils ----
function parseAllergies(raw: string | null): Array<{ name: string; severity?: string }> {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [{ name: raw }];
  }
}

function parseJSON(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
