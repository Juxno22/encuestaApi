function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const firstLine = headers.map((header) => escapeCsvCell(header.label)).join(',');
  const body = rows.map((row) => headers.map((header) => escapeCsvCell(row[header.key])).join(','));
  return `\uFEFF${[firstLine, ...body].join('\r\n')}`;
}

module.exports = {
  escapeCsvCell,
  toCsv
};
