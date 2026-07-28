export function getPlatformTextColorClass(platform) {
  switch (platform) {
    case 'Facebook':
      return 'text-[#1877F2]';
    case 'Google':
      return 'bg-gradient-to-r from-[#34A853] to-[#FBBC05] bg-clip-text text-transparent';
    case 'TikTok':
      return 'bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent';
    case 'Snapchat':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-slate-600';
  }
}

export function getPlatformBadgeClasses(platform) {
  switch (platform) {
    case 'Facebook':
      return 'bg-blue-50 text-[#1877F2]';
    case 'Google':
      return 'bg-green-50 text-[#34A853]';
    case 'TikTok':
      return 'bg-cyan-50 text-[#25F4EE]';
    case 'Snapchat':
      return 'bg-amber-50 text-amber-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function PlatformText({ platform, variant = 'text' }) {
  if (variant === 'badge') {
    return (
      <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${getPlatformBadgeClasses(platform)}`}>
        {platform}
      </span>
    );
  }

  return (
    <span className={`font-medium ${getPlatformTextColorClass(platform)}`}>
      {platform}
    </span>
  );
}
