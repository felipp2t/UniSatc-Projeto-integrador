import axios from 'axios'

import { env } from '@/config/env'

import { toApiError } from './errors'

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error))
)
