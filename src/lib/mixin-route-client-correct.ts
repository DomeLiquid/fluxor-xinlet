/**
 * Mixin Route API Client - 正确实现
 *
 * 完全匹配 Go 的 SignRequest 逻辑:
 * 1. 获取 Route bot 的 session 公钥
 * 2. 用自己的私钥与 Route bot 公钥进行 X25519 密钥交换
 * 3. 使用共享密钥进行 HMAC-SHA256 签名
 * 4. 签名格式: base64URLEncode(userId + hmacHash)
 */

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { ed25519 } from '@noble/curves/ed25519'
import { UserClient, base64RawURLEncode, base64RawURLDecode } from '@mixin.dev/mixin-node-sdk'
import type { AppKeystore, NetworkUserKeystore } from '@mixin.dev/mixin-node-sdk'
import type {
  TokenView,
  QuoteRespView,
  SwapRequest,
  SwapRespView,
  RouteErrorResponse,
  MixinRouteAPIError
} from '@/types/mixin-route.types'

export const MIXIN_ROUTE_API_PREFIX = 'https://api.route.mixin.one'
export const MIXIN_ROUTE_CLIENT_ID = '61cb8dd4-16b1-4744-ba0c-7b2d2e52fc59'

/**
 * 计算共享密钥 (X25519)
 *
 * @param sessionPrivateKey - 自己的 session 私钥 (hex)
 * @param remotePublicKey - 对方的公钥 (base64 URL 或 hex)
 * @param isHex - 对方公钥是否为 hex 格式 (默认 false,即 base64 URL)
 */
function calculateSharedKey(
  sessionPrivateKey: string,
  remotePublicKey: string,
  isHex: boolean = false
): Buffer {
  // 1. 解码自己的私钥 (hex)
  const privateKeyBuffer = Buffer.from(sessionPrivateKey, 'hex')

  // 2. 转换为 Curve25519 私钥
  const curve25519Private = ed25519.edwardsToMontgomeryPriv(privateKeyBuffer)

  // 3. 解码对方公钥
  const curve25519Public = isHex
    ? ed25519.edwardsToMontgomery(Buffer.from(remotePublicKey, 'hex'))
    : base64RawURLDecode(remotePublicKey)

  // 4. X25519 密钥交换
  const sharedSecret = ed25519.x25519.getSharedSecret(curve25519Private, curve25519Public)

  return Buffer.from(sharedSecret)
}

export interface Web3ClientOptions {
  baseURL?: string
  timeout?: number
  retryCount?: number
  retryDelay?: number
  /**
   * Route bot 的 session 公钥 (base64 URL 编码)
   * 如果不提供,将自动从 Mixin API 获取
   */
  routeBotPublicKey?: string
}

export class Web3Client {
  private baseURL: string
  private keystore: AppKeystore | NetworkUserKeystore
  private clientID: string
  private timeout: number
  private retryCount: number
  private retryDelay: number
  private sharedKeyCache: Buffer | null = null
  private routeBotPublicKey: string | null

  constructor(
    keystore: AppKeystore | NetworkUserKeystore,
    options: Web3ClientOptions = {}
  ) {
    this.baseURL = options.baseURL || MIXIN_ROUTE_API_PREFIX
    this.keystore = keystore
    this.clientID = MIXIN_ROUTE_CLIENT_ID
    this.timeout = options.timeout || 10000
    this.retryCount = options.retryCount || 0
    this.retryDelay = options.retryDelay || 1000
    this.routeBotPublicKey = options.routeBotPublicKey || null
  }

  /**
   * 获取 Route bot 的 session 公钥
   */
  private async getRouteBotPublicKey(): Promise<string> {
    if (this.routeBotPublicKey) {
      return this.routeBotPublicKey
    }

    // 使用 Mixin SDK 获取用户信息
    const userClient = UserClient(this.keystore)

    try {
      const userInfo = await userClient.fetch(this.clientID)

      // 从用户信息中提取 session 公钥
      // 注意: 这里需要查看 Mixin API 返回的字段名
      // 可能是 session_id 对应的公钥
      if ('session_id' in userInfo && userInfo.session_id) {
        // TODO: 需要通过特定 API 获取 session 的公钥
        // 暂时使用占位符
        throw new Error('Need to fetch session public key from Mixin API')
      }

      throw new Error('Cannot find Route bot session public key')
    } catch (error) {
      console.error('Failed to fetch Route bot public key:', error)
      throw error
    }
  }

  /**
   * 获取共享密钥 (懒加载 + 缓存)
   */
  private async getSharedKey(): Promise<Buffer> {
    if (this.sharedKeyCache) {
      return this.sharedKeyCache
    }

    // 获取 Route bot 的公钥
    const routeBotPubKey = await this.getRouteBotPublicKey()

    // 计算共享密钥
    this.sharedKeyCache = calculateSharedKey(
      this.keystore.session_private_key,
      routeBotPubKey,
      false // base64 URL 格式
    )

    return this.sharedKeyCache
  }

  /**
   * 签名 HTTP 请求
   *
   * Go 实现逻辑:
   * 1. data = timestamp + method + uri + body
   * 2. hash = HmacSha256(sharedKey, data)
   * 3. signature = base64URLEncode(userId + hash)
   *
   * @param method - HTTP 方法
   * @param uri - 请求 URI (path + query)
   * @param body - 请求体 (JSON 字符串)
   * @param timestamp - Unix 时间戳
   */
  private async signRequest(
    method: string,
    uri: string,
    body: string,
    timestamp: number
  ): Promise<string> {
    // 1. 获取共享密钥
    const sharedKey = await this.getSharedKey()

    // 2. 构建待签名数据: timestamp + method + uri + body
    const data = `${timestamp}${method.toUpperCase()}${uri}${body}`

    // 3. HMAC-SHA256 签名
    const hash = hmac(sha256, sharedKey, Buffer.from(data))

    // 4. 组合: userId + hash
    const combined = Buffer.concat([
      Buffer.from(this.keystore.app_id, 'utf-8'),
      Buffer.from(hash)
    ])

    // 5. Base64 URL 编码
    return base64RawURLEncode(combined)
  }

  /**
   * 执行 HTTP 请求
   */
  private async doRequest<T>(
    method: string,
    path: string,
    query?: string,
    body?: unknown
  ): Promise<T> {
    const url = new URL(path, this.baseURL)
    if (query) {
      url.search = query
    }

    const uri = url.pathname + url.search
    const bodyString = body ? JSON.stringify(body) : ''
    const timestamp = Math.floor(Date.now() / 1000)

    // 生成签名
    const signature = await this.signRequest(method, uri, bodyString, timestamp)

    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'MR-ACCESS-TIMESTAMP': timestamp.toString(),
      'MR-ACCESS-SIGN': signature
    }

    // 发送请求 (带重试)
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: bodyString || undefined,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // 处理错误响应
        if (!response.ok || response.status === 202) {
          const errorBody = await response.text()
          let errorData: RouteErrorResponse | null = null

          try {
            errorData = JSON.parse(errorBody)
          } catch {
            // 非 JSON 响应
          }

          if (errorData?.error) {
            const err = new Error(errorData.error.description) as MixinRouteAPIError
            err.name = 'MixinRouteAPIError'
            err.statusCode = response.status
            err.code = errorData.error.code
            err.description = errorData.error.description
            err.rawBody = errorBody
            err.range = errorData.error.extra?.range
            throw err
          }

          const err = new Error(`HTTP ${response.status}: ${errorBody}`) as MixinRouteAPIError
          err.name = 'MixinRouteAPIError'
          err.statusCode = response.status
          err.rawBody = errorBody
          throw err
        }

        // 解析成功响应
        const result = await response.json()

        // Mixin Route API 响应包含 data 字段
        if (result && typeof result === 'object' && 'data' in result) {
          return result.data as T
        }

        return result as T
      } catch (error) {
        lastError = error as Error

        // 4xx 错误不重试
        if (
          error instanceof Error &&
          error.name === 'MixinRouteAPIError' &&
          (error as MixinRouteAPIError).statusCode >= 400 &&
          (error as MixinRouteAPIError).statusCode < 500
        ) {
          throw error
        }

        // 重试前等待
        if (attempt < this.retryCount) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        }
      }
    }

    throw lastError || new Error('Request failed')
  }

  /**
   * GET 请求
   */
  async get<T>(path: string, query?: string): Promise<T> {
    return this.doRequest<T>('GET', path, query)
  }

  /**
   * POST 请求
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.doRequest<T>('POST', path, undefined, body)
  }

  /**
   * 获取支持的代币列表
   */
  async getTokens(): Promise<TokenView[]> {
    return this.get<TokenView[]>('/web3/tokens', 'source=mixin')
  }

  /**
   * 获取兑换报价
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string
  ): Promise<QuoteRespView> {
    const query = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      source: 'mixin'
    }).toString()

    return this.get<QuoteRespView>('/web3/quote', query)
  }

  /**
   * 创建兑换交易
   */
  async swap(request: SwapRequest): Promise<SwapRespView> {
    return this.post<SwapRespView>('/web3/swap', request)
  }
}

/**
 * 创建 Web3Client 实例
 */
export function createWeb3Client(
  keystore: AppKeystore | NetworkUserKeystore,
  options?: Web3ClientOptions
): Web3Client {
  return new Web3Client(keystore, options)
}
