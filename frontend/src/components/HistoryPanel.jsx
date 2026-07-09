import VerdictBadge from './VerdictBadge'

export default function HistoryPanel({ cells, onSelect }) {
  const sorted = [...cells].sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  )

  if (sorted.length === 0) {
    return <p className="muted">아직 실행 기록이 없습니다.</p>
  }

  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>모드</th>
          <th>질문</th>
          <th>난이도</th>
          <th>결과</th>
          <th>시각</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.id} className="history-row" onClick={() => onSelect(c.id)}>
            <td>
              <span className={`mode-tag mode-${c.mode}`}>
                {c.mode === 'testset' ? '테스트' : '직접 질문'}
              </span>
            </td>
            <td>{c.question}</td>
            <td>{c.difficulty || '—'}</td>
            <td>
              {c.mode === 'testset' ? (
                <VerdictBadge verdict={c.match_verdict} />
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>{new Date(c.updated_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
