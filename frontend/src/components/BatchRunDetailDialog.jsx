import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import VerdictBadge from './VerdictBadge'

const ITEM_COLUMNS = [
  { key: 'seq', header: '#', width: pixel(64), align: 'center' },
  { key: 'question', header: '질문', width: proportional(3) },
  {
    key: 'difficulty',
    header: '난이도',
    width: pixel(90),
    align: 'center',
    renderCell: (item) => item.difficulty || '—',
  },
  {
    key: 'match_verdict',
    header: '결과',
    width: pixel(90),
    align: 'center',
    renderCell: (item) => <VerdictBadge verdict={item.match_verdict} softF1={item.soft_f1} />,
  },
  {
    key: 'duration_ms',
    header: '소요시간',
    width: pixel(80),
    align: 'center',
    renderCell: (item) =>
      typeof item.duration_ms === 'number' ? `${(item.duration_ms / 1000).toFixed(1)}s` : '—',
  },
]

export default function BatchRunDetailDialog({ run, onClose }) {
  const config = run?.config_snapshot

  return (
    <Dialog
      isOpen={run != null}
      onOpenChange={(open) => !open && onClose()}
      variant="standard"
      width={960}
      maxHeight="85vh"
      padding={6}
      purpose="info"
    >
      <Layout
        header={
          <DialogHeader
            title={run ? run.label || `배치 #${run.id}` : ''}
            subtitle={run ? new Date(run.started_at).toLocaleString() : undefined}
            onOpenChange={(open) => !open && onClose()}
          />
        }
        content={
          <LayoutContent isScrollable={false}>
            {run && (
              <div className="run-detail-scroll">
                <div className="run-detail-meta">
                  <span className={`batch-status-tag batch-status-${run.status}`}>
                    {run.status === 'running' ? '실행 중' : run.status === 'completed' ? '완료' : '실패'}
                  </span>
                  <span className="difficulty-tag">범위: {run.scope}</span>
                  {run.ex_correct != null && (
                    <span className="difficulty-tag">
                      EX {run.ex_correct}/{run.total_count}
                    </span>
                  )}
                  {run.soft_f1_avg != null && (
                    <span className="difficulty-tag">
                      Soft F1 평균 {Math.round(run.soft_f1_avg * 100)}%
                    </span>
                  )}
                  {typeof run.duration_ms === 'number' && (
                    <span className="duration-tag">{(run.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                </div>

                {config && (
                  <>
                    <div className="section-label">실행 설정</div>
                    <dl className="batch-config-grid">
                      <dt>모델</dt>
                      <dd>{config.model_name}</dd>
                      <dt>Temperature</dt>
                      <dd>{config.temperature}</dd>
                      <dt>테이블 필터링</dt>
                      <dd>{config.use_table_filtering ? 'ON' : 'OFF'}</dd>
                      <dt>최대 표시 행 수</dt>
                      <dd>{config.max_rows_in_context}</dd>
                    </dl>
                    <pre className="sql-block">
                      <code>{config.agent_prefix}</code>
                    </pre>
                  </>
                )}

                <div className="section-label">
                  문항별 결과
                  <span className="row-count"> ({run.items.length}개)</span>
                </div>
                <Table
                  data={run.items.map((item, i) => ({ ...item, seq: i + 1 }))}
                  columns={ITEM_COLUMNS}
                  idKey="id"
                  density="compact"
                  dividers="grid"
                />
              </div>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
