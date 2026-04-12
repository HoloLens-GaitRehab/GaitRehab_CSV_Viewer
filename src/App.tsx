import { useState } from 'react'
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
import { parseCsvFile } from './lib/csv'
import type { ParsedCsvFile } from './types/sessionData'
import { expectedColumns } from './types/sessionData'
import './App.css'

type PreviewRow = Record<string, string>

type ChartRow = {
  row: string
  speed: number | null
  onCourse: number | null
  offCourse: number | null
  drift: number | null
}

function getNumber(row: PreviewRow, key: string): number | null {
  const rawValue = row[key]

  if (!rawValue) {
    return null
  }

  const value = Number.parseFloat(rawValue)
  if (Number.isNaN(value)) {
    return null
  }

  return value
}

function getNumberFromKeys(row: PreviewRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = getNumber(row, key)
    if (value !== null) {
      return value
    }
  }

  return null
}

function App() {
  const [parsedFiles, setParsedFiles] = useState<ParsedCsvFile[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('all')
  const [startRowInput, setStartRowInput] = useState('1')
  const [endRowInput, setEndRowInput] = useState('40')
  const [selectedMetric, setSelectedMetric] = useState('speed')

  const fileOptions = ['all']
  for (const file of parsedFiles) {
    fileOptions.push(file.fileName)
  }

  let filesToUse = parsedFiles
  if (selectedFileName !== 'all') {
    filesToUse = parsedFiles.filter((file) => file.fileName === selectedFileName)
  }

  const allHeaders: string[] = []
  const allRows: PreviewRow[] = []
  const parsingWarnings: string[] = []
  let totalRows = 0

  for (const file of filesToUse) {
    totalRows += file.rows.length

    for (const warning of file.warnings) {
      parsingWarnings.push(`${file.fileName}: ${warning}`)
    }

    for (const header of file.headers) {
      if (!allHeaders.includes(header)) {
        allHeaders.push(header)
      }
    }

    for (const row of file.rows) {
      allRows.push({
        source_file: file.fileName,
        ...row,
      })
    }
  }

  const previewHeaders = ['source_file', ...allHeaders]

  let startRow = Number.parseInt(startRowInput, 10)
  let endRow = Number.parseInt(endRowInput, 10)

  if (Number.isNaN(startRow) || startRow < 1) {
    startRow = 1
  }

  if (Number.isNaN(endRow) || endRow < 1) {
    endRow = 40
  }

  if (endRow < startRow) {
    endRow = startRow
  }

  if (endRow > allRows.length) {
    endRow = allRows.length
  }

  const rowStartIndex = startRow - 1
  const rowEndIndex = endRow
  const rowsInRange = allRows.slice(rowStartIndex, rowEndIndex)

  const previewRows = rowsInRange.slice(0, 40)

  const missingColumns = expectedColumns.filter(
    (column) => !allHeaders.includes(column),
  )

  let totalDistance = 0
  let speedCount = 0
  let speedTotal = 0
  let onCourseCount = 0
  let onCourseTotal = 0
  let maxDrift = 0

  const chartData: ChartRow[] = []

  for (let index = 0; index < rowsInRange.length; index += 1) {
    const row = rowsInRange[index]

    const distance = getNumberFromKeys(row, ['distance'])
    if (distance !== null) {
      totalDistance += distance
    }

    const avgSpeed = getNumberFromKeys(row, ['avg_speed_mps', 'avg_speed'])
    if (avgSpeed !== null) {
      speedTotal += avgSpeed
      speedCount += 1
    }

    const onCourse = getNumberFromKeys(row, ['on_course_percent', 'on_course'])
    if (onCourse !== null) {
      onCourseTotal += onCourse
      onCourseCount += 1
    }

    const offCourse = getNumberFromKeys(row, ['off_course'])
    const driftMax = getNumberFromKeys(row, ['drift_max'])
    const driftAvg = getNumberFromKeys(row, ['drift_avg'])
    const drift = driftMax ?? driftAvg

    if (drift !== null && drift > maxDrift) {
      maxDrift = drift
    }

    if (chartData.length < 40) {
      chartData.push({
        row: `${startRow + index}`,
        speed: avgSpeed,
        onCourse,
        offCourse,
        drift,
      })
    }
  }

  const averageSpeed = speedCount > 0 ? speedTotal / speedCount : 0
  const onCourseAverage = onCourseCount > 0 ? onCourseTotal / onCourseCount : 0

  const handleFileUpload = async (fileList: FileList | null): Promise<void> => {
    if (!fileList) {
      return
    }

    const csvFiles = Array.from(fileList).filter((file) =>
      file.name.toLowerCase().endsWith('.csv'),
    )

    if (csvFiles.length === 0) {
      setParseError('Select at least one CSV file.')
      setParsedFiles([])
      return
    }

    setIsParsing(true)
    setParseError(null)

    try {
      const nextParsed = await Promise.all(csvFiles.map(parseCsvFile))
      setParsedFiles(nextParsed)
      setSelectedFileName('all')
    } catch {
      setParsedFiles([])
      setParseError('Unable to parse the selected files.')
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <main className="page-shell">
      <header className="hero-header">
        <p className="eyebrow">Gait Rehab Analytics</p>
        <h1>Dashboard</h1>
        <p className="hero-copy">
          Upload one or more gait CSV files to generate session summaries and
          visualizations.
        </p>
      </header>

      <section className="summary-grid">
        <article className="summary-card">
          <p>Total Distance</p>
          <strong>{totalDistance.toFixed(3)} m</strong>
        </article>
        <article className="summary-card">
          <p>Average Speed</p>
          <strong>{averageSpeed.toFixed(3)} m/s</strong>
        </article>
        <article className="summary-card">
          <p>On-Course Average</p>
          <strong>{onCourseAverage.toFixed(2)}%</strong>
        </article>
        <article className="summary-card">
          <p>Max Drift</p>
          <strong>{maxDrift.toFixed(3)}</strong>
        </article>
      </section>

      <section className="charts-grid">
        <article className="chart-card">
          <h3>Average Speed (first 40 rows)</h3>
          {chartData.every((item) => item.speed === null) ? (
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
                    dataKey="speed"
                    stroke="#cc5c1f"
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

      <section className="card-grid">
        <article className="panel upload-panel">
          <h2>1. Upload CSV</h2>
          <p>Drag files here or use the file picker to load exported session data.</p>
          <label className="upload-button" aria-label="Upload session CSV files">
            {isParsing ? 'Parsing files...' : 'Choose CSV Files'}
            <input
              className="file-input"
              type="file"
              accept=".csv"
              multiple
              onChange={(event) => {
                void handleFileUpload(event.target.files)
              }}
            />
          </label>
          <p className="upload-meta">
            Files: <strong>{parsedFiles.length}</strong> | Rows:{' '}
            <strong>{totalRows}</strong>
          </p>
          <p className="upload-meta">
            Using row range: <strong>{startRow}</strong> to <strong>{endRow}</strong>{' '}
            ({rowsInRange.length} rows)
          </p>
          <div className="filter-row">
            <label htmlFor="fileFilter">File filter:</label>
            <select
              id="fileFilter"
              value={selectedFileName}
              onChange={(event) => {
                setSelectedFileName(event.target.value)
              }}
            >
              {fileOptions.map((fileName) => (
                <option key={fileName} value={fileName}>
                  {fileName === 'all' ? 'All files' : fileName}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-row">
            <label htmlFor="metricFilter">Main chart metric:</label>
            <select
              id="metricFilter"
              value={selectedMetric}
              onChange={(event) => {
                setSelectedMetric(event.target.value)
              }}
            >
              <option value="speed">Speed</option>
              <option value="onCourse">On Course %</option>
              <option value="offCourse">Off Course %</option>
              <option value="drift">Drift</option>
            </select>
          </div>
          <div className="range-row">
            <label htmlFor="startRow">Rows:</label>
            <input
              id="startRow"
              type="number"
              min="1"
              value={startRowInput}
              onChange={(event) => {
                setStartRowInput(event.target.value)
              }}
            />
            <span>to</span>
            <input
              id="endRow"
              type="number"
              min="1"
              value={endRowInput}
              onChange={(event) => {
                setEndRowInput(event.target.value)
              }}
            />
          </div>
          {parseError && <p className="error-text">{parseError}</p>}
        </article>

        <article className="panel schema-panel">
          <h2>Expected Columns</h2>
          <div className="chip-list">
            {expectedColumns.map((column) => (
              <span key={column} className="chip">
                {column}
              </span>
            ))}
          </div>
          <p className="schema-meta">
            Found {allHeaders.length} columns. Missing {missingColumns.length}.
          </p>
          {missingColumns.length > 0 && (
            <div className="chip-list">
              {missingColumns.map((column) => (
                <span key={column} className="chip missing-chip">
                  {column}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="panel preview-panel">
          <h2>Session Data Preview</h2>
          {parsingWarnings.length > 0 && (
            <div className="warning-block">
              {parsingWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {previewRows.length === 0 ? (
            <p className="empty-message">
              No data loaded yet. After upload, rows and metrics will appear here.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {previewHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.source_file}-${index}`}>
                      {previewHeaders.map((header) => (
                        <td key={`${header}-${index}`}>{row[header] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
