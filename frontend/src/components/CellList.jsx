import Cell from './Cell'
import NewCellComposer from './NewCellComposer'

export default function CellList({ cells, onCreate, onUpdate, onDelete }) {
  return (
    <div className="cell-list">
      {cells.length === 0 && <p className="muted">아직 셀이 없습니다.</p>}
      {cells.map((cell) => (
        <Cell key={cell.id} cell={cell} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
      <NewCellComposer onCreate={onCreate} />
    </div>
  )
}
