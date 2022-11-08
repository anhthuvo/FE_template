import { useEffect, useState } from 'react'

const getWindowDimensions = () => {
  const { innerWidth: width, innerHeight: height } = window
  let device = ''
  if (width < 768) {
    device = 'mobile'
  } else if (width >= 768 && width < 1024) {
    device = 'tablet'
  } else {
    device = 'desktop'
  }
  return {
    width,
    height,
    device
  }
}

const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = useState({})
  useEffect(() => {
    setWindowDimensions(getWindowDimensions())
    const handleResize = () => {
      setWindowDimensions(getWindowDimensions())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return windowDimensions
}

export default useWindowDimensions
