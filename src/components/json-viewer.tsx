interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  return (
    <pre className="max-h-[36rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
