import type { ReactNode } from 'react'

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
const LINK_PATTERN = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/
const FENCE_PATTERN = /^```/
const LIST_ITEM_PATTERN = /^(?:[-*]|\d+\.)\s+(.+)$/
const NUMBERED_LIST_PATTERN = /^\d+\./
const HEADING_SIZES = [
  'text-xl',
  'text-lg',
  'text-base',
  'text-sm',
  'text-xs',
  'text-xs',
]

type MarkdownBlock =
  | { kind: 'code'; content: string }
  | { kind: 'heading'; level: number; content: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'paragraph'; content: string }

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    const key = `${index}-${part}`
    const link = LINK_PATTERN.exec(part)
    if (link) {
      return (
        <a
          className='text-primary underline underline-offset-2'
          href={link[2]}
          key={key}
          rel='noopener noreferrer'
          target='_blank'
        >
          {link[1]}
        </a>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code className='rounded bg-muted px-1' key={key}>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function parseList(lines: string[], start: number) {
  const ordered = NUMBERED_LIST_PATTERN.test(lines[start])
  const items: string[] = []
  let index = start
  while (index < lines.length) {
    const item = LIST_ITEM_PATTERN.exec(lines[index])
    if (!item || NUMBERED_LIST_PATTERN.test(lines[index]) !== ordered) break
    items.push(item[1])
    index += 1
  }
  return { block: { items, kind: 'list', ordered } as const, next: index }
}

function startsBlock(line: string) {
  return (
    FENCE_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    LIST_ITEM_PATTERN.test(line)
  )
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (FENCE_PATTERN.test(line)) {
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !FENCE_PATTERN.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({
        content: codeLines.join('\n'),
        kind: 'code',
      })
      continue
    }

    const heading = HEADING_PATTERN.exec(line)
    if (heading) {
      blocks.push({
        content: heading[2],
        kind: 'heading',
        level: heading[1].length,
      })
      index += 1
      continue
    }

    if (LIST_ITEM_PATTERN.test(line)) {
      const result = parseList(lines, index)
      blocks.push(result.block)
      index = result.next
      continue
    }

    const paragraph = [line]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !startsBlock(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ content: paragraph.join('\n'), kind: 'paragraph' })
  }

  return blocks
}

function renderHeading(
  block: Extract<MarkdownBlock, { kind: 'heading' }>,
  key: number
) {
  const level = block.level + 2
  const className = `font-bold ${HEADING_SIZES[block.level - 1]}`
  const content = renderInline(block.content)
  if (level === 3)
    return (
      <h3 className={className} key={key}>
        {content}
      </h3>
    )
  if (level === 4)
    return (
      <h4 className={className} key={key}>
        {content}
      </h4>
    )
  if (level === 5)
    return (
      <h5 className={className} key={key}>
        {content}
      </h5>
    )
  if (level === 6)
    return (
      <h6 className={className} key={key}>
        {content}
      </h6>
    )
  return (
    // biome-ignore lint/a11y/useSemanticElements: ARIA headings preserve Markdown levels beyond HTML h6.
    <div aria-level={level} className={className} key={key} role='heading'>
      {content}
    </div>
  )
}

function renderBlock(block: MarkdownBlock, index: number) {
  if (block.kind === 'heading') return renderHeading(block, index)
  if (block.kind === 'code') {
    return (
      <pre
        className='overflow-x-auto border border-border bg-muted p-3'
        key={index}
      >
        <code>{block.content}</code>
      </pre>
    )
  }
  if (block.kind === 'list') {
    const items = block.items.map((item, itemIndex) => (
      <li key={`${index}-${itemIndex}`}>{renderInline(item)}</li>
    ))
    return block.ordered ? (
      <ol className='space-y-1' key={index}>
        {items}
      </ol>
    ) : (
      <ul className='space-y-1' key={index}>
        {items}
      </ul>
    )
  }
  return (
    <p className='whitespace-pre-wrap' key={index}>
      {renderInline(block.content)}
    </p>
  )
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className='space-y-3 break-words text-sm [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc'>
      {parseMarkdown(content).map(renderBlock)}
    </div>
  )
}
