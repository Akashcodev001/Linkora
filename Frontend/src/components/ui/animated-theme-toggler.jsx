import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme.jsx'
import { cn } from '@/lib/cn'

export function AnimatedThemeToggler({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'focus-ring relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-bg-surface p-1 shadow-subtle transition-colors duration-200',
        className,
      )}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: isDark ? 28 : 0, opacity: isDark ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="pointer-events-none absolute inset-y-2 left-1 h-5 w-9 rounded-full bg-[radial-gradient(circle_at_left,rgba(251,146,60,0.42),rgba(251,146,60,0.08)_62%,transparent_85%)] blur-[2px]"
      />

      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: isDark ? 28 : 0, rotate: isDark ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 560, damping: 38, mass: 0.7 }}
        className="absolute inset-y-1 left-1 grid h-7 w-7 place-items-center rounded-full bg-brand shadow-card"
      />

      <span className="relative z-10 inline-flex w-full items-center justify-between px-1 text-text-secondary">
        <motion.span
          initial={false}
          animate={{ opacity: isDark ? 0.45 : 1, scale: isDark ? 0.9 : 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Sun size={14} />
        </motion.span>
        <motion.span
          initial={false}
          animate={{ opacity: isDark ? 1 : 0.45, scale: isDark ? 1 : 0.9 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Moon size={14} />
        </motion.span>
      </span>
    </motion.button>
  )
}

export default AnimatedThemeToggler
