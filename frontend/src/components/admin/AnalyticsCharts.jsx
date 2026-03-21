import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899']

// Country centroid lookup: ISO 3166-1 alpha-2 → [lat, lng]
const COUNTRY_CENTROIDS = {
  AF:[33.93,67.71],AL:[41.15,20.17],DZ:[28.03,1.66],AO:[-11.20,17.87],AR:[-38.42,-63.62],
  AM:[40.07,45.04],AU:[-25.27,133.78],AT:[47.52,14.55],AZ:[40.14,47.58],BH:[26.03,50.55],
  BD:[23.68,90.36],BY:[53.71,27.95],BE:[50.50,4.47],BZ:[17.19,-88.50],BJ:[9.31,2.32],
  BO:[-16.29,-63.59],BA:[43.92,17.68],BW:[-22.33,24.68],BR:[-14.24,-51.93],BN:[4.54,114.73],
  BG:[42.73,25.49],BF:[12.36,-1.56],BI:[-3.37,29.92],KH:[12.57,104.99],CM:[3.85,11.50],
  CA:[56.13,-106.35],CF:[6.61,20.94],TD:[15.45,18.73],CL:[-35.68,-71.54],CN:[35.86,104.20],
  CO:[4.57,-74.30],CD:[-4.04,21.76],CG:[-0.23,15.83],CR:[9.75,-83.75],CI:[7.54,-5.55],
  HR:[45.10,15.20],CU:[21.52,-77.78],CY:[35.13,33.43],CZ:[49.82,15.47],DK:[56.26,9.50],
  DJ:[11.83,42.59],DO:[18.74,-70.16],EC:[-1.83,-78.18],EG:[26.82,30.80],SV:[13.79,-88.90],
  GQ:[1.65,10.27],ER:[15.18,39.78],EE:[58.60,25.01],ET:[9.14,40.49],FI:[61.92,25.75],
  FR:[46.23,2.21],GA:[-0.80,11.61],GM:[13.44,-15.31],GE:[42.32,43.36],DE:[51.17,10.45],
  GH:[7.95,-1.02],GR:[39.07,21.82],GT:[15.78,-90.23],GN:[9.95,-11.39],GW:[11.80,-15.18],
  GY:[4.86,-58.93],HT:[18.97,-72.29],HN:[15.20,-86.24],HU:[47.16,19.50],IS:[64.96,-19.02],
  IN:[20.59,78.96],ID:[-0.79,113.92],IR:[32.43,53.69],IQ:[33.22,43.68],IE:[53.41,-8.24],
  IL:[31.05,34.85],IT:[41.87,12.57],JM:[18.11,-77.30],JP:[36.20,138.25],JO:[30.59,36.24],
  KZ:[48.02,66.92],KE:[-0.02,37.91],KW:[29.31,47.48],KG:[41.20,74.77],LA:[19.86,102.50],
  LV:[56.88,24.60],LB:[33.85,35.86],LS:[-29.61,28.23],LR:[6.43,-9.43],LY:[26.34,17.23],
  LT:[55.17,23.88],LU:[49.82,6.13],MK:[41.61,21.75],MG:[-18.77,46.87],MW:[-13.25,34.30],
  MY:[4.21,101.98],MV:[3.20,73.22],ML:[17.57,-3.99],MT:[35.94,14.38],MR:[21.01,-10.94],
  MX:[23.63,-102.55],MD:[47.41,28.37],MN:[46.86,103.85],ME:[42.71,19.37],MA:[31.79,-7.09],
  MZ:[-18.67,35.53],MM:[16.87,96.41],NA:[-22.96,18.49],NP:[28.39,84.12],NL:[52.13,5.29],
  NZ:[-40.90,174.89],NI:[12.87,-85.21],NE:[17.61,8.08],NG:[9.08,8.68],NO:[60.47,8.47],
  OM:[21.51,55.92],PK:[30.38,69.35],PA:[8.54,-80.78],PG:[-6.31,143.96],PY:[-23.44,-58.44],
  PE:[-9.19,-75.02],PH:[12.88,121.77],PL:[51.92,19.15],PT:[39.40,-8.22],QA:[25.35,51.18],
  RO:[45.94,24.97],RU:[61.52,105.32],RW:[-1.94,29.87],SA:[23.89,45.08],SN:[14.50,-14.45],
  RS:[44.02,21.01],SL:[8.46,-11.78],SG:[1.35,103.82],SK:[48.67,19.70],SI:[46.15,14.99],
  SO:[5.15,46.20],ZA:[-30.56,22.94],ES:[40.46,-3.75],LK:[7.87,80.77],SD:[12.86,30.22],
  SS:[7.86,31.31],SE:[60.13,18.64],CH:[46.82,8.23],SY:[34.80,38.99],TW:[23.70,120.96],
  TJ:[38.86,71.28],TZ:[-6.37,34.89],TH:[15.87,100.99],TG:[8.62,0.82],TN:[33.89,9.54],
  TR:[38.96,35.24],TM:[38.97,59.56],UG:[1.37,32.29],UA:[48.38,31.17],AE:[23.42,53.85],
  GB:[55.38,-3.44],US:[37.09,-95.71],UY:[-32.52,-55.77],UZ:[41.38,64.59],VE:[6.42,-66.59],
  VN:[14.06,108.28],YE:[15.55,48.52],ZM:[-13.13,27.85],ZW:[-19.02,29.15],
  KR:[35.91,127.77],KP:[40.34,127.51],TL:[-8.87,125.73],PS:[31.95,35.23],
  HK:[22.40,114.11],MO:[22.19,113.54],PR:[18.22,-66.59],
}

function LocationMap({ visitorCountries, downloadCountries }) {
  // Merge visitors + downloads per country
  const byCode = {}
  ;(visitorCountries || []).forEach(({ code, country, count }) => {
    if (!code) return
    const k = code.toUpperCase()
    if (!byCode[k]) byCode[k] = { country: country || k, code: k, visitors: 0, downloads: 0 }
    byCode[k].visitors += count || 0
  })
  ;(downloadCountries || []).forEach(({ code, country, count }) => {
    if (!code) return
    const k = code.toUpperCase()
    if (!byCode[k]) byCode[k] = { country: country || k, code: k, visitors: 0, downloads: 0 }
    byCode[k].downloads += count || 0
  })

  const entries = Object.values(byCode).filter(d => COUNTRY_CENTROIDS[d.code])
  const maxV = Math.max(...entries.map(d => d.visitors), 1)

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={1}
      maxZoom={8}
      scrollWheelZoom={false}
      style={{ height: '420px', width: '100%', borderRadius: '0 0 12px 12px', background: '#1a2234' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {entries.map(d => {
        const [lat, lng] = COUNTRY_CENTROIDS[d.code]
        const r = 4 + Math.round(Math.sqrt(d.visitors / maxV) * 16)
        return (
          <CircleMarker
            key={d.code}
            center={[lat, lng]}
            radius={r}
            pathOptions={{ fillColor: '#667eea', color: '#fff', weight: 1.5, fillOpacity: 0.72 }}
          >
            <Popup>
              <strong>{d.country}</strong><br />
              <span style={{ color: '#667eea' }}>👤 {d.visitors.toLocaleString()} visitor{d.visitors !== 1 ? 's' : ''}</span><br />
              <span style={{ color: '#10b981' }}>⬇ {d.downloads.toLocaleString()} download{d.downloads !== 1 ? 's' : ''}</span>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

function SectionHeading({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      <span className="text-lg">{icon}</span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="flex-1 h-px bg-gray-800 ml-2" />
    </div>
  )
}

function ChartCard({ title, children, wide = false }) {
  return (
    <div className={`card ${wide ? 'col-span-full' : ''}`}>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}

function NoData() {
  return <p className="text-center text-gray-600 text-sm py-6">No data yet</p>
}

const TOOLTIP_STYLE = { background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }

/* ── Daily Downloads Area Chart ── */
function DailyDownloadsChart({ data }) {
  if (!Array.isArray(data) || !data.length) return <NoData />
  const chartData = data.map((v, i) => ({ day: `${i + 1}`, downloads: v }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} interval={4} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="downloads" stroke="#ef4444" fill="url(#dlGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── Status Breakdown Donut ── */
function StatusPieChart({ analytics }) {
  const data = [
    { name: 'Completed', value: analytics?.completed_count || 0 },
    { name: 'Failed',    value: analytics?.failed_count    || 0 },
    { name: 'Cancelled', value: analytics?.cancelled_count || 0 },
  ].filter(d => d.value > 0)
  if (!data.length) return <NoData />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
          label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
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
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
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
        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[4,4,0,0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function AnalyticsCharts({ analytics, downloadsTrend }) {
  if (!analytics) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s}>
          <div className="h-6 w-48 bg-gray-800 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card h-64 animate-pulse bg-gray-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const {
    peak_hours = [],
    visitor_hours = [],
    os_breakdown = [],
    device_breakdown = [],
    dow_downloads = [],
    review_ratings = [],
    download_countries = [],
    visitor_countries = [],
    format_preferences = [],
  } = analytics

  const peakData         = peak_hours.map((v, i) => ({ name: `${i}h`, value: v }))
  const visitorHoursData = visitor_hours.map((v, i) => ({ name: `${i}h`, value: v }))
  const DOW_NAMES        = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const dowData          = dow_downloads.map((v, i) => ({ name: DOW_NAMES[i] || `D${i}`, value: v }))
  const osData           = os_breakdown.map(x => ({ name: x.os, value: x.count }))
  const deviceData       = device_breakdown.map(x => ({ name: x.device, value: x.count }))
  const reviewData       = review_ratings.map((v, i) => ({ name: `${i+1}★`, value: v }))
  const formatData       = format_preferences.slice(0, 10).map(x => ({ name: x.format, value: x.count }))
  const dlCountryData    = download_countries.slice(0, 10).map(x => ({ name: x.country, value: x.count }))
  const visCountryData   = visitor_countries.slice(0, 10).map(x => ({ name: x.country, value: x.count }))

  return (
    <div>
      {/* ── Download Performance ── */}
      <SectionHeading icon="📥" title="Download Performance" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Daily Downloads — 30 days">
          <DailyDownloadsChart data={downloadsTrend} />
        </ChartCard>
        <ChartCard title="Download Status Breakdown">
          <StatusPieChart analytics={analytics} />
        </ChartCard>
        <ChartCard title="Peak Download Hours">
          <SimpleBar data={peakData} color="#ef4444" />
        </ChartCard>
        <ChartCard title="Day of Week">
          <SimpleBar data={dowData} color="#8b5cf6" />
        </ChartCard>
      </div>

      {/* ── Visitor Insights ── */}
      <SectionHeading icon="👥" title="Visitor Insights" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Peak Visitor Hours">
          <SimpleBar data={visitorHoursData} color="#3b82f6" />
        </ChartCard>
        <ChartCard title="Devices">
          {deviceData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deviceData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <NoData />}
        </ChartCard>
      </div>

      {/* ── Content & Preferences ── */}
      <SectionHeading icon="🎬" title="Content & Preferences" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Format Preferences (Top 10)">
          <ColorBar data={formatData} />
        </ChartCard>
        <ChartCard title="Operating Systems">
          <ColorBar data={osData} />
        </ChartCard>
        <ChartCard title="Review Ratings">
          <SimpleBar data={reviewData} color="#f59e0b" />
        </ChartCard>
      </div>

      {/* ── Geographic Distribution ── */}
      <SectionHeading icon="🌍" title="Geographic Distribution" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Downloads by Country (Top 10)">
          <ColorBar data={dlCountryData} height={220} />
        </ChartCard>
        <ChartCard title="Visitors by Country (Top 10)">
          <ColorBar data={visCountryData} height={220} />
        </ChartCard>
      </div>

      {/* ── Interactive World Map ── */}
      <SectionHeading icon="🗺️" title="User &amp; Visitor Locations" />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <LocationMap
          visitorCountries={visitor_countries}
          downloadCountries={download_countries}
        />
      </div>
    </div>
  )
}
