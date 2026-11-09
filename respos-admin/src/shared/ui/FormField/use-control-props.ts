import { useFieldControl } from './field-context';

interface ControlA11yProps {
  id?: string;
  invalid?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
}

/** Merges FormField context (id, aria-invalid, aria-describedby) with explicit props. Explicit wins. */
export function useControlProps(props: ControlA11yProps) {
  const field = useFieldControl();
  const invalid = props.invalid ?? field?.invalid ?? false;
  return {
    id: props.id ?? field?.id,
    required: props.required ?? field?.required,
    'aria-invalid': invalid || undefined,
    'aria-describedby': props['aria-describedby'] ?? field?.describedBy,
  };
}
