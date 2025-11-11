export interface Asset {
  asset_id: string
  symbol: string
  name: string
  icon_url: string
  chain_icon_url?: string
  balance: string
  price_usd: string
  value_usd: number
}

export interface User {
  user_id: string
  full_name: string
  avatar_url: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
}

export interface AssetState {
  assets: Asset[]
  isLoading: boolean
  selectedAssets: Asset[]
  totalSelectedValue: number
}

export interface AppState extends AuthState, AssetState {
  // Global app state
}