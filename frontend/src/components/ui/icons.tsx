import type { ReactNode, SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  readonly size?: number;
}

function createIcon(displayName: string, paths: ReactNode) {
  function Icon({ size = 20, ...rest }: IconProps) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const HomeIcon = createIcon('HomeIcon', <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>);
export const UsersIcon = createIcon('UsersIcon', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" /><path d="M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>);
export const UserPlusIcon = createIcon('UserPlusIcon', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M19 8v6M16 11h6" /></>);
export const PhoneIcon = createIcon('PhoneIcon', <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />);
export const BanknoteIcon = createIcon('BanknoteIcon', <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v.01M18 14.5v.01" /></>);
export const PlusCircleIcon = createIcon('PlusCircleIcon', <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>);
export const ReceiptIcon = createIcon('ReceiptIcon', <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>);
export const LayersIcon = createIcon('LayersIcon', <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>);
export const SettingsIcon = createIcon('SettingsIcon', <><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const LogOutIcon = createIcon('LogOutIcon', <><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="m16 8 4 4-4 4M20 12H9" /></>);
export const ChevronDownIcon = createIcon('ChevronDownIcon', <path d="m6 9 6 6 6-6" />);
export const MenuIcon = createIcon('MenuIcon', <path d="M4 7h16M4 12h16M4 17h16" />);
export const CloseIcon = createIcon('CloseIcon', <path d="M6 6l12 12M18 6 6 18" />);
export const TrendUpIcon = createIcon('TrendUpIcon', <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
export const TrendDownIcon = createIcon('TrendDownIcon', <><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></>);
export const ClockIcon = createIcon('ClockIcon', <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const ShieldCheckIcon = createIcon('ShieldCheckIcon', <><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>);
export const FileTextIcon = createIcon('FileTextIcon', <><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>);
export const EyeIcon = createIcon('EyeIcon', <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const BellIcon = createIcon('BellIcon', <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>);
export const ClipboardIcon = createIcon('ClipboardIcon', <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>);
export const UploadIcon = createIcon('UploadIcon', <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></>);
export const BookIcon = createIcon('BookIcon', <><path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5Z" /><path d="M4 20a2 2 0 0 0 2 2h13v-4" /><path d="M9 7h6M9 11h6" /></>);
export const SearchIcon = createIcon('SearchIcon', <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
