import Papa, { type ParseResult } from 'papaparse'
import type { ParsedCsvFile } from '../types/sessionData'

const aliasMap: Record<string, string> = {
  timestamp: 'timestamp_utc',
  timestamp_local: 'timestamp_utc',
  completion: 'completion_title',
  completio: 'completion_title',
  completion_status: 'completion_title',
  completion_title_name: 'completion_title',
  distance_e: 'distance',
  distance_m: 'distance',
  avg_speed: 'avg_speed_mps',
  avg_speed_m_s: 'avg_speed_mps',
  pace_s_pe: 'pace_s_per',
  pace_s_per_m: 'pace_s_per',
  on_course: 'on_course_percent',
  on_course_pct: 'on_course_percent',
  on_course_p: 'on_course_percent',
  off_course_percent: 'off_course',
  off_course_pct: 'off_course',
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

  if (key.startsWith('timestamp')) {
    return 'timestamp_utc'
  }

  if (key.startsWith('completion')) {
    return 'completion_title'
  }

  if (key.startsWith('avg_speed')) {
    return 'avg_speed_mps'
  }

  if (key.startsWith('pace_s_per')) {
    return 'pace_s_per'
  }

  if (key.startsWith('on_course')) {
    return 'on_course_percent'
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
  return parseCsvText(file.name, text)
}

export const parseCsvText = (
  fileName: string,
  text: string,
): ParsedCsvFile => {

  const result: ParseResult<Record<string, string>> = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: canonicalizeHeader,
    transform: (value: string) => value.trim(),
  })

  const headers = (result.meta.fields ?? []).filter(Boolean)
  const rows = result.data.filter(
    (row: Record<string, string>) =>
      Object.values(row).some((value: string) => value !== ''),
  )

  const warnings: string[] = []

  if (result.errors.length > 0) {
    warnings.push(`${result.errors.length} row parsing issue(s) detected.`)
  }

  if (rows.length === 0) {
    warnings.push('No data rows found.')
  }

  return {
    fileName,
    headers,
    rows,
    warnings,
  }
}
