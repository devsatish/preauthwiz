interface TracePageProps {
  params: { runId: string }
}

export default function TracePage({ params }: TracePageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-3xl font-bold tracking-tight">
        Trace: {params.runId}
      </h1>
      <p className="text-muted-foreground text-lg">Coming soon</p>
    </div>
  )
}
