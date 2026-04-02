import { useEffect } from 'react'

/**
 * Register a keyboard shortcut listener.
 */
export function useKeyboard(key, callback, options = {}) {
  const { ctrlKey = false, metaKey = false } = options

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== String(key).toLowerCase()) {
        return
      }

      if (Boolean(ctrlKey) !== event.ctrlKey) {
        return
      }

      if (Boolean(metaKey) !== event.metaKey) {
        return
      }

      callback(event)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [callback, ctrlKey, key, metaKey])
}

export default useKeyboard
