export default function VerdictBadge({ verdict }) {
  if (verdict === true) {
    return <span className="badge badge-pass">✅ 일치</span>
  }
  if (verdict === false) {
    return <span className="badge badge-fail">❌ 불일치</span>
  }
  return <span className="badge badge-unknown">— 미계산</span>
}
