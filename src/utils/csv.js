function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  const shouldQuote = /[",\n\r]/.test(stringValue);
  const escaped = stringValue.replace(/"/g, '""');
  return shouldQuote ? `"${escaped}"` : escaped;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

