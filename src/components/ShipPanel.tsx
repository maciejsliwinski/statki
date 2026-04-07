import type { Orientation } from '../store/ships'

export type ShipEntry = {
  id: string
  name: string
  size: number
  total: number
  placed: number
}

type ShipPanelProps = {
  ships: ShipEntry[]
  selected: { id: string; orientation: Orientation } | null
  onSelect: (id: string, size: number) => void
  onToggleOrientation: () => void
  onRandomPlace: () => void
  onReady: () => void
}

export default function ShipPanel({ ships, selected, onSelect, onToggleOrientation, onRandomPlace, onReady }: ShipPanelProps) {
  const allPlaced = ships.every(s => s.placed >= s.total)

  return (
    <div className="flex flex-col gap-3 w-full max-w-[360px] md:w-52">
      <h2 className="text-lg font-semibold text-gray-200">Twoja flota</h2>

      {/* Lista statków */}
      <div className="flex flex-col gap-2">
        {ships.map(ship => {
          const remaining = ship.total - ship.placed
          const isSelected = selected?.id === ship.id
          const isDone = remaining <= 0

          return (
            <button
              key={ship.id}
              disabled={isDone}
              onClick={() => !isDone && onSelect(ship.id, ship.size)}
              className={[
                'flex flex-col gap-1.5 p-3 rounded-lg border text-left transition-all duration-150',
                isDone
                  ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800'
                  : isSelected
                  ? 'border-yellow-400 bg-yellow-400/10 cursor-pointer'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-400 cursor-pointer',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-100">{ship.name}</span>
                <span className={[
                  'text-xs font-semibold px-1.5 py-0.5 rounded',
                  isDone ? 'bg-gray-600 text-gray-400' : 'bg-gray-600 text-gray-200',
                ].join(' ')}>
                  {/* Liczba pozostałych do postawienia */}
                  {remaining}/{ship.total}
                </span>
              </div>

              {/* Wizualna reprezentacja rozmiaru statku */}
              <div className={[
                'flex gap-0.5',
                selected?.orientation === 'V' && isSelected ? 'flex-col' : 'flex-row',
              ].join(' ')}>
                {Array.from({ length: ship.size }).map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'rounded-sm border',
                      selected?.orientation === 'V' && isSelected ? 'w-5 h-5' : 'w-5 h-5',
                      isDone
                        ? 'bg-gray-600 border-gray-500'
                        : isSelected
                        ? 'bg-yellow-400 border-yellow-300'
                        : 'bg-gray-500 border-gray-400',
                    ].join(' ')}
                  />
                ))}
              </div>

              <span className="text-xs text-gray-400">{ship.size} {ship.size === 1 ? 'pole' : ship.size < 5 ? 'pola' : 'pól'}</span>
            </button>
          )
        })}
      </div>

      {/* Przycisk obrotu — widoczny tylko gdy coś jest zaznaczone */}
      {selected && (
        <button
          onClick={onToggleOrientation}
          className="mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-500 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
        >
          {/* Ikona zależy od aktualnej orientacji */}
          <span className="text-base">{selected.orientation === 'H' ? '↔' : '↕'}</span>
          <span>{selected.orientation === 'H' ? 'Poziomo' : 'Pionowo'}</span>
          <span className="text-xs text-gray-400 ml-auto">PPM / R</span>
        </button>
      )}

      {/* Status */}
      {allPlaced && (
        <div className="mt-2 p-3 rounded-lg bg-green-800/40 border border-green-600 text-green-300 text-sm text-center font-medium">
          Flota rozstawiona!
        </div>
      )}

      {!allPlaced && !selected && (
        <p className="text-xs text-gray-500 mt-1">Kliknij statek, aby go wybrać</p>
      )}

      {selected && (
        <p className="text-xs text-gray-500 mt-1">Kliknij pole na planszy · PPM lub R obraca statek</p>
      )}

      {/* Separator */}
      <div className="border-t border-gray-700 mt-1" />

      {/* Losowe rozmieszczenie */}
      <button
        onClick={onRandomPlace}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-500 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
      >
        <span>🎲</span>
        <span>Rozmieść losowo</span>
      </button>

      {/* Przycisk GOTOWY — aktywny tylko gdy wszystkie statki są rozstawione */}
      <button
        onClick={onReady}
        disabled={!allPlaced}
        className={[
          'flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
          allPlaced
            ? 'bg-green-600 hover:bg-green-500 text-white border border-green-500 cursor-pointer'
            : 'bg-gray-700 text-gray-500 border border-gray-700 cursor-not-allowed',
        ].join(' ')}
      >
        <span>{allPlaced ? '✓' : '🔒'}</span>
        <span>Gotowy!</span>
      </button>
    </div>
  )
}
