import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiClient } from '../services/api-client'

const AuthContext = createContext(null)

function setScraperCookie(token) {
  document.cookie = `scraper_token=${token}; path=/; SameSite=Strict; max-age=86400`
}

function clearScraperCookie() {
  document.cookie = 'scraper_token=; path=/; max-age=0'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const validateToken = useCallback(async () => {
    const token = apiClient.getToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const userData = await apiClient.get('/auth/me')
      setScraperCookie(token)
      setUser(userData)
    } catch {
      apiClient.clearAuth()
      clearScraperCookie()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    validateToken()
    const handleExpired = () => { clearScraperCookie(); setUser(null) }
    window.addEventListener('auth-expired', handleExpired)
    return () => window.removeEventListener('auth-expired', handleExpired)
  }, [validateToken])

  const login = async (email, password) => {
    const data = await apiClient.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    setScraperCookie(data.access_token)
    const userData = await apiClient.get('/auth/me')
    setUser(userData)
    return userData
  }

  const register = async (email, password, name) => {
    const data = await apiClient.post('/auth/register', { email, password, name })
    localStorage.setItem('access_token', data.access_token)
    setScraperCookie(data.access_token)
    const userData = await apiClient.get('/auth/me')
    setUser(userData)
    return userData
  }

  const logout = () => {
    apiClient.clearAuth()
    clearScraperCookie()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
