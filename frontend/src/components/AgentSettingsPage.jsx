import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { getAgentSettings, previewAgentSettings, updateAgentSettings } from '../api'
import AgentInfoPanel from './AgentInfoPanel'
import CellResultBody from './CellResultBody'

export default function AgentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [temperature, setTemperature] = useState(0)
  const [useTableFiltering, setUseTableFiltering] = useState(false)
  const [useEvidence, setUseEvidence] = useState(true)
  const [agentPrefix, setAgentPrefix] = useState('')
  const [queryReminder, setQueryReminder] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  const [previewQuestion, setPreviewQuestion] = useState('')
  const [previewEvidence, setPreviewEvidence] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [previewResult, setPreviewResult] = useState(null)

  useEffect(() => {
    getAgentSettings()
      .then((data) => {
        setTemperature(data.temperature)
        setUseTableFiltering(data.use_table_filtering)
        setUseEvidence(data.use_evidence)
        setAgentPrefix(data.agent_prefix)
        setQueryReminder(data.query_reminder)
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function currentFormValues() {
    return {
      temperature: Number(temperature),
      use_table_filtering: useTableFiltering,
      use_evidence: useEvidence,
      agent_prefix: agentPrefix,
      query_reminder: queryReminder,
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await updateAgentSettings(currentFormValues())
      setSaved(true)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePreview() {
    setPreviewing(true)
    setPreviewError(null)
    setPreviewResult(null)
    try {
      const result = await previewAgentSettings({
        question: previewQuestion,
        evidence: previewEvidence || null,
        ...currentFormValues(),
      })
      setPreviewResult(result)
    } catch (e) {
      setPreviewError(e.message)
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) return <p className="muted">불러오는 중...</p>
  if (loadError) return <p className="cell-error">에러: {loadError}</p>

  return (
    <div className="agent-settings-page">
      <div className="cell agent-settings-form">
        <div className="section-label">Temperature</div>
        <input
          className="batch-label-input"
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={temperature}
          onChange={(e) => {
            setTemperature(e.target.value)
            setSaved(false)
          }}
        />

        <div className="section-label">동작 옵션</div>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={useTableFiltering}
            onChange={(e) => {
              setUseTableFiltering(e.target.checked)
              setSaved(false)
            }}
          />
          테이블 필터링 사용 (질문과 관련된 테이블만 LLM으로 선별)
        </label>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={useEvidence}
            onChange={(e) => {
              setUseEvidence(e.target.checked)
              setSaved(false)
            }}
          />
          Evidence 힌트 사용 (테스트셋의 Evidence를 프롬프트에 포함)
        </label>

        <div className="section-label">에이전트 프롬프트</div>
        <textarea
          rows={16}
          value={agentPrefix}
          onChange={(e) => {
            setAgentPrefix(e.target.value)
            setSaved(false)
          }}
        />

        <div className="section-label">쿼리 리마인더 (프롬프트 끝에 항상 덧붙는 문구)</div>
        <textarea
          rows={2}
          value={queryReminder}
          onChange={(e) => {
            setQueryReminder(e.target.value)
            setSaved(false)
          }}
        />

        {saveError && <div className="cell-error">저장 실패: {saveError}</div>}

        <div className="settings-save-row">
          <Button
            variant="primary"
            label={saving ? '저장 중...' : '저장'}
            isDisabled={saving}
            onClick={handleSave}
          />
          {saved && <span className="settings-saved-note">저장되었습니다</span>}
        </div>
      </div>

      <div className="cell agent-settings-preview">
        <div className="section-label">미리보기 (저장 전 값으로 실제 실행)</div>
        <textarea
          rows={3}
          placeholder="테스트할 질문을 입력하세요..."
          value={previewQuestion}
          onChange={(e) => setPreviewQuestion(e.target.value)}
        />
        <input
          className="batch-label-input"
          placeholder="Evidence (선택)"
          value={previewEvidence}
          onChange={(e) => setPreviewEvidence(e.target.value)}
        />

        {previewError && <div className="cell-error">에러: {previewError}</div>}

        <Button
          variant="secondary"
          label={previewing ? '실행 중...' : '미리보기 실행'}
          isDisabled={previewing || !previewQuestion.trim()}
          onClick={handlePreview}
        />

        {previewing && (
          <div className="cell-pending-status">
            <span className="spinner" />
            AI가 현재(저장 전) 설정으로 SQL을 생성하고 실행하는 중...
          </div>
        )}

        {previewResult && !previewing && (
          <>
            <CellResultBody
              error={previewResult.error}
              aiSql={previewResult.ai_sql}
              aiAnswer={previewResult.ai_answer}
              aiResult={previewResult.ai_result}
              mode="freeform"
            />
            <AgentInfoPanel
              relevantTables={previewResult.relevant_tables}
              intermediateSteps={previewResult.intermediate_steps}
            />
          </>
        )}
      </div>
    </div>
  )
}
