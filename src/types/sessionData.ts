export type CsvRow = Record<string, string>

export interface ParsedCsvFile {
  fileName: string
  headers: string[]
  rows: CsvRow[]
  warnings: string[]
}

export const expectedColumns = [
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
