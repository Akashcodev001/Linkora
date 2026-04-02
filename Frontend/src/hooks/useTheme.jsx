import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'linkora-theme'
const ThemeContext = createContext(null)

const resolveInitialTheme = () => {
  const persisted = localStorage.getItem(STORAGE_KEY)
  if (persisted === 'light' || persisted === 'dark') {
    return persisted
  }

  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  return systemDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => resolveInitialTheme())

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}

export default useTheme
