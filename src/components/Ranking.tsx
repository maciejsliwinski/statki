import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type RankRow = { nickname: string; wins: number }

type RankingProps = {
  onBack: () => void
}

export default function Ranking({ onBack }: RankingProps) {
  const [rows,    setRows]    = useState<RankRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('games')
        .select('winner, host_nickname, guest_nickname')
        .eq('status', 'finished')
        .not('winner', 'is', null)

      if (!data) { setLoading(false); return }

      // Zlicz wygrane per pseudonim
      const counts: Record<string, number> = {}
      for (const game of data) {
        const nick = game.winner === 'host' ? game.host_nickname : game.guest_nickname
        if (nick) counts[nick] = (counts[nick] ?? 0) + 1
      }

      const sorted = Object.entries(counts)
        .map(([nickname, wins]) => ({ nickname, wins }))
        .sort((a, b) => b.wins - a.wins)

      setRows(sorted)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-8 px-4 py-8">
      <h1 className="text-4xl font-bold text-white">Ranking</h1>

      <div className="w-full max-w-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
            <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Ładowanie…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Brak rozegranych gier.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-600">
                <th className="py-2 w-10 text-center">#</th>
                <th className="py-2 text-left">Gracz</th>
                <th className="py-2 text-right pr-2">Wygrane</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.nickname}
                  className={`border-b border-gray-700 ${i === 0 ? 'text-yellow-300 font-semibold' : 'text-gray-200'}`}
                >
                  <td className="py-2.5 text-center text-gray-500">
                    {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="py-2.5">{row.nickname}</td>
                  <td className="py-2.5 text-right pr-2">{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={onBack}
        className="px-6 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors"
      >
        ← Powrót
      </button>

      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.<br />
        <a href="https://apius.pl" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors">Apius Technologies</a>{' '}2026
      </footer>
    </div>
  )
}
