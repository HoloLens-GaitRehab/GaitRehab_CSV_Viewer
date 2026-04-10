import Papa from 'papaparse'
import type { ParsedCsvFile } from '../types/sessionData'

const aliasMap: Record<string, string> = {
  completio: 'completion',
  completion_status: 'completion',
  distance_e: 'distance',
  distance_m: 'distance',
  pace_s_pe: 'pace_s_per',
  pace_s_per_m: 'pace_s_per',
  off_course_pct: 'off_course',
  off_course_p: 'off_course',
  off_course_t: 'off_course_drift',
  drift_avg_r: 'drift_avg',
  drift_max_: 'drift_max',
  app_versi: 'app_version',
  app_versio: 'app_version',
  unity_vers: 'unity_version',
}

const toKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

export const canonicalizeHeader = (header: string): string => {
  const key = toKey(header)

  if (aliasMap[key]) {
    return aliasMap[key]
  }

  if (key.startsWith('distance')) {
    return 'distance'
  }

  if (key.startsWith('pace_s_per')) {
    return 'pace_s_per'
  }

  if (key.startsWith('off_course_drift')) {
    return 'off_course_drift'
  }

  if (key.startsWith('off_course')) {
    return 'off_course'
  }

  if (key.startsWith('drift_avg')) {
    return 'drift_avg'
  }

  if (key.startsWith('drift_max')) {
    return 'drift_max'
  }

  return key
}

export const parseCsvFile = async (file: File): Promise<ParsedCsvFile> => {
  const text = await file.text()

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: canonicalizeHeader,
    transform: (value) => value.trim(),
  })

  const headers = (result.meta.fields ?? []).filter(Boolean)
  const rows = result.data.filter(
    (row) => Object.values(row).some((value) => value !== ''),
  )

  const warnings: string[] = []

  if (result.errors.length > 0) {
    warnings.push(`${result.errors.length} row parsing issue(s) detected.`)
  }

  if (rows.length === 0) {
    warnings.push('No data rows found.')
  }

  return {
    fileName: file.name,
    headers,
    rows,
    warnings,
  }
}
