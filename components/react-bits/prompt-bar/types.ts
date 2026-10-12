/* Shared types for the PromptBar component and its parts. */

import type { ReactNode } from 'react';
import type { HugeiconsIconProps } from '@hugeicons/react';

type IconProp = NonNullable<HugeiconsIconProps['icon']>;

export interface PromptBarSource {
  key: string;
  name: string;
  description?: string;
  icon?: ReactNode | IconProp;
  /** Marks the row that picks files, calling `onAttach`. */
  attach?: boolean;
}

export interface PromptBarCommand {
  key: string;
  name: string;
  description?: string;
}

export interface PromptBarModel {
  key: string;
  name: string;
  tag?: string;
}

export type PromptBarMenu = 'at' | 'slash' | 'model' | 'effort';

/** Shape every menu row is normalised to, so `pick` can read them alike. */
export interface PromptBarRow {
  key: string;
  name: string;
  description?: string;
  icon?: ReactNode | IconProp;
  attach?: boolean;
  tag?: string;
}

export interface PromptBarSendPayload {
  attachments: string[];
  model?: PromptBarModel;
  effort: string;
}

export interface PromptBarProps {
  placeholder?: string;
  sources?: PromptBarSource[];
  commands?: PromptBarCommand[];
  models?: PromptBarModel[];
  defaultModel?: string;
  efforts?: string[];
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  busy?: boolean;
  onSend?: (text: string, payload: PromptBarSendPayload) => void;
  onStop?: () => void;
  onAttach?: () => string | string[] | Promise<string | string[]> | void;
  onDictate?: () => Promise<string> | string | void;
  /** Controlled attachment chips. Omit and the bar keeps them internally. */
  attachments?: string[];
  onAttachmentsChange?: (attachments: string[]) => void;
  /**
   * Replaces the plus button. Use it to open your own menu (for example the
   * app's DropdownMenu) instead of the built-in sources list.
   */
  renderLeading?: () => ReactNode;
  background?: string;
  color?: string;
  menuBackground?: string;
  sparkColor?: string;
  sparkBoost?: number;
  width?: number | string;
  radius?: number;
  maxRows?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  className?: string;
}

export interface LatestHandlers {
  onSend?: PromptBarProps['onSend'];
  onStop?: () => void;
  onAttach?: PromptBarProps['onAttach'];
  onDictate?: PromptBarProps['onDictate'];
  onEffortChange?: (effort: string) => void;
}
