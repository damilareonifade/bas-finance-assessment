import logoUrl from '@/storage/bas-logo.png';
import reversedLogoUrl from '@/storage/bas-logo-white.png';
import { cn } from '@/lib/utils/cn';

interface BrandLogoProps {
  readonly className?: string;
  /** "reversed" is the all-white mark for dark surfaces such as the sidebar. */
  readonly variant?: 'default' | 'reversed';
}

/**
 * The BAS wordmark. `bas-logo.png` is a tightly cropped copy of the supplied storage/image.png;
 * `bas-logo-white.png` is derived from it (ink → white, background → transparent) until an official reversed logo exists.
 */
export function BrandLogo({ className, variant = 'default' }: BrandLogoProps) {
  return (
    <img
      src={variant === 'reversed' ? reversedLogoUrl : logoUrl}
      alt="BAS Finance"
      width={141}
      height={36}
      className={cn('h-10 w-auto select-none', className)}
      draggable={false}
    />
  );
}
