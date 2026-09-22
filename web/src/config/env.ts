import { z } from 'zod'

const apiUrlSchema = z
  .string()
  .min(1, 'VITE_API_URL é obrigatória')
  .url('VITE_API_URL deve ser uma URL válida')
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    'VITE_API_URL deve usar http:// ou https://'
  )

const websocketUrlSchema = z
  .string()
  .url('VITE_WS_URL deve ser uma URL válida')
  .refine(
    (value) => value.startsWith('ws://') || value.startsWith('wss://'),
    'VITE_WS_URL deve usar ws:// ou wss://'
  )

const envSchema = z.object({
  apiUrl: apiUrlSchema,
  websocketUrl: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    websocketUrlSchema.optional()
  ),
})

const parsedEnv = envSchema.safeParse({
  apiUrl: import.meta.env.VITE_API_URL,
  websocketUrl: import.meta.env.VITE_WS_URL,
})

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'configuração'}: ${issue.message}`
    )
    .join('; ')

  throw new Error(`Configuração de ambiente inválida: ${details}`)
}

export type AppEnv = z.infer<typeof envSchema>

export const appEnv: AppEnv = parsedEnv.data
