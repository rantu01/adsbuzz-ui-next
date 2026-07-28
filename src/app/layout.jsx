import './globals.css';
import { AppProvider } from '@/context/AppContext';
import AppShell from '@/components/common/AppShell';

export const metadata = {
  title: 'AdsBuzz ERP - Operations Console',
  description: 'Enterprise Resource Planning suite for social ad account loading, reseller CRM, and billing card reconciliation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
