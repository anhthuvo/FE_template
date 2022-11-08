import React, { useReducer, createContext, useContext, useEffect } from 'react'
import get from 'lodash/fp/get'
import { loadStripe } from '@stripe/stripe-js'
import {
  CardElement,
  CardNumberElement,
  CardCvcElement,
  CardExpiryElement,
  Elements,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { useAuth } from './auth'
import { useApolloClient, mutations, queries } from '../graphql'
import { shopApi } from '../api'
import { useLocalStorage } from '../../utils'

const {
  CreateEmptyCart,
  UpdateCartItems,
  RemoveItemFromCart,
  MergeCart,
  SetEmailOnCart,
  SetShippingMethodsOnCart,
  SetShippingAddressesOnCart,
  SetBillingAddressOnCart,
  AddBundleProductsToCart,
  AddConfigurableProductsToCart,
  AddDownloadableProductsToCart,
  AddSimpleProductsToCart,
  AddVirtualProductsToCart
} = mutations
const { CartView, CustomerCartBasic } = queries

const initialState = {
  error: false,
  loading: true,
  items: []
}

const reducer = (state, action) => {
  switch (action.type) {
    case 'setError':
      return { ...state, error: action.payload }
    case 'setLoading':
      return { ...state, loading: action.payload }
    case 'setItems':
      return { ...state, items: action.payload }
    default:
      state
  }
}

const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PK || process.env.NEXT_PUBLIC_STRIPE_PK
)

const CartContext = createContext({})

const TOKEN_USER = 'shop-token'
const CART_USER = 'shop-cart'

const CartStore = ({ children }) => {
  const [cart, setCart] = useLocalStorage(CART_USER, {})
  const { user: authData, loading: fetchingAuth } = useAuth()
  const client = useApolloClient()
  const [state, dispatch] = useReducer(reducer, initialState)

  const fetchGuestCart = async () => {
    await shopApi
      .post(`${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/guest-carts`)
      .then(({ data }) => {
        setCart({ id: data, type: 'guest' })
      })
      .catch((e) => {
        console.error(e)
        setCart({})
      })
      .finally(() => {
        dispatch({
          type: 'setLoading',
          payload: false
        })
      })
  }

  const fetchAuthCart = async () => {
    const {
      data: { cart: cartAuth }
    } = await client.query({
      query: CustomerCartBasic,
      fetchPolicy: 'network-only'
    })
    if (cart.type === 'guest') {
      const token = localStorage.getItem(TOKEN_USER)
      const {
        data: { mergeCarts }
      } = await client.mutate({
        mutation: MergeCart,
        variables: {
          sourceCartId: cart.id,
          destinationCartId: cartAuth.id
        },
        context: {
          headers: {
            Authorization: token ? `Bearer ${token}` : null
          }
        }
      })
      setCart({ ...mergeCarts, type: 'auth' })
    } else {
      await getCart(cartAuth.id)
    }
    dispatch({
      type: 'setLoading',
      payload: false
    })
  }

  const fetchShippingMethod = async (countryId, regionId) => {
    const { data } = await shopApi.post(
      authData
        ? `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/carts/mine/estimate-shipping-methods`
        : `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/guest-carts/${cart.id}/estimate-shipping-methods`,
      {
        address: {
          country_id: countryId,
          region_id: regionId
        }
      }
    )
    return data
  }

  const createEmptyCart = async () => {
    const token = localStorage.getItem(TOKEN_USER)
    const { data } = await client.mutate({
      mutation: CreateEmptyCart,
      context: { headers: { Authorization: token ? `Bearer ${token}` : null } }
    })
    return data
  }

  const getCart = async (cartId) => {
    const token = localStorage.getItem(TOKEN_USER)
    await client
      .query({
        query: CartView,
        variables: { cart_id: cartId || cart.id },
        fetchPolicy: 'network-only',
        context: {
          headers: {
            Authorization: token ? `Bearer ${token}` : null
          }
        }
      })
      .then(({ data }) => {
        setCart({ ...data.cart, type: token ? 'auth' : 'guest' })
      })
      .catch((e) => {
        console.error(e)
        setCart({})
      })
  }

  const getItemByID = (id) => {
    if (cart.items) {
      const itemByID = cart.items.find((item) => item.id === id)
      return itemByID
    }
  }

  const getItems = () => {
    const items = cart.items
    dispatch({
      type: 'setItems',
      payload: items
    })
  }

  const removeItemByID = async (id) => {
    try {
      const token = localStorage.getItem(TOKEN_USER)
      const { data: resRemove } = await client.mutate({
        mutation: RemoveItemFromCart,
        variables: {
          cartId: cart.id,
          cartItemId: Number.parseInt(id)
        },
        context: {
          headers: {
            Authorization: token ? `Bearer ${token}` : null
          }
        }
      })
      const dataCart = get('removeItemFromCart.cart', resRemove)
      setCart({ ...dataCart, type: cart.type })
      return dataCart
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const removeAll = async () => {
    try {
      const token = localStorage.getItem(TOKEN_USER)
      await Promise.all(
        cart.items.length
          ? cart.items.map((item) => {
              client.mutate({
                mutation: RemoveItemFromCart,
                variables: {
                  cartId: cart.id,
                  cartItemId: item.id
                },
                context: {
                  headers: {
                    Authorization: token ? `Bearer ${token}` : null
                  }
                }
              })
            })
          : []
      )
      setCart({ ...cart, items: [] })
      return true
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const updateQuantityItemByID = async (id, quantity) => {
    try {
      const token = localStorage.getItem(TOKEN_USER)
      const { data: resUpdate } = await client.mutate({
        mutation: UpdateCartItems,
        variables: {
          cartId: cart.id,
          cartItems: [{ cart_item_id: id, quantity }]
        },
        context: {
          headers: {
            Authorization: token ? `Bearer ${token}` : null
          }
        }
      })
      const dataCart = get('updateCartItems.cart', resUpdate)
      setCart({ ...dataCart, type: cart.type })
      return dataCart
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const updateShippingInformation = async ({
    email,
    address,
    methodCode,
    carrierCode,
    subscribe
  }) => {
    const token = localStorage.getItem(TOKEN_USER)
    const { firstname, lastname } = address
    try {
      if (!authData && email) {
        await client.mutate({
          mutation: SetEmailOnCart,
          variables: {
            cartId: cart.id,
            email: email
          }
        })
      }
      await client.mutate({
        mutation: SetShippingAddressesOnCart,
        variables: {
          cartId: cart.id,
          shippingAddress: {
            address
          },
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        }
      })
      const { data: resShipping } = await client.mutate({
        mutation: SetShippingMethodsOnCart,
        variables: {
          cartId: cart.id,
          shippingMethod: {
            carrier_code: carrierCode,
            method_code: methodCode
          },
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        }
      })
      const dataShipping = get(
        'setShippingMethodsOnCart.cart.shipping_addresses',
        resShipping
      )
      const dataPrices = get(
        'setShippingMethodsOnCart.cart.prices',
        resShipping
      )
      setCart({
        ...cart,
        ...(!authData && email ? { email } : {}),
        prices: dataPrices,
        shipping_addresses: dataShipping
      })
      if (subscribe) {
        await shopApi.post(
          `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/customer/subscribe`,
          {
            data: {
              email,
              firstname,
              lastname
            }
          }
        )
      }
      return dataShipping
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const updateBillingInformation = async ({
    email,
    sameAsShipping,
    address
  }) => {
    const token = localStorage.getItem(TOKEN_USER)
    try {
      if (!authData && email) {
        await client.mutate({
          mutation: SetEmailOnCart,
          variables: {
            cartId: cart.id,
            email: email
          }
        })
      }
      const { data: resBilling } = await client.mutate({
        mutation: SetBillingAddressOnCart,
        variables: {
          cartId: cart.id,
          billingAddress: {
            same_as_shipping: !!sameAsShipping,
            address
          },
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        }
      })
      const dataBilling = get(
        'setBillingAddressOnCart.cart.billing_address',
        resBilling
      )
      setCart({
        ...cart,
        ...(!authData && email ? { email } : {}),
        billing_address: dataBilling
      })
      return dataBilling
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const placeOrder = async ({ email, paymentMethod }) => {
    const apiBase = `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/${
      authData ? 'carts/mine' : `guest-carts/${cart.id}`
    }`
    try {
      const res = await shopApi.post(apiBase + `/payment-information`, {
        paymentMethod: {
          method: 'stripe_payments',
          additional_data: {
            cc_save: false,
            cc_stripejs_token: paymentMethod
          }
        },
        ...(authData ? {} : { email: cart.email || email })
      })
      return res.data
    } catch (error) {
      throw error
    }
  }

  const placeFreeOrder = async () => {
    const apiBase = `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/${
      authData ? 'carts/mine' : `guest-carts/${cart.id}`
    }`
    try {
      const res = await shopApi.put(apiBase + `/order`, {
        paymentMethod: {
          method: 'free'
        }
      })
      return res.data
    } catch (error) {
      throw error
    }
  }

  const createPaymentIntent = async (amount, currency) => {
    try {
      // Create the PaymentIntent with the cart details.
      const request = {
        cartId: cart.id,
        amount,
        currency
      }
      const { data } = await shopApi.post(
        `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/payment/payment-intent`,
        {
          params: request
        }
      )
      const result = JSON.parse(data)
      return result
    } catch (error) {
      throw error
    }
  }

  const addToCart = async ({ type, products }) => {
    const token = localStorage.getItem(TOKEN_USER)
    try {
      let mutation = null
      let queryResponse = ''
      if (type === 'bundle') {
        mutation = AddBundleProductsToCart
        queryResponse = 'addBundleProductsToCart.cart'
      } else if (type === 'configurable') {
        mutation = AddConfigurableProductsToCart
        queryResponse = 'addConfigurableProductsToCart.cart'
      } else if (type === 'downloadable') {
        mutation = AddDownloadableProductsToCart
        queryResponse = 'addDownloadableProductsToCart.cart'
      } else if (type === 'simple') {
        mutation = AddSimpleProductsToCart
        queryResponse = 'addSimpleProductsToCart.cart'
      } else if (type === 'virtual') {
        mutation = AddVirtualProductsToCart
        queryResponse = 'addVirtualProductsToCart.cart'
      }
      if (mutation && queryResponse) {
        const { data: resCart } = await client.mutate({
          mutation,
          variables: { cartId: cart.id, products },
          context: {
            headers: {
              Authorization: token ? `Bearer ${token}` : null
            }
          }
        })
        const dataCart = get(queryResponse, resCart)
        setCart({ ...dataCart, type: cart.type })
        const size = dataCart.items.length
        return dataCart.items[size - 1]
      } else {
        return null
      }
    } catch (e) {
      console.error(e)
      return null
    }
  }

  useEffect(() => {
    if (cart.id) {
      if (cart.items) {
        getItems()
      } else {
        getCart()
      }
    }
  }, [cart])

  useEffect(() => {
    if (fetchingAuth) return
    if (authData) {
      fetchAuthCart()
    } else if (cart.id) {
      if (cart.type === 'auth') {
        fetchGuestCart()
        return
      }
      // Check cart is valid
      shopApi
        .get(
          `${process.env.NEXT_PUBLIC_MAGENTO_STORE_CODE}/V1/guest-carts/${cart.id}`
        )
        .then((res) => {
          dispatch({
            type: 'setLoading',
            payload: false
          })
        })
        .catch((e) => {
          if (e.response?.status === 404 || e.response?.status === 401) {
            fetchGuestCart()
            return
          }
          throw e
        })
    } else {
      fetchGuestCart()
    }
  }, [authData, fetchingAuth])

  return (
    <CartContext.Provider
      value={{
        ...state,
        cart,
        setCart,
        fetchGuestCart,
        fetchAuthCart,
        resetCart: getCart,
        createEmptyCart,
        getItemByID,
        removeItemByID,
        removeAll,
        updateQuantityItemByID,
        fetchShippingMethod,
        updateShippingInformation,
        updateBillingInformation,
        placeOrder,
        placeFreeOrder,
        createPaymentIntent,
        addToCart
      }}
    >
      <Elements stripe={stripePromise}>{children}</Elements>
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
export {
  useStripe,
  useElements,
  Elements,
  CardElement,
  CardNumberElement,
  CardCvcElement,
  CardExpiryElement
}

export default CartStore
