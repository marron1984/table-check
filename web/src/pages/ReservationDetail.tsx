import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { fetchReservation } from "../api";
import { TagBadge } from "../components/TagBadge";
import { AlertList } from "../components/AlertBadge";
import { ScoreBar } from "../components/ScoreBar";
import { analyzeLtv } from "../components/LtvAnalysis";

export function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["reservation", id],
    queryFn: () => fetchReservation(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="loading">読み込み中...</div>;
  if (!data?.data) return <div className="empty-state"><p>予約が見つかりません</p></div>;

  const r = data.data;
  const c = r.customer;

  return (
    <div>
      {/* Alerts */}
      {r.alerts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <AlertList alerts={r.alerts} />
        </div>
      )}

      {/* Reservation info */}
      <div className="card">
        <div className="section-title">予約情報</div>
        <div className="info-row"><span className="info-label">日時</span>{format(new Date(r.dateTime), "yyyy/MM/dd HH:mm")}</div>
        <div className="info-row"><span className="info-label">人数</span>{r.partySize}名</div>
        <div className="info-row"><span className="info-label">ステータス</span>
          <span className={`status-badge status-${r.status.toLowerCase()}`}>{r.status}</span>
        </div>
        <div className="info-row"><span className="info-label">店舗</span>{r.shop.name}</div>
        <div className="info-row"><span className="info-label">席</span>{r.tableLabel || "--"}</div>
        <div className="info-row"><span className="info-label">コース</span>{r.courseName || "--"}</div>
        <div className="info-row"><span className="info-label">用途</span>{r.occasion || "--"}</div>
        <div className="info-row"><span className="info-label">経路</span>{r.source || "--"}</div>
      </div>

      {r.specialRequests && (
        <div className="card">
          <div className="section-title">特別リクエスト</div>
          <div style={{ padding: "4px 12px 12px", fontSize: 13 }}>{r.specialRequests}</div>
        </div>
      )}

      {r.internalMemo && (
        <div className="card">
          <div className="section-title">内部メモ</div>
          <div style={{ padding: "4px 12px 12px", fontSize: 13 }}>{r.internalMemo}</div>
        </div>
      )}

      {/* Customer card */}
      {c ? (
        <div className="card">
          <div className="section-title">顧客</div>
          <div style={{ padding: "0 12px 8px" }}>
            <Link to={`/customers/${c.id}`} style={{ fontSize: 15, fontWeight: 600 }}>
              {c.lastName} {c.firstName}
            </Link>
            {c.tags && c.tags.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                {c.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
              </div>
            )}
          </div>
          <div className="info-row"><span className="info-label">かな</span>{c.lastNameKana} {c.firstNameKana}</div>
          <div className="info-row"><span className="info-label">電話</span>{c.phone || "--"}</div>
          <div className="info-row"><span className="info-label">メール</span>{c.email || "--"}</div>
          <div className="info-row"><span className="info-label">企業</span>{c.companyName || "--"}</div>

          {c.allergies && (
            <div className="info-row"><span className="info-label">アレルギー</span>{c.allergies}</div>
          )}

          {c.reservations && c.reservations.length > 0 && (() => {
            const ltv = analyzeLtv(c.reservations, c.ltvScore ?? null);
            return (
              <>
                <div className="info-row">
                  <span className="info-label">セグメント</span>
                  <span style={{
                    padding: "1px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: ltv.segmentColor + "18", color: ltv.segmentColor,
                  }}>{ltv.segmentLabel}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">予測LTV(12m)</span>
                  {ltv.predictedLtv12m >= 10000
                    ? `${(ltv.predictedLtv12m / 10000).toFixed(1)}万`
                    : `¥${ltv.predictedLtv12m.toLocaleString()}`}
                </div>
                <div className="info-row">
                  <span className="info-label">P(Active)</span>{Math.round(ltv.isAlive * 100)}%
                </div>
                {c.cancelRisk != null && (
                  <div className="info-row"><ScoreBar value={c.cancelRisk} label="キャンセル" color="#e53935" /></div>
                )}
              </>
            );
          })()}

          {c.reservations && c.reservations.length > 0 && (
            <>
              <div className="section-title">来店履歴</div>
              {c.reservations.slice(0, 5).map((hr) => (
                <div key={hr.id} className="info-row" style={{ fontSize: 12 }}>
                  <span className="info-label">{format(new Date(hr.dateTime), "M/d")}</span>
                  {hr.shop.name} / {hr.partySize}名 / {hr.status}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state"><p>顧客情報なし</p></div>
        </div>
      )}
    </div>
  );
}
