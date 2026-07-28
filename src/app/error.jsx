'use client';

export default function Error({ error, reset }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <div className="text-center max-w-md p-8">
        <h2 className="text-xl font-semibold text-brand-blue-deep mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-4">{error?.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium hover:bg-brand-orange-dark"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
