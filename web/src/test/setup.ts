import { vi } from 'vitest'

vi.stubEnv('VITE_API_URL', 'http://localhost:8080')
vi.stubGlobal('scrollTo', vi.fn())
