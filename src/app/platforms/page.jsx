'use client';

import { useApp } from '@/context/AppContext';
import PlatformsView from '@/components/views/PlatformsView';

export default function PlatformsPage() {
  const app = useApp();

  return (
    <PlatformsView
      platforms={app.platforms}
      error={app.platformsError}
      onRetry={app.refetchPlatforms}
      onUpdatePlatform={app.handleUpdatePlatform}
      onAddPlatform={app.addPlatform}
      onTogglePlatformStatus={app.handleTogglePlatformStatus}
      onDeletePlatform={app.handleDeletePlatform}
    />
  );
}
