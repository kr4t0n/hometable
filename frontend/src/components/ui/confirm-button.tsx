import * as React from 'react'
import { useEffect, useState } from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'

export interface ConfirmButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Label shown while armed, e.g. "Delete recipe?" */
  confirmLabel?: React.ReactNode
  onConfirm: () => void
}

// Two-step inline confirmation that stays in the page instead of throwing up a
// browser modal: the first click arms the button (it turns destructive and asks
// for confirmation), a second click within 4s confirms. Blur or timeout disarms.
export function ConfirmButton({
  confirmLabel = 'Are you sure?',
  onConfirm,
  children,
  variant = 'outline',
  ...props
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <Button
      {...props}
      variant={armed ? 'destructive' : variant}
      aria-live="polite"
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}
