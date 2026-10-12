import { isValidElement, type ReactNode } from 'react';
import { HugeiconsIcon, type HugeiconsIconProps } from '@hugeicons/react';

type IconProp = NonNullable<HugeiconsIconProps['icon']>;

/**
 * Renders a menu-row icon: passes React elements straight through, and wraps a
 * Hugeicons icon reference in <HugeiconsIcon>.
 */
export function renderIcon(
  icon: ReactNode | IconProp | undefined,
  size: number,
): ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  return (
    <HugeiconsIcon icon={icon as IconProp} size={size} strokeWidth={1.8} />
  );
}
