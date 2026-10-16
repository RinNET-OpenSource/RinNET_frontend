import { DatePicker, TimePicker } from 'animal-island-ui';
import { LiquidTextField } from '@liquefy-ui/react';
import { useTheme } from '@/lib/theme';

/**
 * Date + time input for the admin screens.
 *
 * Each interface style gets its own control: Animal Island UI ships a themed
 * picker pair, Liquid Glass has its own text field, and the classic theme keeps
 * the browser's native control with the Bootstrap input classes.
 */
interface DateTimeFieldProps {
  /** Value in the native `datetime-local` format, `YYYY-MM-DDTHH:mm`. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

function splitDateTime(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function joinDateTime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

export function DateTimeField({ value, onChange, disabled, label }: DateTimeFieldProps) {
  const { family } = useTheme();
  const { date, time } = splitDateTime(value);

  if (family === 'animal-island') {
    return (
      <div className="d-flex flex-wrap gap-1" role="group" aria-label={label}>
        <DatePicker
          size="small"
          value={date || null}
          disabled={disabled}
          aria-label={label}
          onChange={(next) => onChange(joinDateTime(typeof next === 'string' ? next : '', time))}
        />
        <TimePicker
          size="small"
          format="HH:mm"
          value={time || undefined}
          disabled={disabled}
          allowClear={false}
          aria-label={label}
          onChange={(next) => onChange(joinDateTime(date, (next ?? '').slice(0, 5)))}
        />
      </div>
    );
  }

  if (family === 'liquefy') {
    return (
      <LiquidTextField
        type="datetime-local"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="form-control form-control-sm"
      type="datetime-local"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
