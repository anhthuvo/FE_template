import { useEffect, useState } from 'react'

const useWebp = () => {
  const [webp, setWebp] = useState(true)
  useEffect(() => {
    const elem = document.createElement('canvas')
    if (!!(elem.getContext && elem.getContext('2d'))) {
      // was able or not to get WebP representation
      setWebp(elem.toDataURL('image/webp').indexOf('data:image/webp') == 0)
    } else {
      // very old browser like IE 8, canvas not supported
      setWebp(false)
    }
  }, [])
  return webp
}

export default useWebp
