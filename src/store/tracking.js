import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react'
import { shopApi, facebookApi } from '../api'
import { useLocalStorage } from '../../utils'

const TrackingContext = createContext({})

const TrackingStore = ({ children }) => {
  const [location, setLocation] = useLocalStorage('location')
  const tracking = useCallback(
    ({ type, fbData = {}, ggData = {} }) => {
      console.log(`${type} Tracking`)
      console.log(`fb data`, fbData)
      console.log(`gg data`, ggData)
      if (window.fbq) {
        window.fbq('track', type, {
          ...fbData
        })
        if (process.env.NEXT_PUBLIC_FACEBOOK_CONVERSION) {
          facebookApi.post(
            '',
            {
              data: [
                {
                  event_name: type,
                  event_time: Math.floor(Date.now() / 1000),
                  action_source: 'website',
                  user_data: {
                    client_ip_address: location.ip,
                    client_user_agent: 'UA'
                  },
                  custom_data: {
                    ...fbData
                  }
                }
              ]
            },
            {
              params: {
                access_token: process.env.NEXT_PUBLIC_FACEBOOK_CONVERSION
              }
            }
          )
        }
      }
      if (window.gtag) {
        window.gtag('event', type, {
          ...ggData
        })
        if (process.env.NEXT_PUBLIC_GOOGLE_CONVERSION) {
          window.gtag('event', 'conversion', {
            send_to: process.env.NEXT_PUBLIC_GOOGLE_CONVERSION,
            ...ggData
          })
        }
      }
    },
    [location]
  )

  useEffect(() => {
    if (!location) {
      fetch('https://ip.nf/me.json', { method: 'get' })
        .then((response) => response.json())
        .then((data) => {
          setLocation({ ...data.ip })
        })
    }
  }, [location])
  return (
    <TrackingContext.Provider value={{ tracking }}>
      {children}
    </TrackingContext.Provider>
  )
}

export const useTracking = () => useContext(TrackingContext)

export default TrackingStore
