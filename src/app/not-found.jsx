import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <div className="text-center max-w-md p-8">
        <h2 className="text-xl font-semibold text-brand-blue-deep mb-2">Page not found</h2>
        <p className="text-sm text-slate-500 mb-4">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium hover:bg-brand-orange-dark"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
