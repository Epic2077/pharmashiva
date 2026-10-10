import * as React from 'react';

interface CommonControlledStateProps<T> {
  value?: T;
  defaultValue?: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useControlledState<T, Rest extends any[] = []>(
  props: CommonControlledStateProps<T> & {
    onChange?: (value: T, ...args: Rest) => void;
  },
): readonly [T, (next: T, ...args: Rest) => void] {
  const { value, defaultValue, onChange } = props;

  const [internalValue, setInternalValue] = React.useState<T>(
    (defaultValue ?? value) as T,
  );

  // Derived, not synced: an effect here would fight the parent's own render.
  const setState = React.useCallback(
    (next: T, ...args: Rest) => {
      if (value === undefined) setInternalValue(next);
      onChange?.(next, ...args);
    },
    [value, onChange],
  );

  return [value !== undefined ? value : internalValue, setState] as const;
}
