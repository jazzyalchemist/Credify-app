export function Metric({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <div className={"metric " + tone}>
      <p>{label}</p>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}
