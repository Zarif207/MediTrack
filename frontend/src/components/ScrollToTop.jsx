import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Reset scroll position on navigation (but not for in-page #anchors). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}
