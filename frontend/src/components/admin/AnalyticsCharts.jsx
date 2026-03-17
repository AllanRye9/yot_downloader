import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899']

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function NoData() {
  return <p className="text-center text-gray-600 text-sm py-6">No data yet</p>
}

/* ── Daily Downloads Line Chart ── */
function DailyDownloadsChart({ data }) {
  // data may be a 30-element array (oldest→newest) or undefined/scalar
  if (!Array.isArray(data) || !data.length) return <NoData />
  const chartData = data.map((v, i) => ({ day: `${i + 1}`, downloads: v }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
        <Line type="monotone" dataKey="downloads" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Status Breakdown Pie Chart ── */
function StatusPieChart({ analytics }) {
  const data = [
    { name: 'Completed', value: analytics?.completed_count || 0 },
    { name: 'Failed',    value: analytics?.failed_count    || 0 },
    { name: 'Cancelled', value: analytics?.cancelled_count || 0 },
  ].filter(d => d.value > 0)
  if (!data.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
          label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ── Simple bar chart ── */
function SimpleBar({ data, color = '#ef4444', height = 200 }) {
  if (!data?.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
        <Bar dataKey="value" fill={color} radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Multi-color bar chart ── */
function ColorBar({ data, height = 200 }) {
  if (!data?.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
        <Bar dataKey="value" radius={[4,4,0,0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function AnalyticsCharts({ analytics, downloadsTrend }) {
  if (!analytics) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card h-64 animate-pulse bg-gray-800" />
      ))}
    </div>
  )

  const {
    peak_hours = [],
    visitor_hours = [],
    os_breakdown = [],        // [{os, count}]
    device_breakdown = [],    // [{device, count}]
    dow_downloads = [],
    review_ratings = [],
    download_countries = [],  // [{country, code, count}]
    visitor_countries = [],   // [{country, code, count}]
    format_preferences = [],  // [{format, count}]
  } = analytics

  // Peak hours (0-23 array of counts)
  const peakData = peak_hours.map((v, i) => ({ name: `${i}h`, value: v }))
  const visitorHoursData = visitor_hours.map((v, i) => ({ name: `${i}h`, value: v }))

  // Day-of-week
  const DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const dowData = dow_downloads.map((v, i) => ({ name: DOW_NAMES[i] || `D${i}`, value: v }))

  // OS — [{os, count}] → [{name, value}]
  const osData = os_breakdown.map(x => ({ name: x.os, value: x.count }))

  // Device — [{device, count}]
  const deviceData = device_breakdown.map(x => ({ name: x.device, value: x.count }))

  // Review ratings (0-indexed array: index 0 = 1-star)
  const reviewData = review_ratings.map((v, i) => ({ name: `${i+1}★`, value: v }))

  // Format preferences [{format, count}]
  const formatData = format_preferences.slice(0, 10).map(x => ({ name: x.format, value: x.count }))

  // Top 10 download countries
  const dlCountryData = download_countries.slice(0, 10).map(x => ({ name: x.country, value: x.count }))

  // Top 10 visitor countries
  const visCountryData = visitor_countries.slice(0, 10).map(x => ({ name: x.country, value: x.count }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard title="📅 Daily Downloads (30 days)">
        <DailyDownloadsChart data={downloadsTrend} />
      </ChartCard>

      <ChartCard title="🍕 Download Status">
        <StatusPieChart analytics={analytics} />
      </ChartCard>

      <ChartCard title="⏰ Peak Download Hours">
        <SimpleBar data={peakData} color="#ef4444" />
      </ChartCard>

      <ChartCard title="👁 Peak Visitor Hours">
        <SimpleBar data={visitorHoursData} color="#3b82f6" />
      </ChartCard>

      <ChartCard title="💻 Operating Systems">
        <ColorBar data={osData} />
      </ChartCard>

      <ChartCard title="📱 Devices">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={deviceData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
              {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="📆 Day of Week Downloads">
        <SimpleBar data={dowData} color="#8b5cf6" />
      </ChartCard>

      <ChartCard title="⭐ Review Ratings">
        <SimpleBar data={reviewData} color="#f59e0b" />
      </ChartCard>

      <ChartCard title="🎬 Format Preferences">
        <ColorBar data={formatData} />
      </ChartCard>

      <ChartCard title="🌍 Downloads by Country (Top 10)">
        <ColorBar data={dlCountryData} />
      </ChartCard>

      <ChartCard title="👥 Visitors by Country (Top 10)">
        <ColorBar data={visCountryData} />
      </ChartCard>
    </div>
  )
}
