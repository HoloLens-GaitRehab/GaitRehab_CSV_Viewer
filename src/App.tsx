import { useMemo, useState } from 'react'
import { parseCsvFile } from './lib/csv'
import type { ParsedCsvFile } from './types/sessionData'
import { expectedColumns } from './types/sessionData'
import './App.css'

type PreviewRow = Record<string, string>

function App() {
  const [parsedFiles, setParsedFiles] = useState<ParsedCsvFile[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const allHeaders = useMemo(() => {
    const headers = new Set<string>()

    parsedFiles.forEach((file) => {
      file.headers.forEach((header) => headers.add(header))
    })

    return Array.from(headers)
  }, [parsedFiles])

  const previewHeaders = useMemo(
    () => ['source_file', ...allHeaders],
    [allHeaders],
  )

  const previewRows = useMemo<PreviewRow[]>(
    () =>
      parsedFiles
        .flatMap((file) =>
          file.rows.map((row): PreviewRow => ({
            source_file: file.fileName,
            ...row,
          })),
        )
        .slice(0, 40),
    [parsedFiles],
  )

  const totalRows = useMemo(
    () => parsedFiles.reduce((acc, file) => acc + file.rows.length, 0),
    [parsedFiles],
  )

  const missingColumns = useMemo(
    () => expectedColumns.filter((column) => !allHeaders.includes(column)),
    [allHeaders],
  )

  const parsingWarnings = useMemo(
    () =>
      parsedFiles.flatMap((file) =>
        file.warnings.map((warning) => `${file.fileName}: ${warning}`),
      ),
    [parsedFiles],
  )

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
        <h1>GaitScope Dashboard</h1>
        <p className="hero-copy">
          Upload one or more gait CSV files to generate session summaries and
          visualizations.
        </p>
      </header>

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
