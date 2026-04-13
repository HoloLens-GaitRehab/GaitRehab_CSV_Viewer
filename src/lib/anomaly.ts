type CsvRow = Record<string, string>

export type RiskLabel = 'Low' | 'Medium' | 'High'

export interface RowAnomalyInsight {
  rowNumber: number
  score: number
  risk: RiskLabel
  reasons: string[]
}

type FeatureConfig = {
  name: string
  label: string
  keys: string[]
}

type FeatureStats = {
  name: string
  label: string
  mean: number
  std: number
}

type FeatureZScore = {
  label: string
  z: number
}

const featureConfigs: FeatureConfig[] = [
  { name: 'speed', label: 'Average Speed', keys: ['avg_speed_mps', 'avg_speed'] },
  { name: 'onCourse', label: 'On Course %', keys: ['on_course_percent', 'on_course'] },
  { name: 'offCourse', label: 'Off Course %', keys: ['off_course'] },
  { name: 'drift', label: 'Drift', keys: ['drift_max', 'drift_avg'] },
  { name: 'elapsed', label: 'Elapsed Time', keys: ['elapsed_s'] },
]

function getNumber(row: CsvRow, keys: string[]): number | null {
  for (const key of keys) {
    const rawValue = row[key]
    if (!rawValue) {
      continue
    }

    const value = Number.parseFloat(rawValue)
    if (!Number.isNaN(value)) {
      return value
    }
  }

  return null
}

function getMean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  let total = 0
  for (const value of values) {
    total += value
  }

  return total / values.length
}

function getStd(values: number[], mean: number): number {
  if (values.length <= 1) {
    return 1
  }

  let totalSquaredDistance = 0
  for (const value of values) {
    const diff = value - mean
    totalSquaredDistance += diff * diff
  }

  const variance = totalSquaredDistance / values.length
  const std = Math.sqrt(variance)

  // Prevent divide-by-zero when data points are all very similar.
  return std < 0.0001 ? 1 : std
}

function buildStats(rows: CsvRow[]): FeatureStats[] {
  const stats: FeatureStats[] = []

  for (const feature of featureConfigs) {
    const values: number[] = []

    for (const row of rows) {
      const value = getNumber(row, feature.keys)
      if (value !== null) {
        values.push(value)
      }
    }

    if (values.length === 0) {
      continue
    }

    const mean = getMean(values)
    const std = getStd(values, mean)

    stats.push({
      name: feature.name,
      label: feature.label,
      mean,
      std,
    })
  }

  return stats
}

function scoreToRisk(score: number): RiskLabel {
  if (score >= 70) {
    return 'High'
  }

  if (score >= 45) {
    return 'Medium'
  }

  return 'Low'
}

export function buildAnomalyInsights(
  rows: CsvRow[],
  startRowNumber: number,
): RowAnomalyInsight[] {
  const stats = buildStats(rows)
  const insights: RowAnomalyInsight[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const zScores: FeatureZScore[] = []

    for (const feature of stats) {
      const config = featureConfigs.find((item) => item.name === feature.name)
      if (!config) {
        continue
      }

      const value = getNumber(row, config.keys)
      if (value === null) {
        continue
      }

      const z = Math.abs((value - feature.mean) / feature.std)
      zScores.push({ label: feature.label, z })
    }

    if (zScores.length === 0) {
      insights.push({
        rowNumber: startRowNumber + index,
        score: 0,
        risk: 'Low',
        reasons: ['Not enough data in this row'],
      })
      continue
    }

    let zTotal = 0
    for (const item of zScores) {
      zTotal += item.z
    }

    const averageZ = zTotal / zScores.length
    const score = Math.min(100, Number((averageZ * 30).toFixed(1)))

    const sorted = [...zScores].sort((a, b) => b.z - a.z)
    const reasons = sorted.slice(0, 2).map((item) => `${item.label} is unusual`)

    insights.push({
      rowNumber: startRowNumber + index,
      score,
      risk: scoreToRisk(score),
      reasons,
    })
  }

  return insights
}
