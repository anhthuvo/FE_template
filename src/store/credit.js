import React, { createContext, useState, useContext, useEffect } from 'react'
import get from 'lodash/fp/get'
import partition from 'lodash/fp/partition'
import { useAuth } from './auth'
import { useCart } from './cart'
import { useApolloClient, mutations } from '../graphql'
import { shopApi } from '../api'

const TOKEN_USER = 'shop-token'

const CreditContext = createContext({})

const { ApplyCouponToCart, RemoveCouponFromCart } = mutations

const CreditStore = ({ children }) => {
  const client = useApolloClient()
  const { user: authData } = useAuth()
  const { cart, loading: fetchingCart, setCart, resetCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [vouchers, setVouchers] = useState(null)
  const [usedVouchers, setUsedVouchers] = useState(null)
  const [credit, setCredit] = useState(0)
  const [estimatedCredit, setEstimatedCredit] = useState(0)
  const [appliedCredit, setAppliedCredit] = useState(0)
  const [appliedVouchers, setAppliedVouchers] = useState([])
  const [unAppliedVouchers, setUnAppliedVouchers] = useState([])
  const [perks, setPerks] = useState([])
  const [error, setError] = useState('')
  const disableIndiegogo =
    process.env.REACT_APP_DISABLE_INDIEGOGO === 'true' ||
    process.env.NEXT_PUBLIC_DISABLE_INDIEGOGO === 'true'

  const fetchPerks = (email) => {
    const emailEncode = encodeURIComponent(email)
    // const emailEncode = 'takotako89%40gmail.com' // email test
    shopApi
      .get(
        `/${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/backer/${emailEncode}`
      )
      .then(({ data }) => {
        const parsePerks = JSON.parse(data)
        setPerks(parsePerks)
      })
      .catch((er) => {
        console.log(er)
      })
  }

  const fetchCreditVoucher = () => {
    setLoading(true)
    shopApi
      .get(
        `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customers/me/amstorecredit`
      )
      .then(({ data }) => {
        setCredit(get('store_credit', data))
      })
      .finally(() => {
        setLoading(false)
      })
    shopApi
      .post(
        `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/igg/voucher-credit`,
        {
          token: localStorage.getItem(TOKEN_USER)
        }
      )
      .then(({ data }) => {
        setVouchers(get('vouchers', data))
        const usedVouchersResult = get('used_vouchers', data)
        if (usedVouchersResult && usedVouchersResult.length) {
          setPerks([])
          setUsedVouchers(usedVouchersResult)
        } else if (!disableIndiegogo) {
          fetchPerks(authData.email)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const applyCoupon = async (code) => {
    const token = localStorage.getItem(TOKEN_USER)
    const appliedCoupons = get('applied_coupons[0].code', cart)
    const codes = appliedCoupons ? appliedCoupons.split(',') : []
    const found = codes.find((item) => item === code)
    if (found) {
      return true
    }
    setLoading(true)
    try {
      const { data: resCoupon } = await client.mutate({
        mutation: ApplyCouponToCart,
        variables: {
          cartId: cart.id,
          couponCode: codes.concat([code]).join(','),
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        }
      })

      const dataCart = get('applyCouponToCart.cart', resCoupon)
      setCart({
        ...cart,
        ...dataCart
      })

      setLoading(false)
      return dataCart
    } catch (e) {
      console.error(e)
      setLoading(false)
      return false
    }
  }

  const removeCoupon = async () => {
    const token = localStorage.getItem(TOKEN_USER)
    setLoading(true)
    try {
      const { data: resCoupon } = await client.mutate({
        mutation: RemoveCouponFromCart,
        variables: {
          cartId: cart.id,
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        }
      })

      const dataCart = get('removeCouponFromCart.cart', resCoupon)
      setCart({
        ...cart,
        ...dataCart
      })

      setLoading(false)
      return dataCart
    } catch (e) {
      console.error(e)
      setLoading(false)
      return null
    }
  }

  useEffect(() => {
    if (authData) {
      fetchCreditVoucher()
    } else {
      setCredit(null)
      setVouchers(null)
      setUsedVouchers(null)
      setAppliedCredit(0)
      setAppliedVouchers([])
      setUnAppliedVouchers([])
    }
  }, [authData])

  useEffect(() => {
    const discounts = get('prices.discounts', cart) || []
    if (estimatedCredit && credit && (discounts.length || disableIndiegogo)) {
      const amount = Math.min(credit, estimatedCredit)
      setLoading(true)
      shopApi
        .post(
          `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/carts/mine/amstorecredit/apply`,
          {
            amount
          }
        )
        .then(({ data }) => {
          console.log('amstorecredit apply', data)
          resetCart()
          setAppliedCredit(amount)
          setLoading(false)
        })
        .catch((e) => {
          console.error(e)
          setError(
            'Credit/Voucher failed to apply. Refresh the page to try again. Please contact us should the problem persist.'
          )
          setLoading(false)
        })
    } else if (appliedCredit) {
      setLoading(true)
      shopApi
        .post(
          `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/carts/mine/amstorecredit/cancel`
        )
        .then(() => {
          console.log('amstorecredit cancel')
          resetCart()
          setAppliedCredit(0)
          setLoading(false)
        })
        .catch((e) => {
          console.error(e)
          setError(
            'Credit/Voucher failed to apply. Refresh the page to try again. Please contact us should the problem persist.'
          )
          setLoading(false)
        })
    }
  }, [estimatedCredit])

  useEffect(() => {
    if (authData && !fetchingCart) {
      setEstimatedCredit(
        get('prices.subtotal_with_discount_excluding_tax.value', cart) || 0
      )
      if (vouchers) {
        const [applied, unApplied] = partition(({ code }) => {
          const appliedCoupons = get('applied_coupons[0].code', cart)
          const codes = appliedCoupons ? appliedCoupons.split(',') : []
          const found = codes.find((item) => item === code)
          return !!found
        }, vouchers)
        setAppliedVouchers(applied)
        setUnAppliedVouchers(unApplied)
      }
    }
  }, [cart, fetchingCart])

  return (
    <CreditContext.Provider
      value={{
        error,
        loading,
        perks,
        credit,
        vouchers,
        usedVouchers,
        appliedCredit,
        appliedVouchers,
        unAppliedVouchers,
        applyCoupon,
        removeCoupon,
        fetchCreditVoucher
      }}
    >
      {children}
    </CreditContext.Provider>
  )
}

export const useCredit = () => useContext(CreditContext)

export default CreditStore
