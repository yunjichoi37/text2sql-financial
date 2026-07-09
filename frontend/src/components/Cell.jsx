import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import AgentInfoPanel from './AgentInfoPanel'
import ResultTable from './ResultTable'
import VerdictBadge from './VerdictBadge'

export default function Cell({ cell, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(cell.question)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

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
      setConfirmingDelete(false)
    }
  }

  return (
    <div className={showInfo ? 'cell with-info-panel' : 'cell'} id={`cell-${cell.id}`}>
      <div className="cell-top">
        <div className="cell-header" onClick={() => setCollapsed((c) => !c)}>
          <span className={`mode-tag mode-${cell.mode}`}>
            {cell.mode === 'testset' ? '테스트' : '직접 질문'}
          </span>
          {cell.difficulty && <span className="difficulty-tag">{cell.difficulty}</span>}
          {typeof cell._durationMs === 'number' && (
            <span className="duration-tag">{(cell._durationMs / 1000).toFixed(1)}초</span>
          )}
          <div className="cell-header-trailing">
            {cell.mode === 'testset' && <VerdictBadge verdict={cell.match_verdict} />}
            <Button
              className={showInfo ? 'info-toggle active' : 'info-toggle'}
              variant="ghost"
              size="sm"
              isIconOnly
              icon={<Icon icon="info" />}
              label={showInfo ? '에이전트 정보 닫기' : '에이전트 정보 보기'}
              onClick={(e) => {
                e.stopPropagation()
                setShowInfo((v) => {
                  const next = !v
                  if (next && collapsed) setCollapsed(false)
                  return next
                })
              }}
            />
            <Button
              className={collapsed ? 'collapse-toggle' : 'collapse-toggle expanded'}
              variant="ghost"
              size="sm"
              isIconOnly
              icon={<Icon icon="chevronDown" />}
              label={collapsed ? '펼치기' : '접기'}
              aria-expanded={!collapsed}
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((c) => !c)
              }}
            />
          </div>
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
              <Button
                variant="primary"
                size="sm"
                label="저장 후 재실행"
                isDisabled={busy || !draft.trim()}
                onClick={() => runUpdate({ question: draft })}
              />
              <Button
                variant="secondary"
                size="sm"
                label="취소"
                isDisabled={busy}
                onClick={() => setEditing(false)}
              />
            </>
          ) : (
            <>
              {isFreeform && (
                <Button
                  variant="secondary"
                  size="sm"
                  label="수정"
                  isDisabled={busy}
                  onClick={() => setEditing(true)}
                />
              )}
              <Button
                variant="primary"
                size="sm"
                label={busy ? '실행 중...' : '다시 실행'}
                isDisabled={busy}
                onClick={() => runUpdate({})}
              />
              {confirmingDelete ? (
                <>
                  <span className="delete-confirm-label">정말 삭제할까요?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    label={busy ? '삭제 중...' : '삭제 확인'}
                    isDisabled={busy}
                    onClick={handleDelete}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    label="취소"
                    isDisabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  />
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  label="삭제"
                  isDisabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className={collapsed ? 'cell-collapsible' : 'cell-collapsible expanded'}>
        <div className="cell-collapsible-inner">
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

          <div className={busy ? 'cell-results stale' : 'cell-results'}>
            <div className="section-label">
              실행 결과
              {Array.isArray(cell.ai_result) && (
                <span className="row-count"> ({cell.ai_result.length}행)</span>
              )}
              {busy && <span className="stale-note"> (재실행 중 - 아래는 이전 결과)</span>}
            </div>
            <ResultTable data={cell.ai_result} />

            {cell.mode === 'testset' && (
              <div className="testset-block">
                <div className="section-label">정답 SQL</div>
                <pre className="sql-block gold">
                  <code>{cell.gold_sql}</code>
                </pre>
                <div className="section-label">
                  정답 결과
                  {Array.isArray(cell.gold_result) && (
                    <span className="row-count"> ({cell.gold_result.length}행)</span>
                  )}
                </div>
                <ResultTable data={cell.gold_result} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showInfo && (
        <AgentInfoPanel
          relevantTables={cell.relevant_tables}
          intermediateSteps={cell.intermediate_steps}
        />
      )}
    </div>
  )
}
