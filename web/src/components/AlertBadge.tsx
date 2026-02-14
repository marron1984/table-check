import type { Alert } from "../api";

export function AlertBadge({ alert }: { alert: Alert }) {
  return (
    <span className={`alert-badge alert-${alert.severity}`}>
      {alert.severity === "CRITICAL" && "!!"}
      {alert.severity === "HIGH" && "!"}
      {alert.message}
    </span>
  );
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {alerts.map((a) => (
        <AlertBadge key={a.id} alert={a} />
      ))}
    </div>
  );
}
