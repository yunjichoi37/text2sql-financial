import { Badge } from '@astryxdesign/core/Badge'
import { Icon } from '@astryxdesign/core/Icon'

const badgeStyle = { verticalAlign: 'middle' }
const warningBadgeStyle = { ...badgeStyle, backgroundColor: 'transparent', color: '#FFC000' }

export default function VerdictBadge({ verdict, softF1 }) {
  if (verdict === true) {
    return <Badge variant="success" icon={<Icon icon="success" />} label="일치" style={badgeStyle} />
  }
  if (verdict === false) {
    const pct = typeof softF1 === 'number' ? Math.round(softF1 * 100) : 0
    if (pct <= 0) {
      return <Badge variant="error" icon={<Icon icon="error" />} label="불일치" style={badgeStyle} />
    }
    return (
      <Badge
        variant="warning"
        icon={<Icon icon="warning" color="inherit" />}
        label={`${pct}%`}
        style={warningBadgeStyle}
      />
    )
  }
  return <Badge variant="neutral" label="미계산" style={badgeStyle} />
}
