import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetricKey } from '../hooks/useSessionAnalytics'

type ChartRow = {
  row: string
  speed: number | null
  onCourse: number | null
  offCourse: number | null
  drift: number | null
}

type ChartsPanelProps = {
  chartData: ChartRow[]
  mainChartTitle: string
  mainChartMetric: MetricKey
  mainChartColor: string
  hasMainChartData: boolean
}

export function ChartsPanel({
  chartData,
  mainChartTitle,
  mainChartMetric,
  mainChartColor,
  hasMainChartData,
}: ChartsPanelProps) {
  return (
    <section className="charts-grid">
      <article className="chart-card">
        <h3>{mainChartTitle}</h3>
        {!hasMainChartData ? (
          <p className="empty-message">No numeric values available yet.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="row" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={mainChartMetric}
                  stroke={mainChartColor}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="chart-card">
        <h3>On Course vs Off Course %</h3>
        {chartData.every((item) => item.onCourse === null) ? (
          <p className="empty-message">No numeric values available yet.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="row" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="onCourse" fill="#4ea16d" />
                <Bar dataKey="offCourse" fill="#d57b57" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="chart-card chart-card-wide">
        <h3>Drift Trend</h3>
        {chartData.every((item) => item.drift === null) ? (
          <p className="empty-message">No numeric values available yet.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="row" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="drift"
                  stroke="#6a6ad2"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  )
}
