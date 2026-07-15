import { useBrand } from '../context/BrandContext'

type Props = {
  sub?: string
  className?: string
  collapsed?: boolean
}

export function BrandMark({ sub, className, collapsed }: Props) {
  const { name, logoUrl } = useBrand()

  return (
    <div
      className={`brand-mark${collapsed ? ' brand-mark-collapsed' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <div className={`brand-icon${logoUrl ? ' has-logo' : ''}`}>
        {logoUrl ? <img src={logoUrl} alt="" /> : <span aria-hidden>🚌</span>}
      </div>
      {!collapsed ? (
        <div>
          <div className="brand-name">{name}</div>
          {sub ? <div className="brand-sub">{sub}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
