import api from '../axios-api'
import { API_ENDPOINTS } from '../api-endpoints'
import type { IResponse } from '../types'

export interface FileView {
  url: string
  expiresAt: string
  contentType: string
}

/**
 * Opens a private file: a 5-minute signed link, logged with the reason.
 * Deliberately not a React Query query, so the link is never cached.
 */
export async function openFile(ref: string, reason: string, target?: { type: string; id: string }) {
  const { data } = await api.get<IResponse<FileView>>(API_ENDPOINTS.FILE_VIEW, {
    params: { ref, reason, targetType: target?.type, targetId: target?.id },
  })
  return data.data
}
