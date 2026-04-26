// Lightweight syntax-highlighted JSON renderer. Pure React, no dependency.
// Server-renderable; does not require 'use client'.

export function JsonTree({ value }: { value: unknown }) {
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap break-words text-slate-700 leading-relaxed">
      <JsonNode value={value} depth={0} />
    </pre>
  );
}

function JsonNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null) return <span className="text-purple-700">null</span>;
  if (value === undefined) return <span className="text-slate-400">undefined</span>;
  if (typeof value === 'boolean') return <span className="text-purple-700">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-amber-700">{value}</span>;
  if (typeof value === 'string') {
    return <span className="text-emerald-700">{JSON.stringify(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500">[]</span>;
    return (
      <>
        <span className="text-slate-500">[</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
            <JsonNode value={item} depth={depth + 1} />
            {i < value.length - 1 ? <span className="text-slate-500">,</span> : null}
          </div>
        ))}
        <div style={{ paddingLeft: `${depth * 14}px` }} className="text-slate-500">]</div>
      </>
    );
  }
  // object
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-slate-500">{'{}'}</span>;
  return (
    <>
      <span className="text-slate-500">{'{'}</span>
      {entries.map(([k, v], i) => (
        <div key={k} style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
          <span className="text-blue-700">{JSON.stringify(k)}</span>
          <span className="text-slate-500">: </span>
          <JsonNode value={v} depth={depth + 1} />
          {i < entries.length - 1 ? <span className="text-slate-500">,</span> : null}
        </div>
      ))}
      <div style={{ paddingLeft: `${depth * 14}px` }} className="text-slate-500">{'}'}</div>
    </>
  );
}
