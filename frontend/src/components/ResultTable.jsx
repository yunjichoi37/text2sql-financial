// 쿼리 결과(array of object)를 HTML 표로 렌더링. AI 결과/정답 결과 공용.
// data === null: 쿼리가 실행되지 않음(에러 등) / data === []: 쿼리는 실행됐지만 0행
export default function ResultTable({ data }) {
  if (data == null) {
    return <p className="muted">실행된 결과 없음</p>
  }
  if (data.length === 0) {
    return <p className="muted">쿼리 결과 0행</p>
  }

  const columns = Object.keys(data[0])

  return (
    <div className="result-table-wrap">
      <table className="result-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>{String(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
