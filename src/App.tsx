import Board from './components/Board'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold text-white">Statki Multiplayer</h1>
      <Board />
      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.{' '}
        <a
          href="https://apius.pl"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors"
        >
          Apius Technologies
        </a>{' '}
        2026
      </footer>
    </div>
  )
}
