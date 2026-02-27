import React from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'

import { Button as ShadButton } from '../../../components/ui/button'
import { Card as ShadCard, CardContent as ShadCardContent } from '../../../components/ui/card'
import { Badge as ShadBadge } from '../../../components/ui/badge'

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  )
}

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  icon: Icon,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  icon?: any
  key?: React.Key
}) => {
  const mapVariant = (v: string): any => {
    switch (v) {
      case 'primary':
        return 'default'
      case 'secondary':
        return 'default'
      case 'outline':
        return 'outline'
      case 'ghost':
        return 'ghost'
      case 'danger':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <ShadButton
      variant={mapVariant(variant)}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {Icon && <Icon size={18} />}
      {children}
    </ShadButton>
  )
}

export const Card = ({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  key?: React.Key
}) => (
  <ShadCard id={id} className={className}>
    <ShadCardContent className="p-5">{children}</ShadCardContent>
  </ShadCard>
)

export const Badge = ({
  children,
  color = 'slate',
}: {
  children: React.ReactNode
  color?: string
}) => {
  const variant = (() => {
    if (color === 'indigo') return 'default'
    if (color === 'emerald') return 'secondary'
    if (color === 'amber') return 'secondary'
    if (color === 'rose') return 'destructive'
    return 'outline'
  })()

  return <ShadBadge variant={variant as any}>{children}</ShadBadge>
}
