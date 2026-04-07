// Definicje statków i pomocnicze funkcje rozmieszczania

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'destroyer'
export type Orientation = 'H' | 'V'

export type ShipDef = {
  id: ShipId
  name: string
  size: number
  total: number
}

export const SHIP_DEFS: ShipDef[] = [
  { id: 'carrier',    name: 'Lotniskowiec', size: 5, total: 1 },
  { id: 'battleship', name: 'Pancernik',    size: 4, total: 1 },
  { id: 'cruiser',    name: 'Krążownik',    size: 3, total: 2 },
  { id: 'destroyer',  name: 'Niszczyciel',  size: 2, total: 1 },
]

// Zwraca listę współrzędnych pól zajmowanych przez statek
export function getShipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation,
): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let i = 0; i < size; i++) {
    cells.push(orientation === 'H' ? [row, col + i] : [row + i, col])
  }
  return cells
}

// Sprawdza, czy postawienie statku w podanych polach jest dozwolone:
// - wszystkie pola muszą być w granicach planszy
// - żadne pole nie może nakładać się na istniejący statek
// - żadne pole nie może stykać się (8-sąsiedztwo) z innym statkiem
export function isValidPlacement(
  grid: string[][],
  cells: Array<[number, number]>,
): boolean {
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`))
  for (const [r, c] of cells) {
    // Wykroczenie poza planszę
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return false
    // Nałożenie na istniejący statek (wcześniej pominięte przez cellSet przy dr=dc=0)
    if (grid[r][c] === 'ship') return false
    // Stykanie z innym statkiem — sprawdź 8 sąsiadów, pomijając własne pola kadłuba
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (
          nr >= 0 && nr < 10 &&
          nc >= 0 && nc < 10 &&
          !cellSet.has(`${nr},${nc}`) &&
          grid[nr][nc] === 'ship'
        ) return false
      }
    }
  }
  return true
}

// Wykrywa statki jako grupy połączonych pól 'ship' (BFS po sąsiedztwie 4-kierunkowym)
export function findShips(grid: string[][]): Array<[number, number][]> {
  const visited = Array.from({ length: 10 }, () => Array(10).fill(false))
  const ships: Array<[number, number][]> = []
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (grid[r][c] === 'ship' && !visited[r][c]) {
        const cells: [number, number][] = []
        const queue: [number, number][] = [[r, c]]
        while (queue.length > 0) {
          const [row, col] = queue.shift()!
          if (visited[row][col]) continue
          visited[row][col] = true
          cells.push([row, col])
          for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            const nr = row + dr, nc = col + dc
            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && grid[nr][nc] === 'ship' && !visited[nr][nc])
              queue.push([nr, nc])
          }
        }
        ships.push(cells)
      }
    }
  }
  return ships
}
