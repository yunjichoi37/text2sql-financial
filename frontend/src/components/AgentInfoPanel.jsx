export default function AgentInfoPanel({ relevantTables, intermediateSteps }) {
  return (
    <div className="cell-info-panel">
      <div className="section-label">선택된 테이블</div>
      {relevantTables && relevantTables.length > 0 ? (
        <div className="info-table-chips">
          {relevantTables.map((table) => (
            <span key={table} className="info-table-chip">
              {table}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">정보 없음</p>
      )}

      <div className="section-label">에이전트 사고 흐름</div>
      {intermediateSteps && intermediateSteps.length > 0 ? (
        (() => {
          const sqlAttemptTotal = intermediateSteps.filter(
            (s) => s.tool === 'execute_sql_query'
          ).length
          let sqlAttemptCounter = 0

          return intermediateSteps.map((step, i) => {
            const isSqlStep = step.tool === 'execute_sql_query'
            if (isSqlStep) sqlAttemptCounter += 1
            const isError =
              typeof step.output === 'string' && step.output.startsWith('SQL 실행 에러')

            return (
              <div key={i} className={`agent-step${isError ? ' agent-step-error' : ''}`}>
                <div className="agent-step-tool">
                  {step.tool}
                  {isSqlStep && sqlAttemptTotal > 1 && (
                    <span className={`agent-step-attempt${isError ? ' is-error' : ''}`}>
                      시도 {sqlAttemptCounter}
                      {isError ? ' · 실행 에러' : ''}
                    </span>
                  )}
                </div>
                {step.input?.sql_query && (
                  <pre className="sql-block agent-step-sql">
                    <code>{step.input.sql_query}</code>
                  </pre>
                )}
                {step.output && <div className="agent-step-output">{step.output}</div>}
              </div>
            )
          })
        })()
      ) : (
        <p className="muted">기록 없음</p>
      )}
    </div>
  )
}
