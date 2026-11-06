import { Check } from 'lucide-react'
import { ACCENT_OPTIONS } from '@/lib/accent'
import { useAccent } from '@/lib/accent'

export function AccentPreferenceSection() {
  const { accent, setAccent } = useAccent()

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
      <div aria-label='Cor do tema principal' className='flex flex-wrap gap-3'>
        {ACCENT_OPTIONS.map((option) => {
          const selected = accent === option.value
          return (
            <button
              aria-label={option.label}
              aria-pressed={selected}
              className='flex size-9 cursor-pointer items-center justify-center rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              key={option.value}
              onClick={() => setAccent(option.value)}
              style={{ backgroundColor: option.color }}
              title={option.label}
              type='button'
            >
              {selected ? (
                <Check aria-hidden='true' className='size-4 text-black' />
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
