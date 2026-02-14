import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { fetchReservation } from "../api";
import { TagBadge } from "../components/TagBadge";
import { AlertList } from "../components/AlertBadge";
import { ScoreBar } from "../components/ScoreBar";

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
      <h1 className="page-title">
        予約詳細 - {format(new Date(r.dateTime), "M月d日 HH:mm", { locale: ja })}
      </h1>

      <AlertList alerts={r.alerts} />

      <div className="customer-card" style={{ marginTop: 16 }}>
        {/* 左: 予約情報 */}
        <div className="card">
          <div className="customer-section">
            <h3>予約情報</h3>
            <div className="info-row"><span className="info-label">日時</span>{format(new Date(r.dateTime), "yyyy/MM/dd HH:mm")}</div>
            <div className="info-row"><span className="info-label">人数</span>{r.partySize}名</div>
            <div className="info-row"><span className="info-label">ステータス</span>{r.status}</div>
            <div className="info-row"><span className="info-label">店舗</span>{r.shop.name}</div>
            <div className="info-row"><span className="info-label">席</span>{r.tableLabel || "--"}</div>
            <div className="info-row"><span className="info-label">コース</span>{r.courseName || "--"}</div>
            <div className="info-row"><span className="info-label">用途</span>{r.occasion || "--"}</div>
            <div className="info-row"><span className="info-label">経路</span>{r.source || "--"}</div>
          </div>

          {r.specialRequests && (
            <div className="customer-section">
              <h3>特別リクエスト</h3>
              <p style={{ fontSize: 14 }}>{r.specialRequests}</p>
            </div>
          )}

          {r.internalMemo && (
            <div className="customer-section">
              <h3>内部メモ</h3>
              <p style={{ fontSize: 14 }}>{r.internalMemo}</p>
            </div>
          )}
        </div>

        {/* 右: 顧客カード */}
        {c ? (
          <div className="card">
            <div className="customer-section">
              <h3>
                <Link to={`/customers/${c.id}`}>
                  {c.lastName} {c.firstName}
                </Link>
              </h3>
              <div style={{ marginBottom: 8 }}>
                {c.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}
              </div>
              <div className="info-row"><span className="info-label">かな</span>{c.lastNameKana} {c.firstNameKana}</div>
              <div className="info-row"><span className="info-label">電話</span>{c.phone || "--"}</div>
              <div className="info-row"><span className="info-label">メール</span>{c.email || "--"}</div>
              <div className="info-row"><span className="info-label">企業</span>{c.companyName || "--"}</div>
              <div className="info-row"><span className="info-label">言語</span>{c.language || "--"}</div>
            </div>

            {c.allergies && (
              <div className="customer-section">
                <h3>アレルギー・食事制限</h3>
                <p style={{ fontSize: 14 }}>{c.allergies}</p>
                {c.dietaryRestrictions && <p style={{ fontSize: 14, marginTop: 4 }}>{c.dietaryRestrictions}</p>}
              </div>
            )}

            {(c.ltvScore != null || c.returnProbability90 != null) && (
              <div className="customer-section">
                <h3>スコア</h3>
                {c.ltvScore != null && (
                  <div className="info-row">LTV推定: {c.ltvScore.toLocaleString()}円</div>
                )}
                {c.returnProbability90 != null && (
                  <div className="info-row">
                    <ScoreBar value={c.returnProbability90} label="再来店90日" color="#10b981" />
                  </div>
                )}
                {c.cancelRisk != null && (
                  <div className="info-row">
                    <ScoreBar value={c.cancelRisk} label="キャンセルリスク" color="#ef4444" />
                  </div>
                )}
              </div>
            )}

            {c.reservations && c.reservations.length > 0 && (
              <div className="customer-section">
                <h3>来店履歴 (直近)</h3>
                {c.reservations.slice(0, 5).map((hr) => (
                  <div key={hr.id} className="info-row" style={{ fontSize: 13 }}>
                    <span className="info-label">{format(new Date(hr.dateTime), "M/d")}</span>
                    {hr.shop.name} / {hr.partySize}名 / {hr.status}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <p>顧客情報なし</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
