import { useMemo, useState } from 'react'
import { getShipCells, isValidPlacement, type Orientation } from '../store/ships'

// Typy stanu pojedynczego pola
export type CellState = 'empty' | 'ship' | 'hit' | 'miss'

type PlacementShip = { size: number; orientation: Orientation }

type BoardProps = {
  // Zewnętrzna siatka — jeśli nie podana, plansza używa wewnętrznego stanu testowego
  grid?: CellState[][]
  onCellClick?: (row: number, col: number) => void
  // Tylko do odczytu — brak kursora pointer i interakcji (moja plansza w grze)
  readonly?: boolean
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

const MISS_ICONS = ['⚓', '🪸', '🐚', '🦀', '🐙', '🦑', '🪨', '🐠', '🎣', '🦞', '⛵', '🚢', '🛳️', '🚤', '⛴️']

// Deterministyczna ikona pudła na podstawie pozycji — nie wymaga stanu
function getMissIcon(row: number, col: number): string {
  return MISS_ICONS[(row * 10 + col) % MISS_ICONS.length]
}

// Testowa siatka używana gdy brak zewnętrznej siatki i nie jesteśmy w trybie rozmieszczania
function createTestGrid(): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () => Array(10).fill('empty'))
  grid[1][2] = 'ship'; grid[1][3] = 'ship'; grid[1][4] = 'ship'
  grid[4][6] = 'ship'; grid[5][6] = 'ship'; grid[6][6] = 'ship'
  return grid
}

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty'))
}

// Kolor pola w trybie strzelania / podglądu planszy
function cellShootClass(state: CellState, isReadonly: boolean): string {
  switch (state) {
    case 'empty': return isReadonly ? 'bg-blue-500' : 'bg-blue-500 hover:bg-blue-300 active:bg-blue-200'
    case 'ship':  return isReadonly ? 'bg-gray-500' : 'bg-gray-500 hover:bg-gray-400 active:bg-gray-300'
    // Trafione/spudłowane — bez hover, cursor-default niezależnie od trybu
    case 'hit':   return 'bg-red-600 cursor-default'
    case 'miss':  return 'bg-white cursor-default'
  }
}

// Kolor pola w trybie rozmieszczania
function cellPlacementClass(state: CellState, inPreview: boolean, previewValid: boolean): string {
  if (inPreview) {
    return previewValid ? 'bg-green-400 border-green-500' : 'bg-red-400 border-red-500'
  }
  switch (state) {
    case 'empty': return 'bg-blue-500'
    case 'ship':  return 'bg-gray-500 hover:bg-gray-400 cursor-pointer'
    case 'hit':   return 'bg-red-600'
    case 'miss':  return 'bg-white'
  }
}

export default function Board({
  grid: externalGrid,
  onCellClick,
  readonly = false,
  placementMode = false,
  placementShip = null,
  onShipPlaced,
  onShipPickup,
  onOrientationToggle,
}: BoardProps) {
  const [internalGrid, setInternalGrid] = useState<CellState[][]>(createTestGrid())
  const [animCell, setAnimCell] = useState<{ row: number; col: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  const activeGrid = placementMode
    ? (externalGrid ?? createEmptyGrid())
    : (externalGrid ?? internalGrid)

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
    if (readonly) return

    if (placementMode) {
      if (activeGrid[row][col] === 'ship') { onShipPickup?.(row, col); return }
      if (!placementShip || !preview.valid) return
      setAnimCell({ row, col })
      onShipPlaced?.(row, col)
      return
    }

    setAnimCell({ row, col })
    if (onCellClick) { onCellClick(row, col); return }

    // Tryb testowy (brak zewnętrznej obsługi)
    setInternalGrid(prev => {
      const next = prev.map(r => [...r])
      const cur = next[row][col]
      if (cur === 'empty') next[row][col] = 'miss'
      else if (cur === 'ship') next[row][col] = 'hit'
      return next
    })
  }

  function handleContextMenu(e: React.MouseEvent) {
    if (!placementMode) return
    e.preventDefault()
    onOrientationToggle?.()
  }

  const cursorClass = readonly
    ? 'cursor-default'
    : placementMode
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
          <div key={col}
            className="flex-1 md:w-12 md:flex-none h-8 md:h-12 flex items-center justify-center text-base md:text-xl font-semibold text-gray-300"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Wiersze */}
      {ROWS.map((letter, row) => (
        <div key={letter} className="flex">
          <div className="w-8 md:w-12 shrink-0 flex items-center justify-center text-base md:text-xl font-semibold text-gray-300">
            {letter}
          </div>

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
                    : cellShootClass(state, readonly),
                  animCell?.row === row && animCell?.col === col ? 'cell-pop' : '',
                ].join(' ')}
                title={`${letter}${col + 1}`}
              >
                {state === 'miss' && (
                  <span className="text-base md:text-xl leading-none">
                    {getMissIcon(row, col)}
                  </span>
                )}
                {state === 'hit' && (
                  <span className="flame text-base md:text-xl">🔥</span>
                )}
                {/* Widoczne statki w trybie rozmieszczania i na własnej planszy */}
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
