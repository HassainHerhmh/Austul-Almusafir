import { useBrand } from '../context/BrandContext'

type Props = {
  sub?: string
  className?: string
}

export function BrandMark({ sub, className }: Props) {
  const { name, logoUrl } = useBrand()

  return (
    <div className={`brand-mark${className ? ` ${className}` : ''}`}>
      <div className={`brand-icon${logoUrl ? ' has-logo' : ''}`}>
        {logoUrl ? <img src={logoUrl} alt="" /> : <span aria-hidden>🚌</span>}
      </div>
      <div>
        <div className="brand-name">{name}</div>
        {sub ? <div className="brand-sub">{sub}</div> : null}
      </div>
    </div>
  )
}
