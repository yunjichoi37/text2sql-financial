import ResultTable from './ResultTable'

export default function CellResultBody({
  error,
  aiSql,
  aiAnswer,
  aiResult,
  mode,
  goldSql,
  goldResult,
  stale = false,
}) {
  return (
    <>
      {error && <div className="cell-error">에러: {error}</div>}

      {aiSql && (
        <>
          <div className="section-label">AI가 생성한 SQL</div>
          <pre className="sql-block">
            <code>{aiSql}</code>
          </pre>
        </>
      )}

      {aiAnswer && <div className="cell-answer">{aiAnswer}</div>}

      <div className={stale ? 'cell-results stale' : 'cell-results'}>
        <div className="section-label">
          실행 결과
          {Array.isArray(aiResult) && <span className="row-count"> ({aiResult.length}행)</span>}
          {stale && <span className="stale-note"> (재실행 중 - 아래는 이전 결과)</span>}
        </div>
        <ResultTable data={aiResult} />

        {mode === 'testset' && (
          <div className="testset-block">
            <div className="section-label">정답 SQL</div>
            <pre className="sql-block gold">
              <code>{goldSql}</code>
            </pre>
            <div className="section-label">
              정답 결과
              {Array.isArray(goldResult) && <span className="row-count"> ({goldResult.length}행)</span>}
            </div>
            <ResultTable data={goldResult} />
          </div>
        )}
      </div>
    </>
  )
}
