// Kobly Design System — DataTable.
// Operational table for clientes / campanhas / leads / integrações.
// `columns`: [{ key, header, width, align, render(row) }]. `rows`: array of objects.
// `empty` is the empty-state message (string → drawn inbox bubble + text; node →
// rendered as-is). `rowKey` is a key string or fn(row). Options: `zebra` (striped
// rows), `density` ('comfortable' | 'compact'), `stickyHeader` (pinned thead).
// End-aligned cells get tabular figures (.kbly-num) so numbers align.
import { Icon } from './Icon.jsx';

const DENSITY = {
  comfortable: { th: '11px 16px', td: '13px 16px' },
  compact: { th: '8px 14px', td: '9px 14px' },
};

function EmptyCell({ colSpan, empty }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '40px 16px' }}>
        {typeof empty === 'string' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Icon name="inbox" size={22} />
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{empty}</span>
          </div>
        ) : (
          empty
        )}
      </td>
    </tr>
  );
}

export function DataTable({
  columns = [],
  rows = [],
  empty = 'Sem registros',
  rowKey = 'id',
  zebra = false,
  density = 'comfortable',
  stickyHeader = false,
  style = {},
  ...rest
}) {
  const keyFor = (row, ri) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? ri);
  const d = DENSITY[density] || DENSITY.comfortable;

  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }} {...rest}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || 'start',
                  padding: d.th,
                  width: c.width,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  letterSpacing: 'var(--ls-wide)',
                  textTransform: 'uppercase',
                  color: 'var(--text-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap',
                  background: 'var(--surface-card)',
                  ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 1 } : null),
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyCell colSpan={columns.length} empty={empty} />
          ) : (
            rows.map((row, ri) => (
              <tr
                key={keyFor(row, ri)}
                className="kbly-row"
                style={{
                  transition: 'background var(--dur-fast)',
                  background: zebra && ri % 2 === 1 ? 'color-mix(in srgb, var(--surface-sunken) 50%, transparent)' : undefined,
                }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.align === 'end' ? 'kbly-num' : undefined}
                    style={{
                      textAlign: c.align || 'start',
                      padding: d.td,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-body)',
                      borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
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
