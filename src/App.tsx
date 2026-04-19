import { useState } from 'react'
import { type DetectorMode } from './lib/anomaly'
import { ChartsPanel } from './components/ChartsPanel'
import { parseCsvFile } from './lib/csv'
import { DataLoadPanel } from './components/DataLoadPanel'
import { useBackendSessions } from './hooks/useBackendSessions'
import {
  metricOptions,
  type MetricKey,
  useSessionAnalytics,
} from './hooks/useSessionAnalytics'
import type { ParsedCsvFile } from './types/sessionData'
import { expectedColumns } from './types/sessionData'
import './App.css'

function App() {
  const [parsedFiles, setParsedFiles] = useState<ParsedCsvFile[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('all')
  const [startRowInput, setStartRowInput] = useState('1')
  const [endRowInput, setEndRowInput] = useState('40')
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('speed')
  const [detectorMode, setDetectorMode] = useState<DetectorMode>('hybrid')
  const [anomalySensitivity, setAnomalySensitivity] = useState(55)

  const {
    backendApiUrl,
    setBackendApiUrl,
    backendSessions,
    selectedBackendSessionFileName,
    setSelectedBackendSessionFileName,
    isLoadingBackendSessions,
    isImportingBackendSessions,
    backendStatus,
    refreshBackendSessions,
    importBackendSessions,
  } = useBackendSessions({
    setParseError,
    onFilesImported: (fetchedFiles) => {
      setParsedFiles(fetchedFiles)
      setSelectedFileName('all')
      setStartRowInput('1')
      setEndRowInput('40')
    },
  })

  const {
    fileOptions,
    totalRows,
    allHeadersCount,
    parsingWarnings,
    previewHeaders,
    startRow,
    endRow,
    rowsInRange,
    detectorModeLabel,
    previewRows,
    previewAnomalies,
    missingColumns,
    totalDistance,
    averageSpeed,
    onCourseAverage,
    maxDrift,
    highRiskCount,
    mediumRiskCount,
    topAnomalies,
    averageAnomalyScore,
    chartData,
    mainChartTitle,
    mainChartMetric,
    mainChartColor,
    hasMainChartData,
  } = useSessionAnalytics({
    parsedFiles,
    selectedFileName,
    startRowInput,
    endRowInput,
    selectedMetric,
    detectorMode,
    anomalySensitivity,
  })

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
      <div className="moving-waves" aria-hidden="true">
        <div className="wave-layer wave-layer-one"></div>
        <div className="wave-layer wave-layer-two"></div>
        <div className="wave-layer wave-layer-three"></div>
      </div>

      <header className="hero-header">
        <p className="eyebrow">Gait Rehab Analytics</p>
        <h1>Dashboard</h1>
        <p className="hero-copy">
          Upload gait CSV files or load them straight from your backend to show
          live HoloLens sessions.
        </p>
      </header>

      <section className="card-grid">
        <DataLoadPanel
          isParsing={isParsing}
          handleFileUpload={handleFileUpload}
          backendApiUrl={backendApiUrl}
          setBackendApiUrl={setBackendApiUrl}
          isLoadingBackendSessions={isLoadingBackendSessions}
          refreshBackendSessions={refreshBackendSessions}
          selectedBackendSessionFileName={selectedBackendSessionFileName}
          setSelectedBackendSessionFileName={setSelectedBackendSessionFileName}
          backendSessions={backendSessions}
          isImportingBackendSessions={isImportingBackendSessions}
          importBackendSessions={importBackendSessions}
          setParseError={(value) => {
            setParseError(value)
          }}
          backendStatus={backendStatus}
          parsedFilesCount={parsedFiles.length}
          totalRows={totalRows}
          startRow={startRow}
          endRow={endRow}
          rowsInRangeCount={rowsInRange.length}
          fileOptions={fileOptions}
          selectedFileName={selectedFileName}
          setSelectedFileName={setSelectedFileName}
          metricOptions={metricOptions}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          detectorMode={detectorMode}
          setDetectorMode={setDetectorMode}
          anomalySensitivity={anomalySensitivity}
          setAnomalySensitivity={setAnomalySensitivity}
          detectorModeLabel={detectorModeLabel}
          startRowInput={startRowInput}
          setStartRowInput={setStartRowInput}
          endRowInput={endRowInput}
          setEndRowInput={setEndRowInput}
          parseError={parseError}
        />

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
            Found {allHeadersCount} columns. Missing {missingColumns.length}.
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
                    <th>anomaly_risk</th>
                    <th>anomaly_score</th>
                    <th>anomaly_reason</th>
                    {previewHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => {
                    const anomaly = previewAnomalies[index]

                    return (
                    <tr key={`${row.source_file}-${index}`}>
                      <td>
                        {anomaly ? (
                          <span
                            className={
                              anomaly.risk === 'High'
                                ? 'risk-pill risk-pill-high'
                                : anomaly.risk === 'Medium'
                                  ? 'risk-pill risk-pill-medium'
                                  : 'risk-pill risk-pill-low'
                            }
                          >
                            {anomaly.risk}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{anomaly ? anomaly.score.toFixed(1) : '-'}</td>
                      <td>{anomaly ? anomaly.reasons.join(' | ') || '-' : '-'}</td>
                      {previewHeaders.map((header) => (
                        <td key={`${header}-${index}`}>{row[header] || '-'}</td>
                      ))}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

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
        <article className="summary-card">
          <p>High Risk Rows</p>
          <strong>{highRiskCount}</strong>
        </article>
        <article className="summary-card">
          <p>Medium Risk Rows</p>
          <strong>{mediumRiskCount}</strong>
        </article>
      </section>

      <section className="panel anomaly-list-panel">
        <h2>Top Anomaly Rows</h2>
        {topAnomalies.length === 0 ? (
          <p className="empty-message">No rows in range yet.</p>
        ) : (
          <ol className="top-anomaly-list">
            {topAnomalies.map((item) => (
              <li key={item.rowNumber}>
                <strong>Row {item.rowNumber}</strong>
                <span>
                  Score {item.score.toFixed(1)} | {item.risk} risk
                </span>
                <span>{item.reasons[0] || 'No reason available'}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="schema-meta">
          Current mode: <strong>{detectorModeLabel}</strong> | Average anomaly
          score: <strong>{averageAnomalyScore.toFixed(1)}</strong>
        </p>
      </section>

      <ChartsPanel
        chartData={chartData}
        mainChartTitle={mainChartTitle}
        mainChartMetric={mainChartMetric}
        mainChartColor={mainChartColor}
        hasMainChartData={hasMainChartData}
      />
    </main>
  )
}

export default App
