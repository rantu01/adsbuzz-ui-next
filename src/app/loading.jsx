export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading AdsBuzz Console…</p>
      </div>
    </div>
  );
}
