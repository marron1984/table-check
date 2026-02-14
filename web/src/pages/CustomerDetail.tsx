import { useQuery } from "@tanstack/react-query";
import { useParams, Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { fetchCustomer } from "../api";
import { TagBadge } from "../components/TagBadge";
import { ScoreBar } from "../components/ScoreBar";

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="loading">読み込み中...</div>;

  // マージ先にリダイレクト
  if (data?.mergedInto) {
    return <Navigate to={`/customers/${data.mergedInto}`} replace />;
  }

  if (!data?.data) return <div className="empty-state"><p>顧客が見つかりません</p></div>;

  const c = data.data;
  const allergies = parseAllergies(c.allergies);
  const preferences = parseJSON(c.preferences);

  return (
    <div>
      <h1 className="page-title">
        {c.lastName} {c.firstName}
        {c.companyName && <span style={{ fontSize: 14, color: "var(--color-text-muted)", marginLeft: 8 }}>({c.companyName})</span>}
      </h1>

      <div style={{ marginBottom: 12 }}>
        {c.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}
      </div>

      <div className="customer-card">
        {/* 左: 基本情報 + 嗜好 */}
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

        {/* 右: スコア + 来店タイムライン */}
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
    </div>
  );
}

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
