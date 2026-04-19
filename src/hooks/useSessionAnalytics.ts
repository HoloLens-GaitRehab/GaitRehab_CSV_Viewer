import { buildAnomalyInsights, type DetectorMode } from '../lib/anomaly'
import { expectedColumns, type ParsedCsvFile } from '../types/sessionData'

type PreviewRow = Record<string, string>

type ChartRow = {
  row: string
  speed: number | null
  onCourse: number | null
  offCourse: number | null
  drift: number | null
}

export type MetricKey = 'speed' | 'onCourse' | 'offCourse' | 'drift'

type UseSessionAnalyticsParams = {
  parsedFiles: ParsedCsvFile[]
  selectedFileName: string
  startRowInput: string
  endRowInput: string
  selectedMetric: MetricKey
  detectorMode: DetectorMode
  anomalySensitivity: number
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

function getMetricValue(row: ChartRow, metric: MetricKey): number | null {
  return row[metric]
}

export const metricOptions: { key: MetricKey; label: string }[] = [
  { key: 'speed', label: 'Speed' },
  { key: 'onCourse', label: 'On Course %' },
  { key: 'offCourse', label: 'Off Course %' },
  { key: 'drift', label: 'Drift' },
]

export function useSessionAnalytics({
  parsedFiles,
  selectedFileName,
  startRowInput,
  endRowInput,
  selectedMetric,
  detectorMode,
  anomalySensitivity,
}: UseSessionAnalyticsParams) {
  const fileOptions = ['all', ...parsedFiles.map((file) => file.fileName)]

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

  const anomalyInsights = buildAnomalyInsights(rowsInRange, startRow, {
    mode: detectorMode,
    sensitivity: anomalySensitivity,
  })
  const previewRows = rowsInRange.slice(0, 40)
  const previewAnomalies = anomalyInsights.slice(0, 40)

  let detectorModeLabel = 'Hybrid (Z-Score + K-Means)'
  if (detectorMode === 'kmeans') {
    detectorModeLabel = 'K-Means only'
  }
  if (detectorMode === 'zscore') {
    detectorModeLabel = 'Z-Score only'
  }

  let highRiskCount = 0
  let mediumRiskCount = 0
  let anomalyScoreTotal = 0
  for (const insight of anomalyInsights) {
    anomalyScoreTotal += insight.score

    if (insight.risk === 'High') {
      highRiskCount += 1
    }

    if (insight.risk === 'Medium') {
      mediumRiskCount += 1
    }
  }

  const averageAnomalyScore =
    anomalyInsights.length > 0 ? anomalyScoreTotal / anomalyInsights.length : 0

  const topAnomalies = [...anomalyInsights]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

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

  let mainChartMetric: MetricKey = 'speed'
  let mainChartTitle = 'Average Speed (first 40 rows)'
  let mainChartColor = '#cc5c1f'

  if (selectedMetric === 'onCourse') {
    mainChartMetric = 'onCourse'
    mainChartTitle = 'On Course % (first 40 rows)'
    mainChartColor = '#2f8f55'
  }

  if (selectedMetric === 'offCourse') {
    mainChartMetric = 'offCourse'
    mainChartTitle = 'Off Course % (first 40 rows)'
    mainChartColor = '#d57b57'
  }

  if (selectedMetric === 'drift') {
    mainChartMetric = 'drift'
    mainChartTitle = 'Drift (first 40 rows)'
    mainChartColor = '#6a6ad2'
  }

  const hasMainChartData = chartData.some(
    (row) => getMetricValue(row, mainChartMetric) !== null,
  )

  return {
    fileOptions,
    totalRows,
    allHeadersCount: allHeaders.length,
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
  }
}
