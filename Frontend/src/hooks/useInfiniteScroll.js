import { useEffect } from 'react'

/**
 * Observe a sentinel element and trigger callback when visible.
 */
export function useInfiniteScroll(ref, callback) {
  useEffect(() => {
    if (!ref?.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          callback()
        }
      },
      {
        root: null,
        threshold: 0,
      },
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [callback, ref])
}

export default useInfiniteScroll
