import { useEffect, useState } from 'react'
import { parseCsvText } from '../lib/csv'
import type { ParsedCsvFile } from '../types/sessionData'

export type BackendSession = {
  id: string
  fileName: string
  size: number
  createdAt: string
  updatedAt: string
}

type UseBackendSessionsOptions = {
  setParseError: (message: string | null) => void
  onFilesImported: (files: ParsedCsvFile[]) => void
}

const configuredApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.trim()

const isLocalRuntime =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')

const defaultBackendApiUrl =
  configuredApiBaseUrl || (isLocalRuntime ? 'http://localhost:4000' : '')

function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function useBackendSessions({
  setParseError,
  onFilesImported,
}: UseBackendSessionsOptions) {
  const [backendApiUrl, setBackendApiUrl] = useState(defaultBackendApiUrl)
  const [backendSessions, setBackendSessions] = useState<BackendSession[]>([])
  const [selectedBackendSessionFileName, setSelectedBackendSessionFileName] =
    useState('')
  const [isLoadingBackendSessions, setIsLoadingBackendSessions] = useState(false)
  const [isImportingBackendSessions, setIsImportingBackendSessions] = useState(false)
  const [backendStatus, setBackendStatus] = useState<string | null>(null)

  const importBackendSessions = async (
    fileNames: string[],
    importLabel: string,
  ): Promise<void> => {
    if (fileNames.length === 0) {
      setParseError('No backend sessions available to import.')
      return
    }

    const apiRoot = normalizeApiBaseUrl(backendApiUrl)
    if (!apiRoot) {
      setParseError('Enter a backend API URL first.')
      return
    }

    setIsImportingBackendSessions(true)
    setParseError(null)
    setBackendStatus(null)

    try {
      const fetchedFiles = await Promise.all(
        fileNames.map(async (fileName) => {
          const response = await fetch(
            `${apiRoot}/api/sessions/${encodeURIComponent(fileName)}`,
          )

          if (!response.ok) {
            throw new Error(`Failed to fetch ${fileName} (${response.status})`)
          }

          const csvText = await response.text()
          return parseCsvText(fileName, csvText)
        }),
      )

      onFilesImported(fetchedFiles)
      setBackendStatus(
        `${importLabel}: loaded ${fetchedFiles.length} file(s) from backend.`,
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to import backend sessions.'
      setParseError(message)
    } finally {
      setIsImportingBackendSessions(false)
    }
  }

  const refreshBackendSessions = async (
    options: { autoLoadLatest?: boolean } = {},
  ): Promise<void> => {
    const { autoLoadLatest = false } = options
    const apiRoot = normalizeApiBaseUrl(backendApiUrl)
    if (!apiRoot) {
      setParseError('Enter a backend API URL first.')
      return
    }

    setIsLoadingBackendSessions(true)
    setParseError(null)
    setBackendStatus(null)

    try {
      const response = await fetch(`${apiRoot}/api/sessions`)
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}.`)
      }

      const payload = (await response.json()) as {
        sessions?: BackendSession[]
      }

      const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
      setBackendSessions(sessions)

      if (sessions.length > 0) {
        setSelectedBackendSessionFileName(sessions[0].fileName)

        if (autoLoadLatest) {
          await importBackendSessions(
            [sessions[0].fileName],
            'Startup auto-load',
          )
          return
        }
      } else {
        setSelectedBackendSessionFileName('')
      }

      setBackendStatus(`Found ${sessions.length} session file(s) on backend.`)
    } catch (error) {
      setBackendSessions([])
      setSelectedBackendSessionFileName('')
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load backend sessions.'
      setParseError(`Backend fetch failed. ${message}`)
    } finally {
      setIsLoadingBackendSessions(false)
    }
  }

  useEffect(() => {
    if (!defaultBackendApiUrl) {
      setBackendStatus(
        'Set your backend URL, then click Refresh to load sessions.',
      )
      return
    }

    void refreshBackendSessions({ autoLoadLatest: true })
  }, [])

  return {
    backendApiUrl,
    setBackendApiUrl,
    backendSessions,
    selectedBackendSessionFileName,
    setSelectedBackendSessionFileName,
    isLoadingBackendSessions,
    isImportingBackendSessions,
    backendStatus,
    refreshBackendSessions,
    importBackendSessions,
  }
}
