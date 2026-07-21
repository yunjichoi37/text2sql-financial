import { useEffect, useMemo, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createBatchRun, listTestset } from '../api'

const DIFFICULTY_ORDER = ['simple', 'moderate', 'challenging']
const DIFFICULTY_DOT_COLOR = {
  simple: 'var(--pass-text)',
  moderate: '#FFC000',
  challenging: 'var(--fail-text)',
}

function DifficultyDot({ difficulty }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: DIFFICULTY_DOT_COLOR[difficulty],
      }}
    />
  )
}

export default function BatchRunForm({ isOpen, onClose, onCreated }) {
  const [questions, setQuestions] = useState([])
  const [label, setLabel] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setLabel('')
    setFilter('')
    setStartError(null)
    listTestset()
      .then((data) => {
        setQuestions(data)
        setSelectedIds(new Set())
      })
      .catch(() => {})
  }, [isOpen])

  const availableDifficulties = useMemo(
    () => DIFFICULTY_ORDER.filter((d) => questions.some((q) => q.difficulty === d)),
    [questions]
  )

  const filteredQuestions = questions.filter((q) =>
    q.question.toLowerCase().includes(filter.toLowerCase())
  )

  function idsForDifficulty(d) {
    return questions.filter((q) => q.difficulty === d).map((q) => q.question_id)
  }

  function toggleDifficulty(d) {
    const ids = idsForDifficulty(d)
    const allSelected = ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    const ids = questions.map((q) => q.question_id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(ids))
  }

  async function handleRun() {
    setStarting(true)
    setStartError(null)
    try {
      const body = { label: label.trim() || null, question_ids: [...selectedIds] }
      const created = await createBatchRun(body)
      onCreated(created.id)
    } catch (e) {
      setStartError(e.message)
      setStarting(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      variant="standard"
      width={560}
      maxHeight="85vh"
      padding={6}
      purpose="info"
    >
      <Layout
        header={
          <DialogHeader title="새 테스트 등록" onOpenChange={(open) => !open && onClose()} />
        }
        content={
          <LayoutContent isScrollable={false}>
            <div className="batch-run-form">
              <input
                type="text"
                className="batch-label-input"
                placeholder="테스트명 (미입력 시 '배치 #번호')"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />

              <div className="difficulty-filter" role="group" aria-label="난이도 다중 선택">
                <Button
                  size="md"
                  variant={
                    questions.length > 0 && questions.every((q) => selectedIds.has(q.question_id))
                      ? 'primary'
                      : 'secondary'
                  }
                  label="전체"
                  onClick={toggleAll}
                />
                {availableDifficulties.map((d) => (
                  <Button
                    key={d}
                    size="md"
                    variant={idsForDifficulty(d).every((id) => selectedIds.has(id)) ? 'primary' : 'secondary'}
                    label={d}
                    icon={<DifficultyDot difficulty={d} />}
                    onClick={() => toggleDifficulty(d)}
                  />
                ))}
              </div>

              <TextInput
                label="질문 검색"
                isLabelHidden
                placeholder="질문 검색..."
                value={filter}
                onChange={setFilter}
                startIcon={<Icon icon="search" />}
                hasClear
              />

              <div className="batch-question-list">
                <CheckboxList
                  label="테스트셋 문항"
                  isLabelHidden
                  value={[...selectedIds].map(String)}
                  onChange={(values) => setSelectedIds(new Set(values.map(Number)))}
                  density="compact"
                  hasDividers
                >
                  {filteredQuestions.map((q) => (
                    <CheckboxListItem
                      key={q.question_id}
                      value={String(q.question_id)}
                      label={<span className="batch-question-label">{q.question}</span>}
                      endContent={q.difficulty && <DifficultyDot difficulty={q.difficulty} />}
                    />
                  ))}
                </CheckboxList>
                {filteredQuestions.length === 0 && <p className="muted">검색 결과가 없습니다.</p>}
              </div>

              {startError && <div className="cell-error">에러: {startError}</div>}
            </div>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <div className="batch-run-form-footer">
              <Button variant="secondary" label="취소" onClick={onClose} />
              <Button
                variant="primary"
                label={starting ? '실행 중...' : `${selectedIds.size}개 실행`}
                isDisabled={starting || selectedIds.size === 0}
                onClick={handleRun}
              />
            </div>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
