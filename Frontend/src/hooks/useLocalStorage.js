import { useCallback, useEffect, useState } from 'react'

/**
 * Persist state to localStorage.
 */
export function useLocalStorage(key, defaultValue) {
  const readValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue
    }

    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) {
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue
      }
      return JSON.parse(raw)
    } catch {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue
    }
  }, [defaultValue, key])

  const [value, setValue] = useState(readValue)

  useEffect(() => {
    setValue(readValue())
  }, [readValue])

  const updateValue = useCallback(
    (nextValue) => {
      setValue((prev) => {
        const resolvedValue = typeof nextValue === 'function' ? nextValue(prev) : nextValue

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolvedValue))
          } catch {
            // no-op when storage is unavailable
          }
        }

        return resolvedValue
      })
    },
    [key],
  )

  return [value, updateValue]
}

export default useLocalStorage
