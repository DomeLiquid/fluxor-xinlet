/**
 * Mixin Route API Client - 完全匹配 Go 实现
 *
 * 关键差异:
 * 1. 需要获取 Route API bot 的公钥
 * 2. 用自己的私钥与对方公钥进行 X25519 密钥交换
 * 3. 签名格式: base64URLEncode(userId + hmacHash)
 */

import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { v4 as uuidv4 } from "uuid";
import {
  MixinApi,
  type AppKeystore,
  type NetworkUserKeystore,
} from "@mixin.dev/mixin-node-sdk";
import type {
  TokenView,
  QuoteRespView,
  SwapRequest,
  SwapRespView,
  SwapOrder,
  RouteErrorResponse,
  MixinRouteAPIError,
  MarketAssetInfo,
  HistoricalPrice,
  HistoryPriceType,
} from "@/types/mixin-route.types";

export const MIXIN_ROUTE_API_PREFIX = "https://api.route.mixin.one";
export const MIXIN_ROUTE_CLIENT_ID = "61cb8dd4-16b1-4744-ba0c-7b2d2e52fc59";
export const MIXIN_API_BASE = "https://api.mixin.one";

// 缓存 Route bot 的公钥
let cachedRouteBotPublicKey: Uint8Array | null = null;

/**
 * 生成 Mixin API 认证 Token (JWT)
 */
function signAuthenticationToken(
  method: string,
  uri: string,
  body: string,
  keystore: AppKeystore | NetworkUserKeystore
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour expiration
  const jti = uuidv4();

  // Calculate sig = hex(sha256(method + uri + body))
  const data = method.toUpperCase() + uri + body;
  const hash = sha256(Buffer.from(data));
  const sig = Buffer.from(hash).toString("hex");

  // Determine uid
  const uid =
    (keystore as any).user_id ||
    (keystore as any).app_id ||
    (keystore as any).client_id;

  if (!uid) {
    throw new Error("Keystore missing user_id or app_id");
  }

  const payload = {
    uid,
    sid: keystore.session_id,
    iat,
    exp,
    jti,
    sig,
    scp: "FULL",
  };

  const header = { alg: "EdDSA", typ: "JWT", kid: keystore.session_id };

  const headerBase64 = base64URLEncode(Buffer.from(JSON.stringify(header)));
  const payloadBase64 = base64URLEncode(Buffer.from(JSON.stringify(payload)));

  const signingInput = `${headerBase64}.${payloadBase64}`;

  const privateKeySeed = Buffer.from(keystore.session_private_key, "hex");
  const signature = ed25519.sign(Buffer.from(signingInput), privateKeySeed);
  const signatureBase64 = base64URLEncode(signature);

  return `${signingInput}.${signatureBase64}`;
}

/**
 * 获取 Mixin 用户的 session 公钥
 */
async function fetchUserSession(
  userId: string,
  keystore: AppKeystore | NetworkUserKeystore
): Promise<string> {
  // 如果已缓存,直接返回
  if (cachedRouteBotPublicKey) {
    return base64URLEncode(cachedRouteBotPublicKey);
  }

  const method = "POST";
  const path = "/sessions/fetch";
  const body = JSON.stringify([userId]);

  const token = signAuthenticationToken(method, path, body, keystore);

  try {
    const response = await fetch(`${MIXIN_API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();

    // Go: struct { Data []*UserSession, Error Error }
    if (result.error && result.error.code > 0) {
      throw new Error(`Mixin API Error: ${result.error.description}`);
    }

    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const session = result.data[0];
      if (session && session.public_key) {
        const pubKey = base64URLDecode(session.public_key);
        cachedRouteBotPublicKey = pubKey;
        return session.public_key;
      }
    }

    throw new Error("Invalid response from /sessions/fetch");
  } catch (error) {
    console.error("fetchUserSession failed", error);
    throw error;
  }
}

/**
 * Base64 URL 编码
 */
function base64URLEncode(data: Uint8Array | Buffer): string {
  const base64 = Buffer.from(data).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64 URL 解码
 */
function base64URLDecode(str: string): Uint8Array {
  // 补齐 padding
  const pad = str.length % 4;
  if (pad) {
    str += "=".repeat(4 - pad);
  }

  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/**
 * Ed25519 私钥转 Curve25519 私钥
 */
function ed25519PrivateToCurve25519(ed25519PrivateKey: Uint8Array): Uint8Array {
  // Ed25519 种子是前32字节
  const seed = ed25519PrivateKey.slice(0, 32);

  // 使用 SHA512 哈希种子 (Go implementation)
  const h = sha512.create();
  h.update(seed);
  const digest = h.digest();

  // Curve25519 私钥需要进行位操作
  const curve25519Private = new Uint8Array(digest.slice(0, 32));
  curve25519Private[0] &= 248;
  curve25519Private[31] &= 127;
  curve25519Private[31] |= 64;

  return curve25519Private;
}

/**
 * 生成共享密钥
 */
async function generateSharedKey(
  keystore: AppKeystore | NetworkUserKeystore,
  routeBotPublicKey: string
): Promise<Uint8Array> {
  // 1. 解码自己的私钥 (hex)
  // Mixin Keystore 的 session_private_key 是 Ed25519 的种子 (32字节)
  const privateKeySeed = Buffer.from(keystore.session_private_key, "hex");

  // 2. 转换为 Curve25519 私钥
  const curve25519Private = ed25519PrivateToCurve25519(privateKeySeed);

  // 3. 解码对方公钥 (base64 URL)
  const remoteCurve25519Public = base64URLDecode(routeBotPublicKey);

  // 4. 进行 X25519 密钥交换
  const sharedSecret = x25519.getSharedSecret(
    curve25519Private,
    remoteCurve25519Public
  );

  return sharedSecret;
}

export interface Web3ClientOptions {
  baseURL?: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export class Web3Client {
  private baseURL: string;
  private keystore: AppKeystore | NetworkUserKeystore;
  private clientID: string;
  private timeout: number;
  private retryCount: number;
  private retryDelay: number;
  private sharedKeyPromise: Promise<Uint8Array> | null = null;

  constructor(
    keystore: AppKeystore | NetworkUserKeystore,
    options: Web3ClientOptions = {}
  ) {
    this.baseURL = options.baseURL || MIXIN_ROUTE_API_PREFIX;
    this.keystore = keystore;
    this.clientID = MIXIN_ROUTE_CLIENT_ID;
    this.timeout = options.timeout || 10000;
    this.retryCount = options.retryCount || 0;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * 获取共享密钥 (懒加载)
   */
  private async getSharedKey(): Promise<Uint8Array> {
    if (!this.sharedKeyPromise) {
      this.sharedKeyPromise = (async () => {
        // 获取 Route bot 的公钥
        const routeBotPublicKey = await fetchUserSession(
          this.clientID,
          this.keystore
        );

        // 生成共享密钥
        return generateSharedKey(this.keystore, routeBotPublicKey);
      })();
    }

    return this.sharedKeyPromise;
  }

  /**
   * 签名请求
   *
   * Go 实现:
   * 1. data = timestamp + method + uri + body
   * 2. hash = HmacSha256(sharedKey, data)
   * 3. signature = base64URLEncode(userId + hash)
   */
  private async signRequest(
    method: string,
    uri: string,
    body: string,
    timestamp: number
  ): Promise<string> {
    // 获取共享密钥
    const sharedKey = await this.getSharedKey();

    // 构建待签名数据: timestamp + method + uri + body
    const data = `${timestamp}${method.toUpperCase()}${uri}${body}`;

    // HMAC-SHA256 签名
    const hash = hmac(sha256, sharedKey, Buffer.from(data));

    // 组合: userId + hash
    // Go implementation: base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf("%s%s", c.SafeUser.UserId, hash)))
    const combined = Buffer.concat([
      Buffer.from(this.keystore.app_id, "utf-8"),
      Buffer.from(hash), // hash matches the decoded hex string from Go's HmacSha256
    ]);

    // Base64 URL 编码
    return base64URLEncode(combined);
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
    const url = new URL(path, this.baseURL);
    if (query) {
      url.search = query;
    }

    const uri = url.pathname + url.search;
    const bodyString = body ? JSON.stringify(body) : "";
    const timestamp = Math.floor(Date.now() / 1000);

    // 生成签名
    const signature = await this.signRequest(
      method,
      uri,
      bodyString,
      timestamp
    );

    // 准备请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "MR-ACCESS-TIMESTAMP": timestamp.toString(),
      "MR-ACCESS-SIGN": signature,
    };

    // 发送请求
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: bodyString || undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 处理错误响应
        if (!response.ok || response.status === 202) {
          const errorBody = await response.text();
          let errorData: RouteErrorResponse | null = null;

          try {
            errorData = JSON.parse(errorBody);
          } catch {
            // 非 JSON 响应
          }

          if (errorData?.error) {
            const err = new Error(
              errorData.error.description
            ) as MixinRouteAPIError;
            err.name = "MixinRouteAPIError";
            err.statusCode = response.status;
            err.code = errorData.error.code;
            err.description = errorData.error.description;
            err.rawBody = errorBody;
            err.range = errorData.error.extra?.range;
            throw err;
          }

          const err = new Error(
            `HTTP ${response.status}: ${errorBody}`
          ) as MixinRouteAPIError;
          err.name = "MixinRouteAPIError";
          err.statusCode = response.status;
          err.rawBody = errorBody;
          throw err;
        }

        // 解析成功响应
        const result = await response.json();

        // Mixin Route API 响应包含 data 字段
        if (result && typeof result === "object" && "data" in result) {
          return result.data as T;
        }

        return result as T;
      } catch (error) {
        lastError = error as Error;

        // 4xx 错误不重试
        if (
          error instanceof Error &&
          error.name === "MixinRouteAPIError" &&
          (error as MixinRouteAPIError).statusCode >= 400 &&
          (error as MixinRouteAPIError).statusCode < 500
        ) {
          throw error;
        }

        // 重试前等待
        if (attempt < this.retryCount) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error("Request failed");
  }

  // ... API 方法保持不变 ...

  async get<T>(path: string, query?: string): Promise<T> {
    return this.doRequest<T>("GET", path, query);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.doRequest<T>("POST", path, undefined, body);
  }

  async getTokens(): Promise<TokenView[]> {
    return this.get<TokenView[]>("/web3/tokens", "source=mixin");
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string
  ): Promise<QuoteRespView> {
    const query = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      source: "mixin",
    }).toString();

    return this.get<QuoteRespView>("/web3/quote", query);
  }

  async swap(request: SwapRequest): Promise<SwapRespView> {
    return this.post<SwapRespView>("/web3/swap", request);
  }

  async getSwapOrder(orderId: string): Promise<SwapOrder> {
    return this.get<SwapOrder>(`/web3/swap/orders/${orderId}`);
  }

  /**
   * Get asset market information
   * @param assetId - Asset ID (coin_id from GET /markets, or mixin asset id)
   * @returns Market asset information
   */
  async getAssetInfo(assetId: string): Promise<MarketAssetInfo> {
    return this.get<MarketAssetInfo>(`/markets/${assetId}`);
  }

  /**
   * Get asset price history
   * @param assetId - Asset ID (coin_id from GET /markets, or mixin asset id)
   * @param type - History type (1D, 1W, 1M, YTD, ALL)
   * @returns Historical price data
   */
  async getPriceHistory(
    assetId: string,
    type: HistoryPriceType
  ): Promise<HistoricalPrice> {
    const query = new URLSearchParams({
      type: type,
    }).toString();

    return this.get<HistoricalPrice>(
      `/markets/${assetId}/price-history`,
      query
    );
  }
}

export function createWeb3Client(
  keystore: AppKeystore | NetworkUserKeystore,
  options?: Web3ClientOptions
): Web3Client {
  return new Web3Client(keystore, options);
}
