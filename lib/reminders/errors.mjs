// One error type for every reminder operation, so chat (exit codes), the browser API (HTTP status)
// and the checker all report the same refusal in the same words.
//
//   code        CLI exit  HTTP  meaning
//   invalid     1         422   bad or ambiguous input; nothing was saved
//   store       1         500   the database is missing or not usable
//   not_found   2         404   no reminder with that ID
//   busy        3         503   the database stayed locked; nothing was changed, retry
//   refused     4         409   ack/retry refused: that occurrence is not pending
//   conflict    5         409   the record changed since it was read; nothing was changed
export class ReminderError extends Error {
  /**
   * @param {'invalid'|'store'|'not_found'|'busy'|'refused'|'conflict'} code
   * @param {string} message
   * @param {{ field?: string, fields?: Record<string,string>, current?: object }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ReminderError';
    this.code = code;
    this.field = extra.field;
    this.fields = extra.fields;
    this.current = extra.current;
  }
}

export const EXIT_CODES = { invalid: 1, store: 1, not_found: 2, busy: 3, refused: 4, conflict: 5 };
export const HTTP_STATUS = { invalid: 422, store: 500, not_found: 404, busy: 503, refused: 409, conflict: 409 };
