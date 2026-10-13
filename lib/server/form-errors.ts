import { ReminderError } from '@/lib/reminders/errors.mjs';
import { formFieldFor } from '@/lib/reminders/form.mjs';

/** Names the form control that holds the value a shared operation refused, so the page can mark it. */
export function withFormField(err: unknown, kind: string): unknown {
  if (err instanceof ReminderError && err.code === 'invalid' && err.field && !err.fields) {
    const control = formFieldFor(err.field, kind);
    if (control) err.fields = { [control]: err.message.charAt(0).toUpperCase() + err.message.slice(1) };
  }
  return err;
}
