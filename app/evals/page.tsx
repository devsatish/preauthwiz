export default function EvalsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Eval Suite</h1>
      <p className="text-muted-foreground text-lg">Coming soon</p>
      <button
        type="button"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        Run Evals
      </button>
    </div>
  )
}
