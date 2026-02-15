import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { fetchCustomer, updateCustomer } from "../api";
import { TagBadge } from "../components/TagBadge";
import { ScoreBar } from "../components/ScoreBar";
import { LtvPanel } from "../components/LtvAnalysis";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  if (!isLoading && data?.mergedInto) {
    return <Navigate to={`/customers/${data.mergedInto}`} replace />;
  }

  if (isLoading) return <div className="loading">読み込み中...</div>;
  if (!data?.data) return <div className="empty-state"><p>顧客が見つかりません</p></div>;

  const c = data.data;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {c.lastName} {c.firstName}
          </div>
          {c.companyName && (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.companyName}</div>
          )}
        </div>
        <button className={`btn btn-sm ${editing ? "btn-outline" : "btn-primary"}`} onClick={() => setEditing(!editing)}>
          {editing ? "閲覧" : "編集"}
        </button>
      </div>

      {/* Tags */}
      {c.tags && c.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {c.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
        </div>
      )}

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

// ---- View ----
type CustomerDetailData = NonNullable<Awaited<ReturnType<typeof fetchCustomer>>["data"]>;

function CustomerView({ customer: c }: { customer: CustomerDetailData }) {
  const allergies = parseAllergies(c.allergies);
  const preferences = parseJSON(c.preferences);

  return (
    <div>
      {/* Basic info */}
      <div className="card">
        <div className="section-title">基本情報</div>
        <div className="info-row"><span className="info-label">かな</span>{c.lastNameKana} {c.firstNameKana}</div>
        <div className="info-row"><span className="info-label">電話</span>{c.phone || "--"}</div>
        <div className="info-row"><span className="info-label">メール</span>{c.email || "--"}</div>
        <div className="info-row"><span className="info-label">言語</span>{c.language || "--"}</div>
        <div className="info-row"><span className="info-label">最終来店</span>{c.lastVisitAt ? format(new Date(c.lastVisitAt), "yyyy/MM/dd") : "--"}</div>
        {c.profileCompleteness != null && (
          <div className="info-row"><ScoreBar value={c.profileCompleteness} label="プロファイル" color="#0066ff" /></div>
        )}
      </div>

      {/* Corporate */}
      {(c.companyName || c.secretaryName || c.conciergeName) && (
        <div className="card">
          <div className="section-title">法人・紹介</div>
          {c.companyName && <div className="info-row"><span className="info-label">企業</span>{c.companyName}</div>}
          {c.companyRole && <div className="info-row"><span className="info-label">役職</span>{c.companyRole}</div>}
          {c.secretaryName && <div className="info-row"><span className="info-label">秘書</span>{c.secretaryName}</div>}
          {c.secretaryPhone && <div className="info-row"><span className="info-label">秘書TEL</span>{c.secretaryPhone}</div>}
          {c.conciergeName && <div className="info-row"><span className="info-label">コンシェルジュ</span>{c.conciergeName}</div>}
          {c.conciergeSource && <div className="info-row"><span className="info-label">紹介元</span>{c.conciergeSource}</div>}
          {c.referrerName && <div className="info-row"><span className="info-label">紹介者</span>{c.referrerName}</div>}
        </div>
      )}

      {/* Preferences */}
      {(allergies.length > 0 || c.dietaryRestrictions || preferences) && (
        <div className="card">
          <div className="section-title">嗜好・注意</div>
          {allergies.length > 0 && (
            <div style={{ padding: "4px 12px" }}>
              {allergies.map((a, i) => (
                <span key={i} className="tag" style={{
                  backgroundColor: a.severity === "critical" ? "#fef2f2" : "#fffbeb",
                  color: a.severity === "critical" ? "#dc2626" : "#d97706",
                  marginRight: 4, marginBottom: 4,
                }}>
                  {a.name} {a.severity && `(${a.severity})`}
                </span>
              ))}
            </div>
          )}
          {c.dietaryRestrictions && <div className="info-row"><span className="info-label">食事制限</span>{c.dietaryRestrictions}</div>}
          {preferences && Object.entries(preferences).map(([key, val]) => (
            <div className="info-row" key={key}><span className="info-label">{key}</span>{String(val)}</div>
          ))}
        </div>
      )}

      {c.internalNote && (
        <div className="card">
          <div className="section-title">メモ</div>
          <div style={{ padding: "4px 12px 12px", fontSize: 13, whiteSpace: "pre-wrap" }}>{c.internalNote}</div>
        </div>
      )}

      {/* LTV Analysis */}
      <LtvPanel reservations={c.reservations || []} existingLtv={c.ltvScore} />

      {/* Memberships */}
      {c.memberships && c.memberships.length > 0 && (
        <div className="card">
          <div className="section-title">メンバーシップ</div>
          {c.memberships.map((m) => (
            <div key={m.id} className="info-row">
              <span className="info-label">{m.tier}</span>
              {m.status} ({format(new Date(m.startDate), "yyyy/MM/dd")}〜)
            </div>
          ))}
        </div>
      )}

      {/* Reservations timeline */}
      <div className="card">
        <div className="section-title">来店タイムライン ({c.reservations?.length || 0}件)</div>
        {c.reservations?.length ? (
          c.reservations.map((r) => (
            <Link to={`/reservations/${r.id}`} key={r.id} className="info-row" style={{ fontSize: 12, textDecoration: "none", color: "inherit" }}>
              <span className="info-label">{format(new Date(r.dateTime), "M/d HH:mm")}</span>
              <span style={{ flex: 1 }}>{r.shop.name} {r.partySize}名</span>
              <span className={`status-badge status-${r.status.toLowerCase()}`} style={{ fontSize: 10 }}>{r.status}</span>
            </Link>
          ))
        ) : (
          <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--color-text-muted)" }}>来店履歴なし</div>
        )}
      </div>

      {c.mergedFrom && c.mergedFrom.length > 0 && (
        <div className="card">
          <div className="section-title">統合元</div>
          {c.mergedFrom.map((m) => (
            <div key={m.id} className="info-row" style={{ fontSize: 12 }}>
              {m.lastName} {m.firstName} ({m.id.slice(0, 8)})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Edit ----
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

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 8 }}>法人・紹介</div>
        <FormField label="企業名" value={form.companyName} onChange={set("companyName")} />
        <FormField label="役職" value={form.companyRole} onChange={set("companyRole")} />
        <FormField label="秘書" value={form.secretaryName} onChange={set("secretaryName")} />
        <FormField label="秘書TEL" value={form.secretaryPhone} onChange={set("secretaryPhone")} />
        <FormField label="秘書Email" value={form.secretaryEmail} onChange={set("secretaryEmail")} type="email" />
        <FormField label="コンシェルジュ" value={form.conciergeName} onChange={set("conciergeName")} />
        <FormField label="紹介元" value={form.conciergeSource} onChange={set("conciergeSource")} />
        <FormField label="紹介者" value={form.referrerName} onChange={set("referrerName")} />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 8 }}>嗜好・注意</div>
        <FormArea label="アレルギー" value={form.allergies} onChange={set("allergies")} placeholder='[{"name":"エビ","severity":"critical"}]' rows={2} />
        <FormField label="食事制限" value={form.dietaryRestrictions} onChange={set("dietaryRestrictions")} />
        <FormArea label="嗜好" value={form.preferences} onChange={set("preferences")} placeholder='{"好み":"赤ワイン"}' rows={2} />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 8 }}>メモ</div>
        <FormArea label="" value={form.internalNote} onChange={set("internalNote")} placeholder="スタッフ間の共有メモ..." rows={4} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onSave}>キャンセル</button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={mutation.isPending}>
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
  try { return JSON.parse(raw); } catch { return [{ name: raw }]; }
}

function parseJSON(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
