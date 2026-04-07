import { useState } from 'react'

// Typy stanu pojedynczego pola
export type CellState = 'empty' | 'ship' | 'hit' | 'miss'

type BoardProps = {
  // Opcjonalna inicjalna siatka — jeśli nie podana, generuje pustą z testowym statkiem
  grid?: CellState[][]
  onCellClick?: (row: number, col: number) => void
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
  // Testowy statek: B3–B5
  grid[1][2] = 'ship'
  grid[1][3] = 'ship'
  grid[1][4] = 'ship'
  // Testowy statek: E7–G7
  grid[4][6] = 'ship'
  grid[5][6] = 'ship'
  grid[6][6] = 'ship'
  return grid
}

function cellBaseClass(state: CellState): string {
  switch (state) {
    case 'empty': return 'bg-blue-500 hover:bg-blue-300 active:bg-blue-200'
    case 'ship':  return 'bg-gray-500 hover:bg-gray-400 active:bg-gray-300'
    case 'hit':   return 'bg-red-600 hover:bg-red-500 active:bg-red-400'
    case 'miss':  return 'bg-white hover:bg-gray-100 active:bg-gray-200'
  }
}

export default function Board({ grid: externalGrid, onCellClick }: BoardProps) {
  const [grid, setGrid] = useState<CellState[][]>(externalGrid ?? createTestGrid())
  // Osobna siatka ikon dla pudła — losowana w momencie trafienia
  const [missIcons, setMissIcons] = useState<(string | null)[][]>(
    () => Array.from({ length: 10 }, () => Array(10).fill(null))
  )
  // Pole aktualnie animowane po kliknięciu
  const [animCell, setAnimCell] = useState<{ row: number; col: number } | null>(null)

  function handleClick(row: number, col: number) {
    setAnimCell({ row, col })

    if (onCellClick) {
      onCellClick(row, col)
      return
    }

    // Domyślna obsługa kliknięcia (tryb testowy)
    setGrid(prev => {
      const next = prev.map(r => [...r])
      const current = next[row][col]
      if (current === 'empty') {
        next[row][col] = 'miss'
        // Losuj ikonę pudła w tym samym przebiegu
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

  return (
    // Wrapper z max-width — na mobile zajmuje całą szerokość ekranu, na desktop jest wyśrodkowany
    <div className="w-full max-w-[360px] md:max-w-fit mx-auto select-none">
      {/* Nagłówek — numery kolumn */}
      <div className="flex">
        {/* Pusty narożnik */}
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
            const state = grid[row][col]
            return (
              <button
                key={col}
                onClick={() => handleClick(row, col)}
                onAnimationEnd={() => setAnimCell(null)}
                className={[
                  // Na mobile: równe kolumny wypełniające szerokość; na desktop: stały rozmiar 48px
                  'flex-1 md:w-12 md:flex-none aspect-square',
                  'border border-blue-800 transition-colors duration-100 cursor-pointer touch-manipulation',
                  'flex items-center justify-center',
                  cellBaseClass(state),
                  animCell?.row === row && animCell?.col === col ? 'cell-pop' : '',
                ].join(' ')}
                title={`${letter}${col + 1}`}
              >
                {/* Losowa ikona dna morskiego dla pudła */}
                {state === 'miss' && (
                  <span className="text-base md:text-xl leading-none">
                    {missIcons[row][col]}
                  </span>
                )}
                {/* Płomień dla trafienia */}
                {state === 'hit' && (
                  <span className="flame text-base md:text-xl">🔥</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
