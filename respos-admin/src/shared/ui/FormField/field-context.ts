import { createContext, useContext } from 'react';

export interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Controls (Input, Select, …) read id / aria-* from the surrounding FormField automatically. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}
