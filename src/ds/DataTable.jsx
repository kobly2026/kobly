// Kobly Design System — DataTable.
// Operational table for clientes / campanhas / leads / integrações.
// `columns`: [{ key, header, width, align, render(row) }]. `rows`: array of objects.
// Set `empty` for the empty-state message. `rowKey` is a key string or a fn(row).
// Row hover wash via the .kbly-row class.

export function DataTable({
  columns = [],
  rows = [],
  empty = 'Sem registros',
  rowKey = 'id',
  style = {},
  ...rest
}) {
  const keyFor = (row, ri) =>
    typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? ri;

  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }} {...rest}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || 'start',
                  padding: '11px 16px',
                  width: c.width,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  letterSpacing: 'var(--ls-wide)',
                  textTransform: 'uppercase',
                  color: 'var(--text-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap',
                  background: 'var(--surface-card)',
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={keyFor(row, ri)} className="kbly-row" style={{ transition: 'background var(--dur-fast)' }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      textAlign: c.align || 'start',
                      padding: '13px 16px',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-body)',
                      borderBottom:
                        ri === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                      verticalAlign: 'middle',
                    }}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
