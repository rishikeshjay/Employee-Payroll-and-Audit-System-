export default function Pill({ value }) {
  return <span className={`pill pill-${String(value).toLowerCase()}`}>{value}</span>;
}
