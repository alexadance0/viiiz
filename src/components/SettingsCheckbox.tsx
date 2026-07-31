import { Checkbox } from '@heroui/react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  isSelected: boolean
  isDisabled?: boolean
  className?: string
  ariaLabel?: string
  onChange(isSelected: boolean): void
}

export function SettingsCheckbox({ children, isSelected, isDisabled, className = '', ariaLabel, onChange }: Props) {
  return <Checkbox
    aria-label={ariaLabel}
    className={`settings-checkbox ${className}`.trim()}
    isSelected={isSelected}
    isDisabled={isDisabled}
    onChange={onChange}
  >
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      {children}
    </Checkbox.Content>
  </Checkbox>
}
