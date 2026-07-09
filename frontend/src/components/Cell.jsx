import { useState } from 'react'
import ResultTable from './ResultTable'
import VerdictBadge from './VerdictBadge'

export default function Cell({ cell, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cell.question)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)

  const isFreeform = cell.mode === 'freeform'

  async function runUpdate(body) {
    setBusy(true)
    setLocalError(null)
    try {
      await onUpdate(cell.id, body)
      setEditing(false)
    } catch (e) {
      setLocalError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setLocalError(null)
    try {
      await onDelete(cell.id)
    } catch (e) {
      setLocalError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="cell" id={`cell-${cell.id}`}>
      <div className="cell-header">
        <span className={`mode-tag mode-${cell.mode}`}>
          {cell.mode === 'testset' ? '테스트' : '직접 질문'}
        </span>
        {cell.difficulty && <span className="difficulty-tag">{cell.difficulty}</span>}
      </div>

      {editing ? (
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <div className="cell-question">{cell.question}</div>
      )}

      <div className="cell-actions">
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => runUpdate({ question: draft })}
            >
              저장 후 재실행
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)}>
              취소
            </button>
          </>
        ) : (
          <>
            {isFreeform && (
              <button type="button" disabled={busy} onClick={() => setEditing(true)}>
                수정
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => runUpdate({})}>
              {busy ? '실행 중...' : '다시 실행'}
            </button>
            <button type="button" disabled={busy} onClick={handleDelete}>
              삭제
            </button>
          </>
        )}
      </div>

      {localError && <div className="cell-error">에러: {localError}</div>}
      {cell.error && <div className="cell-error">에러: {cell.error}</div>}

      {cell.ai_sql && (
        <>
          <div className="section-label">AI가 생성한 SQL</div>
          <pre className="sql-block">
            <code>{cell.ai_sql}</code>
          </pre>
        </>
      )}

      {cell.ai_answer && <div className="cell-answer">{cell.ai_answer}</div>}

      <div className="section-label">실행 결과</div>
      <ResultTable data={cell.ai_result} />

      {cell.mode === 'testset' && (
        <div className="testset-block">
          <div className="section-label">정답 SQL</div>
          <pre className="sql-block gold">
            <code>{cell.gold_sql}</code>
          </pre>
          <div className="section-label">정답 결과</div>
          <ResultTable data={cell.gold_result} />
          <VerdictBadge verdict={cell.match_verdict} />
        </div>
      )}
    </div>
  )
}
