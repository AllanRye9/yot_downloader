import { useState, useMemo } from 'react'

export default function VisitorsTable({ visitors, loading, onClear }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    let rows = [...(visitors || [])]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        (r.ip      || '').includes(q) ||
        (r.country || '').toLowerCase().includes(q) ||
        (r.browser || '').toLowerCase().includes(q) ||
        (r.os      || '').toLowerCase().includes(q) ||
        (r.page    || '').toLowerCase().includes(q)
      )
    }
    if (filter !== 'all') rows = rows.filter(r => r.device === filter)
    return rows
  }, [visitors, search, filter])

  if (loading) return <div className="flex justify-center py-20"><span className="spinner w-10 h-10" /></div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input flex-1 text-sm"
          placeholder="Search IP, country, browser, OS…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input sm:w-40 text-sm"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
        <button className="btn-danger btn-sm whitespace-nowrap" onClick={onClear}>
          🗑 Clear all
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-3">{filtered.length} visitors</p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              {['Date', 'IP', 'Country', 'Browser', 'OS', 'Device', 'Page'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {row.timestamp ? new Date(row.timestamp * 1000).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-gray-400">{row.ip || '—'}</td>
                <td className="px-3 py-3 text-gray-300">{row.country || '—'}</td>
                <td className="px-3 py-3 text-gray-400">{row.browser || '—'}</td>
                <td className="px-3 py-3 text-gray-400">{row.os || '—'}</td>
                <td className="px-3 py-3">
                  <span className="text-xs">
                    {row.device === 'mobile' ? '📱' : row.device === 'tablet' ? '📟' : '🖥'} {row.device || '—'}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 font-mono text-xs">{row.page || '—'}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-600">No visitors found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((row, i) => (
          <div key={i} className="card text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-gray-500">{row.ip || '—'}</span>
              <span className="text-xs text-gray-600">{row.timestamp ? new Date(row.timestamp * 1000).toLocaleDateString() : ''}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-400">
              <span>🌍 {row.country || '—'}</span>
              <span>🌐 {row.browser || '—'}</span>
              <span>💻 {row.os || '—'}</span>
              <span>{row.device === 'mobile' ? '📱' : row.device === 'tablet' ? '📟' : '🖥'} {row.device || '—'}</span>
              <span className="col-span-2 text-gray-600">Page: {row.page || '/'}</span>
            </div>
          </div>
        ))}
        {!filtered.length && <p className="text-center py-10 text-gray-600">No visitors found</p>}
      </div>
    </div>
  )
}
