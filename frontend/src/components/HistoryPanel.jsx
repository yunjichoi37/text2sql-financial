import VerdictBadge from './VerdictBadge'

export default function HistoryPanel({ cells, onSelect }) {
  const testsetCells = cells.filter((c) => c.mode === 'testset')

  if (testsetCells.length === 0) {
    return <p className="muted">아직 실행한 테스트셋 질문이 없습니다.</p>
  }

  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>질문</th>
          <th>난이도</th>
          <th>결과</th>
          <th>시각</th>
        </tr>
      </thead>
      <tbody>
        {testsetCells.map((c) => (
          <tr key={c.id} className="history-row" onClick={() => onSelect(c.id)}>
            <td>{c.question}</td>
            <td>{c.difficulty}</td>
            <td>
              <VerdictBadge verdict={c.match_verdict} />
            </td>
            <td>{new Date(c.updated_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
