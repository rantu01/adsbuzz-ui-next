'use client';

export default function FullScreenLoading({ label = 'Please wait…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app-bg">
      <div className="h-10 w-10 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      <p className="mt-4 text-sm text-brand-blue-deep">{label}</p>
    </div>
  );
}