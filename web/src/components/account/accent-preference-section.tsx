import { Check } from 'lucide-react'
import { type MouseEvent, useCallback } from 'react'
import { ACCENT_OPTIONS, useAccent } from '@/lib/accent'

export function AccentPreferenceSection() {
  const { accent, setAccent } = useAccent()
  const selectAccent = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const option = ACCENT_OPTIONS.find(
        ({ value }) => value === event.currentTarget.value
      )
      if (option) setAccent(option.value)
    },
    [setAccent]
  )

  return (
    <section aria-labelledby='accent-title' className='space-y-4'>
      <div>
        <h2
          className='font-bold font-mono text-sm uppercase tracking-wide'
          id='accent-title'
        >
          Tema principal
        </h2>
        <p className='mt-1 text-muted-foreground text-xs'>
          Escolha a cor de destaque usada no aplicativo.
        </p>
      </div>
      <fieldset className='flex flex-wrap gap-3'>
        <legend className='sr-only'>Cor do tema principal</legend>
        {ACCENT_OPTIONS.map((option) => {
          const selected = accent === option.value
          return (
            <button
              aria-label={option.label}
              aria-pressed={selected}
              className='flex size-9 cursor-pointer items-center justify-center rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              key={option.value}
              onClick={selectAccent}
              style={{ backgroundColor: option.color }}
              title={option.label}
              type='button'
              value={option.value}
            >
              {selected ? (
                <Check aria-hidden='true' className='size-4 text-black' />
              ) : null}
            </button>
          )
        })}
      </fieldset>
    </section>
  )
}
