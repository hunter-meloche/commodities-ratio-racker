export function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-lg">Loading market data...</p>
        <p className="text-gray-600 text-sm">Fetching historical ratios</p>
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md mx-auto px-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-semibold text-red-400">Data Unavailable</h2>
        <p className="text-gray-400 text-sm">{message}</p>
        <p className="text-gray-600 text-xs mt-4">
          Run the pipeline to generate data:
          <br />
          <code className="text-gray-400 bg-gray-900 px-2 py-1 rounded mt-1 inline-block">
            cd pipeline && bash run.sh
          </code>
        </p>
      </div>
    </div>
  );
}
