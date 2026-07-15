type Props = {
  total: number
  bookedSeats: number[]
  selected: number | null
  onSelect: (seat: number) => void
}

export function SeatMap({ total, bookedSeats, selected, onSelect }: Props) {
  const seats = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div>
      <div className="seat-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--seat-free)' }} />
          فارغ
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--seat-taken)' }} />
          محجوز
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--seat-selected)' }} />
          مختار
        </div>
      </div>
      <div className="seat-map">
        {seats.map((n) => {
          const taken = bookedSeats.includes(n)
          const isSelected = selected === n
          const cls = taken ? 'taken' : isSelected ? 'selected' : 'free'
          return (
            <button
              key={n}
              type="button"
              className={`seat ${cls}`}
              disabled={taken}
              onClick={() => onSelect(n)}
              aria-label={`مقعد ${n}`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
