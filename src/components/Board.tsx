import { useMemo, useState } from 'react'
import { getShipCells, isValidPlacement, type Orientation } from '../store/ships'

// Typy stanu pojedynczego pola
export type CellState = 'empty' | 'ship' | 'hit' | 'miss'

type PlacementShip = { size: number; orientation: Orientation }

type BoardProps = {
  // Zewnętrzna siatka — jeśli nie podana, plansza używa wewnętrznego stanu testowego
  grid?: CellState[][]
  onCellClick?: (row: number, col: number) => void
  // --- Tryb rozmieszczania statków ---
  placementMode?: boolean
  placementShip?: PlacementShip | null
  onShipPlaced?: (row: number, col: number) => void
  // Kliknięcie na już postawiony statek — pozwala go przestawić
  onShipPickup?: (row: number, col: number) => void
  onOrientationToggle?: () => void
}

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Emoji losowane przy pudłach — dno morskie
const MISS_ICONS = ['⚓', '🪸', '🐚', '🦀', '🐙', '🦑', '🪨', '🐠', '🎣', '🦞', '⛵', '🚢', '🛳️', '🚤', '⛴️']

function randomMissIcon(): string {
  return MISS_ICONS[Math.floor(Math.random() * MISS_ICONS.length)]
}

// Testowa siatka — kilka pól oznaczonych jako statek
function createTestGrid(): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () =>
    Array(10).fill('empty')
  )
  grid[1][2] = 'ship'
  grid[1][3] = 'ship'
  grid[1][4] = 'ship'
  grid[4][6] = 'ship'
  grid[5][6] = 'ship'
  grid[6][6] = 'ship'
  return grid
}

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty'))
}

// Kolor pola w trybie strzelania
function cellShootClass(state: CellState): string {
  switch (state) {
    case 'empty': return 'bg-blue-500 hover:bg-blue-300 active:bg-blue-200'
    case 'ship':  return 'bg-gray-500 hover:bg-gray-400 active:bg-gray-300'
    case 'hit':   return 'bg-red-600 hover:bg-red-500 active:bg-red-400'
    case 'miss':  return 'bg-white hover:bg-gray-100 active:bg-gray-200'
  }
}

// Kolor pola w trybie rozmieszczania (bez CSS-hover — stan śledzony przez onMouseEnter)
function cellPlacementClass(state: CellState, inPreview: boolean, previewValid: boolean): string {
  if (inPreview) {
    return previewValid
      ? 'bg-green-400 border-green-500'
      : 'bg-red-400 border-red-500'
  }
  switch (state) {
    case 'empty': return 'bg-blue-500'
    // Postawiony statek: hover wskazuje, że można go kliknąć i przestawić
    case 'ship':  return 'bg-gray-500 hover:bg-gray-400 cursor-pointer'
    case 'hit':   return 'bg-red-600'
    case 'miss':  return 'bg-white'
  }
}

export default function Board({
  grid: externalGrid,
  onCellClick,
  placementMode = false,
  placementShip = null,
  onShipPlaced,
  onShipPickup,
  onOrientationToggle,
}: BoardProps) {
  // Wewnętrzna siatka — używana tylko w trybie testowym (nie-rozmieszczanie)
  const [internalGrid, setInternalGrid] = useState<CellState[][]>(createTestGrid())
  const [missIcons, setMissIcons] = useState<(string | null)[][]>(
    () => Array.from({ length: 10 }, () => Array(10).fill(null))
  )
  const [animCell, setAnimCell] = useState<{ row: number; col: number } | null>(null)
  // Pole pod kursorem w trybie rozmieszczania
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  // Aktywna siatka: w trybie rozmieszczania zawsze zewnętrzna
  const activeGrid = placementMode
    ? (externalGrid ?? createEmptyGrid())
    : (externalGrid ?? internalGrid)

  // Oblicz podgląd pozycji statku na podstawie hover
  const preview = useMemo(() => {
    if (!placementMode || !placementShip || !hoverCell) {
      return { cells: new Set<string>(), valid: false }
    }
    const cells = getShipCells(hoverCell.row, hoverCell.col, placementShip.size, placementShip.orientation)
    const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`))
    const valid = isValidPlacement(activeGrid, cells)
    return { cells: cellSet, valid }
  }, [placementMode, placementShip, hoverCell, activeGrid])

  function handleClick(row: number, col: number) {
    if (placementMode) {
      // Kliknięcie na postawiony statek — podnieś go do przestawienia
      if (activeGrid[row][col] === 'ship') {
        onShipPickup?.(row, col)
        return
      }
      if (!placementShip || !preview.valid) return
      setAnimCell({ row, col })
      onShipPlaced?.(row, col)
      return
    }

    setAnimCell({ row, col })
    if (onCellClick) {
      onCellClick(row, col)
      return
    }

    // Domyślna obsługa kliknięcia (tryb testowy)
    setInternalGrid(prev => {
      const next = prev.map(r => [...r])
      const current = next[row][col]
      if (current === 'empty') {
        next[row][col] = 'miss'
        setMissIcons(icons => {
          const nextIcons = icons.map(r => [...r])
          nextIcons[row][col] = randomMissIcon()
          return nextIcons
        })
      } else if (current === 'ship') {
        next[row][col] = 'hit'
      }
      return next
    })
  }

  // Obsługa prawego przycisku myszy — obrót statku
  function handleContextMenu(e: React.MouseEvent) {
    if (!placementMode) return
    e.preventDefault()
    onOrientationToggle?.()
  }

  const cursorClass = placementMode
    ? (placementShip ? 'cursor-crosshair' : 'cursor-default')
    : 'cursor-pointer'

  return (
    <div
      className={`w-full max-w-[360px] md:max-w-fit mx-auto select-none ${cursorClass}`}
      onContextMenu={handleContextMenu}
      onMouseLeave={() => setHoverCell(null)}
    >
      {/* Nagłówek — numery kolumn */}
      <div className="flex">
        <div className="w-8 h-8 md:w-12 md:h-12 shrink-0" />
        {COLS.map(col => (
          <div
            key={col}
            className="flex-1 md:w-12 md:flex-none h-8 md:h-12 flex items-center justify-center text-base md:text-xl font-semibold text-gray-300"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Wiersze */}
      {ROWS.map((letter, row) => (
        <div key={letter} className="flex">
          {/* Etykieta wiersza */}
          <div className="w-8 md:w-12 shrink-0 flex items-center justify-center text-base md:text-xl font-semibold text-gray-300">
            {letter}
          </div>

          {/* Komórki */}
          {COLS.map((_, col) => {
            const state = activeGrid[row][col]
            const key = `${row},${col}`
            const inPreview = preview.cells.has(key)

            return (
              <button
                key={col}
                onClick={() => handleClick(row, col)}
                onMouseEnter={() => placementMode && setHoverCell({ row, col })}
                onAnimationEnd={() => setAnimCell(null)}
                className={[
                  'flex-1 md:w-12 md:flex-none aspect-square',
                  'border border-blue-800 transition-colors duration-75',
                  'flex items-center justify-center touch-manipulation',
                  placementMode
                    ? cellPlacementClass(state, inPreview, preview.valid)
                    : cellShootClass(state),
                  animCell?.row === row && animCell?.col === col ? 'cell-pop' : '',
                ].join(' ')}
                title={`${letter}${col + 1}`}
              >
                {!placementMode && state === 'miss' && (
                  <span className="text-base md:text-xl leading-none">
                    {missIcons[row][col]}
                  </span>
                )}
                {!placementMode && state === 'hit' && (
                  <span className="flame text-base md:text-xl">🔥</span>
                )}
                {/* W trybie rozmieszczania pokazuj 🚢 dla już postawionych statków */}
                {placementMode && state === 'ship' && (
                  <span className="text-xs md:text-sm leading-none">🚢</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
