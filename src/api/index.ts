import axios from 'axios'

export const shopApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SHOP_API_URL + '/rest',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
})

shopApi.interceptors.request.use((config) => {
  let token = localStorage.getItem('shop-token')
  if (token && !config?.headers?.Authorization) {
    const newConfig = { 
      ...config,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
    config = newConfig
  }
  return config
})

export const facebookApi = axios.create({
  baseURL: `https://graph.facebook.com/v10.0/${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL}/events`,
  headers: { 'Content-Type': 'application/json' }
})

export const indiegoApi = () => {
  return axios.get(
    'https://api.indiegogo.com/1/campaigns/2678205.json?api_token=f4f1cdf2cf4291f6924712134ef1f953762e1821a6878296241392aa5d9f619c'
  )
}
