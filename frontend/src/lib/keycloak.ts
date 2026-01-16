import Keycloak from 'keycloak-js'

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || '/auth',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'forensics',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'forensics-ui',
}

export const keycloak = new Keycloak(keycloakConfig)

let initialized = false
let initPromise: Promise<boolean> | null = null

export async function initKeycloak(): Promise<boolean> {
  if (initialized) {
    return keycloak.authenticated ?? false
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      const authenticated = await keycloak.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      initialized = true
      
      if (authenticated) {
        setupTokenRefresh()
      }
      
      return authenticated
    } catch (error) {
      console.error('Keycloak init failed:', error)
      initialized = true
      return false
    }
  })()

  return initPromise
}

function setupTokenRefresh() {
  setInterval(() => {
    keycloak.updateToken(60).catch(() => {
      console.warn('Token refresh failed, user may need to re-login')
    })
  }, 30000)
}

export function login() {
  return keycloak.login()
}

export function logout() {
  return keycloak.logout({ redirectUri: window.location.origin })
}

export function getToken(): string | undefined {
  return keycloak.token
}

export function isAuthenticated(): boolean {
  return keycloak.authenticated ?? false
}

export function hasRole(role: string): boolean {
  return keycloak.hasRealmRole(role)
}

export function isAdmin(): boolean {
  return hasRole('admin') || hasRole('forensic-admin')
}

export function isAnalyst(): boolean {
  return hasRole('analyst') || hasRole('forensic-analyst') || isAdmin()
}

export function getUserInfo() {
  if (!keycloak.authenticated) return null
  
  return {
    id: keycloak.subject,
    username: keycloak.tokenParsed?.preferred_username,
    email: keycloak.tokenParsed?.email,
    name: keycloak.tokenParsed?.name,
    roles: keycloak.realmAccess?.roles || [],
  }
}

export function getAuthHeader(): Record<string, string> {
  if (!keycloak.token) return {}
  return { Authorization: `Bearer ${keycloak.token}` }
}
