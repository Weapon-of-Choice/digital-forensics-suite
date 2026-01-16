import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  initKeycloak, 
  login, 
  logout, 
  isAuthenticated, 
  getUserInfo, 
  isAdmin, 
  isAnalyst,
  keycloak 
} from './keycloak'

interface User {
  id: string | undefined
  username: string | undefined
  email: string | undefined
  name: string | undefined
  roles: string[]
}

interface AuthContextType {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
  login: () => void
  logout: () => void
  isAdmin: boolean
  isAnalyst: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    initKeycloak()
      .then((auth) => {
        setAuthenticated(auth)
        if (auth) {
          setUser(getUserInfo())
        }
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })

    keycloak.onAuthSuccess = () => {
      setAuthenticated(true)
      setUser(getUserInfo())
    }

    keycloak.onAuthLogout = () => {
      setAuthenticated(false)
      setUser(null)
    }

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
        setAuthenticated(false)
        setUser(null)
      })
    }
  }, [])

  const value: AuthContextType = {
    isLoading,
    isAuthenticated: authenticated,
    user,
    login,
    logout,
    isAdmin: isAdmin(),
    isAnalyst: isAnalyst(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
