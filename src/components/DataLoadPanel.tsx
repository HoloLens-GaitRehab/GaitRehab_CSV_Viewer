import { type DetectorMode } from '../lib/anomaly'
import type { BackendSession } from '../hooks/useBackendSessions'
import type { MetricKey } from '../hooks/useSessionAnalytics'

type DataLoadPanelProps = {
  isParsing: boolean
  handleFileUpload: (fileList: FileList | null) => Promise<void>
  backendApiUrl: string
  setBackendApiUrl: (value: string) => void
  isLoadingBackendSessions: boolean
  refreshBackendSessions: () => Promise<void>
  selectedBackendSessionFileName: string
  setSelectedBackendSessionFileName: (value: string) => void
  backendSessions: BackendSession[]
  isImportingBackendSessions: boolean
  importBackendSessions: (fileNames: string[], importLabel: string) => Promise<void>
  setParseError: (value: string) => void
  backendStatus: string | null
  parsedFilesCount: number
  totalRows: number
  startRow: number
  endRow: number
  rowsInRangeCount: number
  fileOptions: string[]
  selectedFileName: string
  setSelectedFileName: (value: string) => void
  metricOptions: { key: MetricKey; label: string }[]
  selectedMetric: MetricKey
  setSelectedMetric: (value: MetricKey) => void
  detectorMode: DetectorMode
  setDetectorMode: (value: DetectorMode) => void
  anomalySensitivity: number
  setAnomalySensitivity: (value: number) => void
  detectorModeLabel: string
  startRowInput: string
  setStartRowInput: (value: string) => void
  endRowInput: string
  setEndRowInput: (value: string) => void
  parseError: string | null
}

export function DataLoadPanel({
  isParsing,
  handleFileUpload,
  backendApiUrl,
  setBackendApiUrl,
  isLoadingBackendSessions,
  refreshBackendSessions,
  selectedBackendSessionFileName,
  setSelectedBackendSessionFileName,
  backendSessions,
  isImportingBackendSessions,
  importBackendSessions,
  setParseError,
  backendStatus,
  parsedFilesCount,
  totalRows,
  startRow,
  endRow,
  rowsInRangeCount,
  fileOptions,
  selectedFileName,
  setSelectedFileName,
  metricOptions,
  selectedMetric,
  setSelectedMetric,
  detectorMode,
  setDetectorMode,
  anomalySensitivity,
  setAnomalySensitivity,
  detectorModeLabel,
  startRowInput,
  setStartRowInput,
  endRowInput,
  setEndRowInput,
  parseError,
}: DataLoadPanelProps) {
  return (
    <article className="panel upload-panel">
      <h2>1. Load Session Data</h2>
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
      <div className="backend-load-box">
        <p className="backend-load-title">Or load from backend API</p>
        <div className="backend-url-row">
          <label htmlFor="backendApiUrl">Backend URL</label>
          <input
            id="backendApiUrl"
            type="text"
            value={backendApiUrl}
            onChange={(event) => {
              setBackendApiUrl(event.target.value)
            }}
            placeholder="http://localhost:4000"
          />
          <button
            type="button"
            onClick={() => {
              void refreshBackendSessions()
            }}
            disabled={isLoadingBackendSessions}
          >
            {isLoadingBackendSessions ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="backend-actions-row">
          <select
            value={selectedBackendSessionFileName}
            onChange={(event) => {
              setSelectedBackendSessionFileName(event.target.value)
            }}
            disabled={backendSessions.length === 0}
          >
            {backendSessions.length === 0 ? (
              <option value="">No backend sessions found</option>
            ) : (
              backendSessions.map((session) => (
                <option key={session.id} value={session.fileName}>
                  {session.fileName}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!selectedBackendSessionFileName) {
                setParseError('Select a backend session first.')
                return
              }

              void importBackendSessions(
                [selectedBackendSessionFileName],
                'Selected import',
              )
            }}
            disabled={isImportingBackendSessions || !selectedBackendSessionFileName}
          >
            {isImportingBackendSessions ? 'Loading...' : 'Load Selected'}
          </button>
          <button
            type="button"
            onClick={() => {
              const fileNames = backendSessions.map((session) => session.fileName)
              void importBackendSessions(fileNames, 'Bulk import')
            }}
            disabled={isImportingBackendSessions || backendSessions.length === 0}
          >
            Load All
          </button>
        </div>
        <p className="upload-meta">
          Backend sessions: <strong>{backendSessions.length}</strong>
        </p>
        {backendStatus && <p className="backend-status">{backendStatus}</p>}
      </div>
      <p className="upload-meta">
        Files: <strong>{parsedFilesCount}</strong> | Rows: <strong>{totalRows}</strong>
      </p>
      <p className="upload-meta">
        Using row range: <strong>{startRow}</strong> to <strong>{endRow}</strong> ({rowsInRangeCount} rows)
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
      <div className="metric-chip-row">
        <p>Main chart metric:</p>
        <div className="metric-chip-list">
          {metricOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={
                selectedMetric === option.key
                  ? 'metric-chip metric-chip-active'
                  : 'metric-chip'
              }
              onClick={() => {
                setSelectedMetric(option.key)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="detector-row">
        <label htmlFor="detectorMode">Anomaly detector:</label>
        <select
          id="detectorMode"
          value={detectorMode}
          onChange={(event) => {
            setDetectorMode(event.target.value as DetectorMode)
          }}
        >
          <option value="hybrid">Hybrid (recommended)</option>
          <option value="kmeans">K-Means only</option>
          <option value="zscore">Z-Score only</option>
        </select>
      </div>
      <div className="sensitivity-row">
        <label htmlFor="anomalySensitivity">Sensitivity:</label>
        <input
          id="anomalySensitivity"
          type="range"
          min="20"
          max="90"
          step="1"
          value={anomalySensitivity}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10)
            if (Number.isNaN(nextValue)) {
              return
            }

            setAnomalySensitivity(nextValue)
          }}
        />
        <strong>{anomalySensitivity}</strong>
      </div>
      <p className="upload-meta">
        Anomaly mode: <strong>{detectorModeLabel}</strong>
      </p>
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
  )
}
