import { useCallback, useEffect, useRef, useState } from 'react'
import type { UploadOptions } from '@/api/endpoints'

export function useAttachmentUpload() {
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<number>()

  useEffect(() => () => controller.current?.abort(), [])

  const upload = useCallback(
    async <T>(send: (options: UploadOptions) => Promise<T>) => {
      controller.current?.abort()
      const abortController = new AbortController()
      controller.current = abortController
      setProgress(undefined)
      try {
        return await send({
          onUploadProgress: (value) => {
            if (controller.current === abortController) setProgress(value)
          },
          signal: abortController.signal,
        })
      } finally {
        if (controller.current === abortController) {
          controller.current = null
          setProgress(undefined)
        }
      }
    },
    []
  )

  const cancel = useCallback(() => controller.current?.abort(), [])

  return { cancel, progress, upload }
}
