import './App.css'

function App() {
  const expectedColumns = [
    'timestamp',
    'completion',
    'distance',
    'elapsed_s',
    'avg_speed',
    'pace_s_per',
    'on_course',
    'off_course',
    'off_course_drift',
    'drift_avg',
    'drift_max',
    'app_version',
    'unity_version',
    'device_model',
  ]

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
            Choose CSV Files
          </label>
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
        </article>

        <article className="panel preview-panel">
          <h2>Session Data Preview</h2>
          <p className="empty-message">
            No data loaded yet. After upload, rows and metrics will appear here.
          </p>
        </article>
      </section>
    </main>
  )
}

export default App
