type CsvRow = Record<string, string>

//risk labels shown in the UI after scoring
export type RiskLabel = 'Low' | 'Medium' | 'High'
//detector modes the user can pick from
export type DetectorMode = 'zscore' | 'kmeans' | 'hybrid'

//final shape of one analyzed row that gets rendered in the table and top anomaly list
export interface RowAnomalyInsight {
  rowNumber: number
  score: number
  risk: RiskLabel
  reasons: string[]
}

//runtime options that control how scoring is calculated
export interface AnomalyOptions {
  mode: DetectorMode
  sensitivity: number
}

//feature definition mapping one logical metric to possible csv keys
type FeatureConfig = {
  name: string
  label: string
  keys: string[]
}

//stat summary for each feature after scanning all rows
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

//small helper alias for clustering vectors
type Vector = number[]

//fallback options used when caller passes partial or empty config
const defaultOptions: AnomalyOptions = {
  mode: 'hybrid',
  sensitivity: 55,
}

//the feature list is the heart of detection since every metric downstream is derived from this mapping
//if a dataset uses different column names we can extend keys here without touching the scoring pipeline
const featureConfigs: FeatureConfig[] = [
  { name: 'speed', label: 'Average Speed', keys: ['avg_speed_mps', 'avg_speed'] },
  { name: 'onCourse', label: 'On Course %', keys: ['on_course_percent', 'on_course'] },
  { name: 'offCourse', label: 'Off Course %', keys: ['off_course'] },
  { name: 'drift', label: 'Drift', keys: ['drift_max', 'drift_avg'] },
  { name: 'elapsed', label: 'Elapsed Time', keys: ['elapsed_s'] },
]

//generic clamp helper to keep values inside safe limits
function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue
  }

  if (value > maxValue) {
    return maxValue
  }

  return value
}

//merges caller options with defaults and constrains sensitivity so tuning never breaks thresholds
function resolveOptions(options?: Partial<AnomalyOptions>): AnomalyOptions {
  return {
    mode: options?.mode ?? defaultOptions.mode,
    sensitivity: clamp(options?.sensitivity ?? defaultOptions.sensitivity, 20, 90),
  }
}

//finds one feature config by internal name so later loops can resolve key aliases quickly
function findFeatureConfig(name: string): FeatureConfig | null {
  for (const item of featureConfigs) {
    if (item.name === name) {
      return item
    }
  }

  return null
}

//reads the first usable numeric value from a list of possible keys
//this keeps parsing resilient when csv headers vary across exports
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

//standard arithmetic mean helper
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

//standard deviation helper used to convert features onto a common scale
//important because speed drift and percentages have very different raw magnitudes
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

  //prevent divide by zero when values are almost identical
  return std < 0.0001 ? 1 : std
}

//builds stats per feature from the selected row range
//this stage is where the model learns what normal looks like for the active dataset slice
//later z score and vector normalization both depend on these means and std values
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

//euclidean distance helper used by kmeans assignment and final distance scoring
function getDistance(a: Vector, b: Vector): number {
  let total = 0

  for (let index = 0; index < a.length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    total += diff * diff
  }

  return Math.sqrt(total)
}

//normalizes any score list to 0 to 100 for easier UI comparison and thresholding
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

//converts each row into a normalized feature vector
//each value becomes a z-like normalized component around the feature mean
//this creates a common coordinate space so clustering can compare mixed metrics fairly
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
        //missing values become zero which means near feature mean after normalization
        vector.push(0)
        continue
      }

      vector.push((value - feature.mean) / feature.std)
    }

    vectors.push(vector)
  }

  return vectors
}

//small kmeans implementation used as an unsupervised anomaly signal
//steps are seed centroids assign rows recompute centers repeat fixed iterations
//final score is distance to assigned centroid then scaled to 0 to 100
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

//maps numeric anomaly score into Low Medium High with sensitivity aware thresholds
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

//main pipeline entry used by dashboard components
//flow is resolve options build feature stats build vectors optionally run kmeans
//then per row compute z based signal combine with kmeans depending on mode build reasons and assign risk
//output is ready for table rendering chart overlays and top anomaly summary cards
export function buildAnomalyInsights(
  rows: CsvRow[],
  startRowNumber: number,
  options?: Partial<AnomalyOptions>,
): RowAnomalyInsight[] {
  const nextOptions = resolveOptions(options)
  const stats = buildStats(rows)
  const insights: RowAnomalyInsight[] = []
  const vectors = buildVectors(rows, stats)
  //run kmeans only when needed to keep zscore only mode lightweight
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

    //mode switch lets us compare detector behavior during viva and experiments
    let score = zScoreValue
    if (nextOptions.mode === 'kmeans') {
      score = kmeansScore
    }

    if (nextOptions.mode === 'hybrid') {
      score = Number((zScoreValue * 0.45 + kmeansScore * 0.55).toFixed(1))
    }

    //reason text is intentionally simple so non technical readers can interpret alerts quickly
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
