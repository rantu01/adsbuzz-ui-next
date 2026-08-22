/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Keep pdfkit (and its bundled AFM font data) out of the server bundle.
  // pdfkit resolves its standard fonts relative to its own __dirname; when
  // Next inlines it into .next/server/vendor-chunks the font files are missing,
  // causing "ENOENT ... Helvetica.afm". Loading it as an external package keeps
  // the real node_modules layout (including pdfkit's data/ folder) at runtime.
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
