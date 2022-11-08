import React, { createContext, useState, useContext, useEffect } from 'react'
import get from 'lodash/fp/get'
import debounce from 'lodash/fp/debounce'

import { shopApi } from '../api'

const TOKEN_USER = 'shop-token'
const AuthContext = createContext({})
interface UserInfor {
  email: string,
  firstname: string,
  lastname: string,
  password: string,
  isSubscribed: boolean
}

const AuthStore = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)

  const loadUserFromCookies = async () => {
    try {
      const token = localStorage.getItem(TOKEN_USER)
      if (token) {
        const { data: user } = await shopApi.get(
          `/${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customers/me`
        )
        if (user) {
          setUser(user)
        } else {
          localStorage.removeItem(TOKEN_USER)
        }
      }
    } catch (err: any) {
      console.log(err?.response)
      localStorage.removeItem(TOKEN_USER)
      setUser(null)
      delete shopApi.defaults.headers.common.Authorization
    } finally {
      setLoading(false)
    }
  }

  const checkEmail = async (email: string) => {
    try {
      const { data } = await shopApi.post(
        `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customers/isEmailAvailable`,
        {
          customerEmail: email
        }
      )
      return data
    } catch (ex) {
      console.log(ex)
      return null
    }
  }

  const signup = async ({
    email,
    firstname,
    lastname,
    password,
    isSubscribed = false
  }: UserInfor) => {
    try {
      const { data } = await shopApi.post(
        `/${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customers`,
        {
          customer: {
            email: email,
            firstname: firstname,
            lastname: lastname,
            store_id: process.env.NEXT_PUBLIC_STORE_ID,
            extension_attributes: {
              is_subscribed: isSubscribed
            }
          },
          password: password
        }
      )
      return data
    } catch (err) {
      let message = get('response.data.message', err)
      if (
        message.toLowerCase().includes('%1') &&
        message.toLowerCase().includes('characters')
      ) {
        message =
          'Password must contain at least 8 characters, one uppercase, one lowercase, one number'
      }

      setError(message)
      return null
    }
  }

  const login = async ({ email, password }: { email: string, password: string}) => {
    const { data: token } = await shopApi.post(
      `/${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/integration/customer/token`,
      {
        username: email,
        password: password
      }
    )
    if (token) {
      localStorage.setItem(TOKEN_USER, token)
      const { data: user } = await shopApi.get(
        `/${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customers/me`
      )
      setUser(user)
      return token
    }
  }

  const logout = async () => {
    // client.clearStore();
    localStorage.removeItem(TOKEN_USER)
    setUser(null)
    delete shopApi.defaults.headers.common.Authorization
  }

  const clearError = debounce(500, () => {
    setError(false)
  })

  useEffect(() => {
    loadUserFromCookies()
  }, [])

  useEffect(() => {
    if (error) {
      window.addEventListener('click', clearError)
      return function cleanup() {
        window.removeEventListener('click', clearError)
      }
    }
  }, [error])

  return (
    <AuthContext.Provider
      value={{
        error,
        isAuthenticated: !!user,
        user,
        signup,
        login,
        loading,
        logout,
        loadUserFromCookies,
        checkEmail,
        forgotPassword,
        setForgotPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export default AuthStore
