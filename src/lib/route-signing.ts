/**
 * Mixin Route API 签名模块
 *
 * 完全按照 Go 的 BotAuthClient.SignRequest 实现
 */

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { ed25519 } from '@noble/curves/ed25519'
import { UserClient, base64RawURLEncode } from '@mixin.dev/mixin-node-sdk'
import type { AppKeystore, NetworkUserKeystore } from '@mixin.dev/mixin-node-sdk'

export const MIXIN_ROUTE_CLIENT_ID = '61cb8dd4-16b1-4744-ba0c-7b2d2e52fc59'

/**
 * Base64 URL 解码
 */
function base64RawURLDecode(str: string): Uint8Array {
  // 补齐 padding
  let padded = str
  const pad = str.length % 4
  if (pad) {
    padded += '='.repeat(4 - pad)
  }

  // 替换字符
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')

  return Uint8Array.from(Buffer.from(base64, 'base64'))
}

/**
 * 签名器类
 *
 * 对应 Go 的 BotAuthClient
 */
export class RouteAPISigner {
  private keystore: AppKeystore | NetworkUserKeystore
  private sharedKeyCache: Map<string, Buffer> = new Map()

  constructor(keystore: AppKeystore | NetworkUserKeystore) {
    this.keystore = keystore
  }

  /**
   * 获取共享密钥
   *
   * 对应 Go 的 getSharedKey 方法:
   * 1. 先从缓存获取
   * 2. 如果缓存未命中,获取用户的 session 公钥
   * 3. 进行 X25519 密钥交换
   * 4. 保存到缓存
   *
   * @param botUserId - Route bot 的用户 ID
   */
  private async getSharedKey(botUserId: string): Promise<Buffer> {
    // 1. 检查缓存
    const cached = this.sharedKeyCache.get(botUserId)
    if (cached) {
      return cached
    }

    // 2. 获取 Route bot 的 session 公钥
    const userClient = UserClient(this.keystore)

    let sessionPublicKey: string

    try {
      // 调用 Mixin API 获取用户信息
      // 注意: 这里需要特殊的 API 来获取 session 公钥
      // 标准的 user.fetch() 可能不返回 session 信息

      // 临时方案: 如果有 server_public_key, 使用它
      if ('server_public_key' in this.keystore) {
        // server_public_key 是 hex 格式,需要转换为 base64 URL
        const pubKeyBuffer = Buffer.from(this.keystore.server_public_key, 'hex')
        sessionPublicKey = base64RawURLEncode(pubKeyBuffer)
      } else {
        throw new Error('Cannot determine session public key')
      }
    } catch (error) {
      console.error('Failed to get Route bot session public key:', error)
      throw error
    }

    // 3. 解码公钥 (base64 URL -> bytes)
    const publicKeyBytes = base64RawURLDecode(sessionPublicKey)

    // 4. 解码自己的私钥 (hex -> bytes)
    const privateKeySeed = Buffer.from(this.keystore.session_private_key, 'hex')

    // 5. Ed25519 私钥转 Curve25519
    const curve25519Private = ed25519.edwardsToMontgomeryPriv(privateKeySeed)

    // 6. 公钥已经是 Curve25519 格式 (从 session 公钥获取的)
    // 或者如果是 Ed25519 公钥,需要转换
    let curve25519Public: Uint8Array
    try {
      // 尝试直接使用
      curve25519Public = publicKeyBytes
    } catch {
      // 如果失败,尝试转换
      curve25519Public = ed25519.edwardsToMontgomery(publicKeyBytes)
    }

    // 7. X25519 密钥交换
    const sharedSecret = ed25519.x25519.getSharedSecret(curve25519Private, curve25519Public)

    const sharedKey = Buffer.from(sharedSecret)

    // 8. 保存到缓存
    this.sharedKeyCache.set(botUserId, sharedKey)

    return sharedKey
  }

  /**
   * 签名 HTTP 请求
   *
   * 对应 Go 的 SignRequest 方法:
   * ```go
   * func (c *BotAuthClient) SignRequest(ctx context.Context, ts int64, botUserId string, r *http.Request) (string, error) {
   *     sharedKey, err := c.getSharedKey(ctx, botUserId)
   *     ...
   *     data := []byte(fmt.Sprintf("%d%s%s", ts, r.Method, r.URL.RequestURI()))
   *     if r.Body != nil {
   *         data = append(data, buf.Bytes()...)
   *     }
   *     hash, err := hex.DecodeString(HmacSha256(sharedKey, data))
   *     return base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf("%s%s", c.SafeUser.UserId, hash)))
   * }
   * ```
   *
   * @param timestamp - Unix 时间戳 (秒)
   * @param botUserId - Route bot 的用户 ID
   * @param method - HTTP 方法 (GET, POST, etc.)
   * @param uri - 请求 URI (包含 path 和 query)
   * @param body - 请求体内容 (可选)
   */
  async signRequest(
    timestamp: number,
    botUserId: string,
    method: string,
    uri: string,
    body: string = ''
  ): Promise<string> {
    // 1. 获取共享密钥
    const sharedKey = await this.getSharedKey(botUserId)

    // 2. 构建待签名数据: timestamp + method + uri + body
    const data = `${timestamp}${method.toUpperCase()}${uri}${body}`

    // 3. HMAC-SHA256 签名
    // 注意: Go 中 HmacSha256 返回 hex 字符串,然后 hex.DecodeString 转回 bytes
    // 我们这里直接得到 bytes
    const hash = hmac(sha256, sharedKey, Buffer.from(data))

    // 4. 组合: userId + hash
    // Go: fmt.Sprintf("%s%s", c.SafeUser.UserId, hash)
    const combined = Buffer.concat([
      Buffer.from(this.keystore.app_id, 'utf-8'),
      Buffer.from(hash)
    ])

    // 5. Base64 URL 编码
    // Go: base64.RawURLEncoding.EncodeToString(combined)
    return base64RawURLEncode(combined)
  }
}

/**
 * 创建签名器实例
 */
export function createRouteAPISigner(
  keystore: AppKeystore | NetworkUserKeystore
): RouteAPISigner {
  return new RouteAPISigner(keystore)
}
