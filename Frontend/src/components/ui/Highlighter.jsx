import { useEffect, useRef, useState } from 'react'
import { annotate } from 'rough-notation'

const OBSERVER_OPTIONS = {
  root: null,
  rootMargin: '0px 0px -10% 0px',
  threshold: 0.1,
}

export function Highlighter({
  children,
  action = 'highlight',
  color = '#FF9800',
  strokeWidth = 1.5,
  animationDuration = 700,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
  className = '',
}) {
  const elementRef = useRef(null)
  const annotationRef = useRef(null)
  const observerRef = useRef(null)
  const [inView, setInView] = useState(!isView)

  useEffect(() => {
    if (!isView || !elementRef.current) return undefined

    const target = elementRef.current
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        observer.disconnect()
      }
    }, OBSERVER_OPTIONS)

    observer.observe(target)
    observerRef.current = observer

    return () => observer.disconnect()
  }, [isView])

  useEffect(() => {
    const element = elementRef.current
    if (!element || !inView) return undefined

    const annotation = annotate(element, {
      type: action,
      color,
      strokeWidth,
      animationDuration,
      iterations,
      padding,
      multiline,
    })

    annotationRef.current = annotation
    annotation.show()

    const resizeObserver = new ResizeObserver(() => {
      annotation.hide()
      annotation.show()
    })

    resizeObserver.observe(element)

    return () => {
      annotation.remove()
      resizeObserver.disconnect()
    }
  }, [inView, action, color, strokeWidth, animationDuration, iterations, padding, multiline])

  return (
    <span ref={elementRef} className={`relative inline-block bg-transparent ${className}`}>
      {children}
    </span>
  )
}

export default Highlighter
