/**
 * Escape a single CSV field according to RFC4180-ish rules:
 * - if contains comma, quote, CR or LF -> wrap in quotes and escape quotes by doubling
 * @param {any} value
 * @returns {string}
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * PUBLIC_INTERFACE
 * Convert an array of objects into CSV string.
 * Uses `columns` to define order and headers.
 *
 * @param {object[]} rows
 * @param {{ key: string, header?: string }[]} columns
 * @returns {string}
 */
function rowsToCsv(rows, columns) {
  const headerLine = columns.map((c) => escapeCsvField(c.header ?? c.key)).join(',');
  const lines = [headerLine];

  for (const row of rows) {
    const line = columns.map((c) => escapeCsvField(row?.[c.key])).join(',');
    lines.push(line);
  }

  // Standard CSV line breaks
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = { rowsToCsv };
