import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable'
import AgentInfoPanel from './AgentInfoPanel'
import CellResultBody from './CellResultBody'
import VerdictBadge from './VerdictBadge'

export default function Cell({ cell, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(cell.question)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const infoPanelResize = useResizable({ defaultSize: 300, minSizePx: 220, maxSizePx: 480 })

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
    <div
      className={showInfo ? 'cell with-info-panel' : 'cell'}
      id={`cell-${cell.id}`}
      style={showInfo ? { '--info-panel-width': `${infoPanelResize.size}px` } : undefined}
    >
      <div className="cell-top">
        <div className="cell-header" onClick={() => setCollapsed((c) => !c)}>
          <span className={`mode-tag mode-${cell.mode}`}>
            {cell.mode === 'testset' ? '테스트' : '직접 질문'}
          </span>
          {cell.difficulty && <span className="difficulty-tag">{cell.difficulty}</span>}
          {typeof cell.duration_ms === 'number' && (
            <span className="duration-tag">{(cell.duration_ms / 1000).toFixed(1)}s</span>
          )}
          <div className="cell-header-trailing">
            {cell.mode === 'testset' && <VerdictBadge verdict={cell.match_verdict} softF1={cell.soft_f1} />}
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
          <CellResultBody
            error={cell.error}
            aiSql={cell.ai_sql}
            aiAnswer={cell.ai_answer}
            aiResult={cell.ai_result}
            mode={cell.mode}
            goldSql={cell.gold_sql}
            goldResult={cell.gold_result}
            stale={busy}
          />
        </div>
      </div>

      {showInfo && (
        <>
          <ResizeHandle
            resizable={infoPanelResize.props}
            direction="horizontal"
            isReversed
            hasDivider
            label="정보 패널 크기 조절"
          />
          <AgentInfoPanel
            relevantTables={cell.relevant_tables}
            intermediateSteps={cell.intermediate_steps}
          />
        </>
      )}
    </div>
  )
}
