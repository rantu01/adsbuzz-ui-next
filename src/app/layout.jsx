import './globals.css';
import { headers, cookies } from 'next/headers';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import AppShell from '@/components/common/AppShell';
import { verifySessionCookie } from '@/lib/firebaseAdmin';
import { getUserByUid } from '@/models/userModel';
import { getEffectiveLevel2Routes } from '@/lib/roleModel';
import { ROLE_LABELS } from '@/lib/rbacCatalog';
import { canAccessLevel2Route } from '@/lib/permissions';
import { SESSION_COOKIE } from '@/lib/session';

export const metadata = {
  title: 'AdsBuzz ERP - Operations Console',
  description: 'Enterprise Resource Planning suite for social ad account loading, reseller CRM, and billing card reconciliation.',
};

const BARE_PATHS = ['/login'];

// Server-side page guard. Runs on EVERY page render (including direct URL
// entry and non-JS clients): resolves the caller's live role from the shared
// `roles` collection managed in Level 1 and refuses to render pages the role
// cannot access. Uses static catalog defaults as fallback when the role doc
// has no explicit routes; fails OPEN (logs) only when the check itself
// cannot run, so a DB hiccup never white-screens the app.
async function getPageAccess(pathname) {
  if (!pathname || BARE_PATHS.includes(pathname)) return { denied: false };
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return { denied: false }; // middleware / client guard bounces to login
    let decoded;
    try {
      decoded = await verifySessionCookie(token);
    } catch {
      return { denied: false };
    }
    const user = await getUserByUid(decoded.uid);
    if (!user) return { denied: false };
    if (user.accountStatus === 'frozen') {
      return { denied: true, reason: 'frozen', role: user.role, roleLabel: ROLE_LABELS[user.role] || user.role };
    }
    const role = user.role || 'customer';
    const level2Routes = await getEffectiveLevel2Routes(role);
    const routesMap = { [role]: level2Routes };
    if (!canAccessLevel2Route(pathname, role, routesMap)) {
      return { denied: true, reason: 'forbidden', role, roleLabel: ROLE_LABELS[role] || role };
    }
    return { denied: false };
  } catch (err) {
    console.error('[layout] page-access check failed (fail-open):', err?.message || err);
    return { denied: false };
  }
}

function ServerAccessDenied({ pathname, roleLabel, reason }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 448, width: '100%', borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff', padding: 32, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ margin: '0 auto 16px', display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#fef2f2', color: '#ef4444', fontSize: 24, fontWeight: 800 }}>!</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {reason === 'frozen' ? 'Account Frozen' : 'Access Restricted'}
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>
          {reason === 'frozen'
            ? 'Your account has been frozen. Please contact your administrator.'
            : <>Your role{roleLabel ? ` (${roleLabel})` : ''} does not have access to <span style={{ fontFamily: 'monospace' }}>{pathname}</span>. Please contact your administrator to request access from the Level 1 admin panel.</>}
        </p>
        <a href="/" style={{ display: 'block', marginTop: 24, borderRadius: 12, background: '#F68B2D', padding: '10px 16px', fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname');
  const access = await getPageAccess(pathname);

  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        {access.denied ? (
          <ServerAccessDenied pathname={pathname} roleLabel={access.roleLabel} reason={access.reason} />
        ) : (
          <AuthProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
            </AppProvider>
          </AuthProvider>
        )}
      </body>
    </html>
  );
}
