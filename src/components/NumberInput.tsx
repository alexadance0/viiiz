import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number
  onValueChange(value: number): void
}

export function NumberInput({ value, onValueChange, onBlur, onFocus, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])

  return <input {...props} type="number" value={draft} onFocus={(event) => { focused.current = true; onFocus?.(event) }} onChange={(event) => {
    let next = event.target.value
    if (next === '') { setDraft(''); return }
    next = next.replace(/^(-?)0+(?=\d)/, '$1')
    setDraft(next)
    const parsed = Number(next)
    if (Number.isFinite(parsed)) {
      const minimum = props.min == null ? -Infinity : Number(props.min)
      const maximum = props.max == null ? Infinity : Number(props.max)
      onValueChange(Math.min(maximum, Math.max(minimum, parsed)))
    }
  }} onBlur={(event) => {
    focused.current = false
    const parsed = draft === '' ? Number.NaN : Number(draft)
    if (!Number.isFinite(parsed)) setDraft(String(value))
    else {
      const minimum = props.min == null ? -Infinity : Number(props.min)
      const maximum = props.max == null ? Infinity : Number(props.max)
      const normalized = Math.min(maximum, Math.max(minimum, parsed))
      setDraft(String(normalized)); onValueChange(normalized)
    }
    onBlur?.(event)
  }}/>
}
