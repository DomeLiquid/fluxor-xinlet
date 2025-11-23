/**
 * Mixin Route API Client
 * Implements request signing using HMAC-SHA256 similar to Go's web3_client.go
 */

import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  sharedEd25519Key,
  base64RawURLEncode,
  type AppKeystore,
  type NetworkUserKeystore,
} from "@mixin.dev/mixin-node-sdk";
import type {
  TokenView,
  QuoteRespView,
  SwapRequest,
  SwapRespView,
  RouteErrorResponse,
  MixinRouteAPIError,
} from "@/types/mixin-route.types";

export const MIXIN_ROUTE_API_PREFIX = "https://api.route.mixin.one";
export const MIXIN_ROUTE_CLIENT_ID = "61cb8dd4-16b1-4744-ba0c-7b2d2e52fc59";
export const HEADER_ACCESS_TIMESTAMP = "MR-ACCESS-TIMESTAMP";
export const HEADER_ACCESS_SIGN = "MR-ACCESS-SIGN";
export const HEADER_CONTENT_TYPE = "Content-Type";
export const CONTENT_TYPE_JSON = "application/json";

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
  private sharedKey: Buffer;

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

    // Generate shared key using X25519 key exchange
    this.sharedKey = Buffer.from(sharedEd25519Key(keystore));
  }

  /**
   * Sign an HTTP request using HMAC-SHA256
   * Implements the same logic as Go's SignRequest
   */
  private signRequest(
    method: string,
    uri: string,
    body: string,
    timestamp: number
  ): string {
    // Build data to sign: timestamp + method + uri + body
    const data = `${timestamp}${method.toUpperCase()}${uri}${body}`;

    // Create HMAC-SHA256 signature
    const signature = hmac(sha256, this.sharedKey, Buffer.from(data));

    // Encode as base64 URL-safe string with user ID prefix
    const sigWithUser = Buffer.concat([
      Buffer.from(this.keystore.app_id || this.keystore.app_id, "utf-8"),
      Buffer.from(signature),
    ]);

    return base64RawURLEncode(sigWithUser);
  }

  /**
   * Make an HTTP request with proper signing
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

    // Generate signature
    const signature = this.signRequest(method, uri, bodyString, timestamp);

    // Prepare headers
    const headers: Record<string, string> = {
      [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
      [HEADER_ACCESS_TIMESTAMP]: timestamp.toString(),
      [HEADER_ACCESS_SIGN]: signature,
    };

    // Make request with retry logic
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

        // Handle error responses
        if (!response.ok || response.status === 202) {
          const errorBody = await response.text();
          let errorData: RouteErrorResponse | null = null;

          try {
            errorData = JSON.parse(errorBody);
          } catch {
            // If not JSON, use raw body
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

        // Parse successful response
        const result = await response.json();

        // Mixin Route API wraps responses in a "data" field
        if (result && typeof result === 'object' && 'data' in result) {
          return result.data as T;
        }

        return result as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (
          error instanceof Error &&
          error.name === "MixinRouteAPIError" &&
          (error as MixinRouteAPIError).statusCode >= 400 &&
          (error as MixinRouteAPIError).statusCode < 500
        ) {
          throw error;
        }

        // Wait before retrying
        if (attempt < this.retryCount) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error("Request failed");
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string, query?: string): Promise<T> {
    return this.doRequest<T>("GET", path, query);
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.doRequest<T>("POST", path, undefined, body);
  }

  /**
   * Get list of supported tokens
   * GET /web3/tokens?source=mixin
   */
  async getTokens(): Promise<TokenView[]> {
    return this.get<TokenView[]>("/web3/tokens", "source=mixin");
  }

  /**
   * Get quote for token swap
   * GET /web3/quote?inputMint={inputMint}&outputMint={outputMint}&amount={amount}&source=mixin
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
      source: "mixin",
    }).toString();

    return this.get<QuoteRespView>("/web3/quote", query);
  }

  /**
   * Create a swap transaction
   * POST /web3/swap
   */
  async swap(request: SwapRequest): Promise<SwapRespView> {
    return this.post<SwapRespView>("/web3/swap", request);
  }
}

/**
 * Create a new Web3Client instance
 */
export function createWeb3Client(
  keystore: AppKeystore | NetworkUserKeystore,
  options?: Web3ClientOptions
): Web3Client {
  return new Web3Client(keystore, options);
}
