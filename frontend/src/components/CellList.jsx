import Cell from './Cell'
import NewCellComposer from './NewCellComposer'

const EMPTY_TEXT = {
  testset: '아직 실행한 테스트셋 질문이 없습니다.',
  freeform: '아직 실행한 질문이 없습니다.',
}

export default function CellList({ cells, mode, onCreate, onUpdate, onDelete }) {
  const ordered = [...cells].reverse()

  return (
    <div className="cell-list">
      <NewCellComposer mode={mode} onCreate={onCreate} />
      {ordered.length === 0 && <p className="muted">{EMPTY_TEXT[mode]}</p>}
      {ordered.map((cell) => (
        <Cell key={cell.id} cell={cell} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  )
}
