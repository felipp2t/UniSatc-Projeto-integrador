import { z } from 'zod'

const envSchema = z.object({
  apiUrl: z
    .url('VITE_API_URL deve ser uma URL válida')
    .min(1, 'VITE_API_URL é obrigatória')
    .refine(
      (value) => value.startsWith('http://') || value.startsWith('https://'),
      'VITE_API_URL deve usar http:// ou https://'
    ),
  websocketUrl: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z
      .url('VITE_WS_URL deve ser uma URL válida')
      .refine(
        (value) => value.startsWith('ws://') || value.startsWith('wss://'),
        'VITE_WS_URL deve usar ws:// ou wss://'
      )
      .optional()
  ),
})

const _env = envSchema.safeParse({
  apiUrl: import.meta.env.VITE_API_URL,
  websocketUrl: import.meta.env.VITE_WS_URL,
})

if (!_env.success) {
  const details = _env.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'configuração'}: ${issue.message}`
    )
    .join('; ')

  throw new Error(`Configuração de ambiente inválida: ${details}`)
}

export type Env = z.infer<typeof envSchema>

export const env: Env = _env.data
