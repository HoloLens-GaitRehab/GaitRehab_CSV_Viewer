type CsvRow = Record<string, string>

export type RiskLabel = 'Low' | 'Medium' | 'High'
export type DetectorMode = 'zscore' | 'kmeans' | 'hybrid'

export interface RowAnomalyInsight {
  rowNumber: number
  score: number
  risk: RiskLabel
  reasons: string[]
}

export interface AnomalyOptions {
  mode: DetectorMode
  sensitivity: number
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

type Vector = number[]

const defaultOptions: AnomalyOptions = {
  mode: 'hybrid',
  sensitivity: 55,
}

const featureConfigs: FeatureConfig[] = [
  { name: 'speed', label: 'Average Speed', keys: ['avg_speed_mps', 'avg_speed'] },
  { name: 'onCourse', label: 'On Course %', keys: ['on_course_percent', 'on_course'] },
  { name: 'offCourse', label: 'Off Course %', keys: ['off_course'] },
  { name: 'drift', label: 'Drift', keys: ['drift_max', 'drift_avg'] },
  { name: 'elapsed', label: 'Elapsed Time', keys: ['elapsed_s'] },
]

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue
  }

  if (value > maxValue) {
    return maxValue
  }

  return value
}

function resolveOptions(options?: Partial<AnomalyOptions>): AnomalyOptions {
  return {
    mode: options?.mode ?? defaultOptions.mode,
    sensitivity: clamp(options?.sensitivity ?? defaultOptions.sensitivity, 20, 90),
  }
}

function findFeatureConfig(name: string): FeatureConfig | null {
  for (const item of featureConfigs) {
    if (item.name === name) {
      return item
    }
  }

  return null
}

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

function getDistance(a: Vector, b: Vector): number {
  let total = 0

  for (let index = 0; index < a.length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    total += diff * diff
  }

  return Math.sqrt(total)
}

function normalizeTo100(values: number[]): number[] {
  if (values.length === 0) {
    return []
  }

  let minValue = values[0]
  let maxValue = values[0]

  for (const value of values) {
    if (value < minValue) {
      minValue = value
    }

    if (value > maxValue) {
      maxValue = value
    }
  }

  const range = maxValue - minValue
  if (range < 0.0001) {
    return values.map(() => 0)
  }

  return values.map((value) => Number((((value - minValue) / range) * 100).toFixed(1)))
}

function buildVectors(rows: CsvRow[], stats: FeatureStats[]): Vector[] {
  const vectors: Vector[] = []

  for (const row of rows) {
    const vector: Vector = []

    for (const feature of stats) {
      const config = findFeatureConfig(feature.name)
      if (!config) {
        vector.push(0)
        continue
      }

      const value = getNumber(row, config.keys)
      if (value === null) {
        // Missing value becomes 0 after normalization (close to feature mean).
        vector.push(0)
        continue
      }

      vector.push((value - feature.mean) / feature.std)
    }

    vectors.push(vector)
  }

  return vectors
}

function getKmeansScores(vectors: Vector[]): number[] {
  if (vectors.length === 0) {
    return []
  }

  const clusterCount = Math.min(3, vectors.length)
  const vectorLength = vectors[0]?.length ?? 0
  const centroids: Vector[] = []

  for (let index = 0; index < clusterCount; index += 1) {
    const sourceIndex = Math.floor((index * vectors.length) / clusterCount)
    centroids.push([...vectors[sourceIndex]])
  }

  const assignments = new Array<number>(vectors.length).fill(0)

  for (let iteration = 0; iteration < 8; iteration += 1) {
    for (let rowIndex = 0; rowIndex < vectors.length; rowIndex += 1) {
      const rowVector = vectors[rowIndex]
      let nearestCluster = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      for (let clusterIndex = 0; clusterIndex < centroids.length; clusterIndex += 1) {
        const distance = getDistance(rowVector, centroids[clusterIndex])
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestCluster = clusterIndex
        }
      }

      assignments[rowIndex] = nearestCluster
    }

    const sums: Vector[] = []
    const counts: number[] = []

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      sums.push(new Array<number>(vectorLength).fill(0))
      counts.push(0)
    }

    for (let rowIndex = 0; rowIndex < vectors.length; rowIndex += 1) {
      const clusterIndex = assignments[rowIndex]
      counts[clusterIndex] += 1

      for (let valueIndex = 0; valueIndex < vectorLength; valueIndex += 1) {
        sums[clusterIndex][valueIndex] += vectors[rowIndex][valueIndex] ?? 0
      }
    }

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      if (counts[clusterIndex] === 0) {
        continue
      }

      for (let valueIndex = 0; valueIndex < vectorLength; valueIndex += 1) {
        centroids[clusterIndex][valueIndex] =
          sums[clusterIndex][valueIndex] / counts[clusterIndex]
      }
    }
  }

  const distances: number[] = []
  for (let rowIndex = 0; rowIndex < vectors.length; rowIndex += 1) {
    const clusterIndex = assignments[rowIndex]
    distances.push(getDistance(vectors[rowIndex], centroids[clusterIndex]))
  }

  return normalizeTo100(distances)
}

function scoreToRisk(score: number, sensitivity: number): RiskLabel {
  const levelShift = (sensitivity - 50) * 0.6
  const mediumThreshold = clamp(45 - levelShift, 25, 65)
  const highThreshold = clamp(70 - levelShift, 45, 90)

  if (score >= highThreshold) {
    return 'High'
  }

  if (score >= mediumThreshold) {
    return 'Medium'
  }

  return 'Low'
}

export function buildAnomalyInsights(
  rows: CsvRow[],
  startRowNumber: number,
  options?: Partial<AnomalyOptions>,
): RowAnomalyInsight[] {
  const nextOptions = resolveOptions(options)
  const stats = buildStats(rows)
  const insights: RowAnomalyInsight[] = []
  const vectors = buildVectors(rows, stats)
  const kmeansScores =
    nextOptions.mode === 'kmeans' || nextOptions.mode === 'hybrid'
      ? getKmeansScores(vectors)
      : []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const zScores: FeatureZScore[] = []

    for (const feature of stats) {
      const config = findFeatureConfig(feature.name)
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

    let zScoreValue = 0
    if (zScores.length > 0) {
      let zTotal = 0
      for (const item of zScores) {
        zTotal += item.z
      }

      const averageZ = zTotal / zScores.length
      zScoreValue = Math.min(100, Number((averageZ * 30).toFixed(1)))
    }

    const kmeansScore = kmeansScores[index] ?? 0

    let score = zScoreValue
    if (nextOptions.mode === 'kmeans') {
      score = kmeansScore
    }

    if (nextOptions.mode === 'hybrid') {
      score = Number((zScoreValue * 0.45 + kmeansScore * 0.55).toFixed(1))
    }

    const reasons: string[] = []
    if (nextOptions.mode !== 'zscore' && kmeansScore >= 55) {
      reasons.push('Row is far from learned cluster center')
    }

    const sorted = [...zScores].sort((a, b) => b.z - a.z)
    for (const item of sorted.slice(0, 2)) {
      if (item.z >= 1) {
        reasons.push(`${item.label} is unusual`)
      }
    }

    if (reasons.length === 0) {
      reasons.push('No strong anomaly pattern')
    }

    insights.push({
      rowNumber: startRowNumber + index,
      score,
      risk: scoreToRisk(score, nextOptions.sensitivity),
      reasons,
    })
  }

  return insights
}
