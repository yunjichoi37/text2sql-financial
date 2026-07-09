import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import TestsetPicker from './TestsetPicker'

export default function NewCellComposer({ mode, onCreate }) {
  const [question, setQuestion] = useState('')
  const [testsetQuestionId, setTestsetQuestionId] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const canRun =
    mode === 'freeform' ? question.trim().length > 0 : testsetQuestionId != null

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      const body =
        mode === 'freeform'
          ? { mode: 'freeform', question }
          : { mode: 'testset', testset_question_id: testsetQuestionId }
      await onCreate(body)
      setQuestion('')
      setTestsetQuestionId(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="cell new-cell">
      {mode === 'freeform' ? (
        <textarea
          rows={3}
          placeholder="질문을 입력하세요..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      ) : (
        <TestsetPicker value={testsetQuestionId} onChange={setTestsetQuestionId} />
      )}

      {error && <div className="cell-error">에러: {error}</div>}

      <Button
        variant="primary"
        label={running ? '실행 중...' : '실행'}
        isDisabled={!canRun || running}
        onClick={handleRun}
        className="run-button"
      />
    </div>
  )
}
