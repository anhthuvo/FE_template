import { useState, useCallback, useEffect } from 'react'

const useLocalStorage = (key, initialValue) => {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get from local storage by key
      const item = window && window.localStorage.getItem(key)
      // Parse stored json or if none return initialValue
      const data = item ? JSON.parse(item) : initialValue
      return data
    } catch (ex) {
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback(
    (value) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore =
          typeof value === 'function' ? value(storedValue) : value
        // Save state
        setStoredValue(valueToStore)
        // Save to local storage
        window && window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch (error) {
        // A more advanced implementation would handle the error case
        console.error(error)
      }
    },
    [key, storedValue]
  )

  useEffect(() => {
    // Handle storage event when a storage area (localStorage or sessionStorage) has been modified in the context of another document.
    const handleStorage = function () {
      // Get from local storage by key
      const item = window.localStorage.getItem(key)
      // Parse stored json or if none return initialValue
      const data = item ? JSON.parse(item) : initialValue
      setStoredValue(data)
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return [storedValue, setValue]
}

export default useLocalStorage
