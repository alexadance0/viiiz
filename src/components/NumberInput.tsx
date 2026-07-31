import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number
  onValueChange(value: number): void
}

interface OptionalNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: number | null
  onValueChange(value: number | null): void
}

export const clampNumber = (value: number, min?: number | string, max?: number | string) => {
  const minimum = min == null ? -Infinity : Number(min)
  const maximum = max == null ? Infinity : Number(max)
  return Math.min(maximum, Math.max(minimum, value))
}

export const normalizeNumberDraft = (draft: string) => {
  if (draft === '') return null
  const normalized = draft.replace(/^(-?)0+(?=\d)/, '$1')
  const value = Number(normalized)
  return Number.isFinite(value) ? { draft: normalized, value } : null
}

export function NumberInput({ value, onValueChange, onBlur, onFocus, ...props }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])

  return <input {...props} type="number" value={draft} onFocus={(event) => { focused.current = true; onFocus?.(event) }} onChange={(event) => {
    const next = normalizeNumberDraft(event.target.value)
    if (!next) { setDraft(event.target.value); return }
    setDraft(next.draft)
    onValueChange(clampNumber(next.value, props.min, props.max))
  }} onBlur={(event) => {
    focused.current = false
    const next = normalizeNumberDraft(draft)
    if (!next) setDraft(String(value))
    else {
      const normalized = clampNumber(next.value, props.min, props.max)
      setDraft(String(normalized)); onValueChange(normalized)
    }
    onBlur?.(event)
  }}/>
}

export function OptionalNumberInput({ value, onValueChange, onBlur, onFocus, placeholder = 'Авто', ...props }: OptionalNumberInputProps) {
  const externalDraft = value == null || !Number.isFinite(value) ? '' : String(value)
  const [draft, setDraft] = useState(externalDraft)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(externalDraft)
  }, [externalDraft])

  return <input {...props} type="number" value={draft} placeholder={placeholder} onFocus={(event) => { focused.current = true; onFocus?.(event) }} onChange={(event) => {
    const nextDraft = event.target.value
    if (nextDraft === '') { setDraft(''); onValueChange(null); return }
    const next = normalizeNumberDraft(nextDraft)
    if (!next) { setDraft(nextDraft); return }
    setDraft(next.draft)
    onValueChange(clampNumber(next.value, props.min, props.max))
  }} onBlur={(event) => {
    focused.current = false
    const next = normalizeNumberDraft(draft)
    if (!next) setDraft(externalDraft)
    else {
      const normalized = clampNumber(next.value, props.min, props.max)
      setDraft(String(normalized)); onValueChange(normalized)
    }
    onBlur?.(event)
  }}/>
}
