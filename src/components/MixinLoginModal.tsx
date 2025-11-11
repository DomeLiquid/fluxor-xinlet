"use client";

import { useEffect, useRef, useState } from "react";
import {
  AuthorizationResponse,
  base64RawURLEncode,
  getChallenge,
  getED25519KeyPair,
} from "@mixin.dev/mixin-node-sdk";
import ReconnectingWebSocket from "reconnecting-websocket";
import pako from "pako";
import { v4 } from "uuid";
import { useAppStore } from "@/store";
import { compare } from "@/utils/date";
import { checkMessenger } from "@/utils/mixin";

interface MixinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MixinLoginModal({ isOpen, onClose }: MixinLoginModalProps) {
  // const { setKeystore } = useAppStore();
  const { user, getMixinClient, setKeystore, getMe } = useAppStore((s) => ({
    user: s.user,
    getMixinClient: s.getMixinClient,
    setKeystore: s.setKeystore,
    getMe: s.getMe,
  }));

  const inClient = checkMessenger();

  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID as string;
  const scope = "PROFILE:READ ASSETS:READ SNAPSHOTS:READ";
  const { verifier, challenge } = getChallenge();

  console.log("Client ID:", clientId);
  console.log("Scope:", scope);
  console.log("Challenge:", challenge);

  const [authorization, _setAuthorization] =
    useState<AuthorizationResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<ReconnectingWebSocket | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prev = useRef<AuthorizationResponse | null>(null);

  const setAuthorization = (a: AuthorizationResponse | null) => {
    if (a) {
      prev.current = a;
    }
    _setAuthorization(a);
  };

  // Initialize WebSocket when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsConnecting(true);
    setError(null);
    setAuthorization(null);

    // Set a timeout in case WebSocket doesn't connect
    connectionTimeoutRef.current = setTimeout(() => {
      if (!authorization && !error) {
        console.warn(
          "WebSocket connection timeout - no authorization received"
        );
        setError("Connection timeout. Please try again.");
        setIsConnecting(false);
      }
    }, 15000); // 15 second timeout

    const endpoint = "wss://blaze.mixin.one";
    console.log("Initializing WebSocket connection to:", endpoint);
    ws.current = new ReconnectingWebSocket(endpoint, "Mixin-OAuth-1", {
      maxReconnectionDelay: 5000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.2,
      connectionTimeout: 8000,
      maxRetries: Infinity,
      debug: false,
    });

    const send = (msg: any) => {
      try {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(pako.gzip(JSON.stringify(msg)));
        }
      } catch (e) {
        console.error("WebSocket send error:", e);
      }
    };

    const sendRefreshCode = (authorization: any) => {
      const message = {
        id: v4().toUpperCase(),
        action: "REFRESH_OAUTH_CODE",
        params: {
          client_id: clientId,
          scope,
          code_challenge: challenge,
          authorization_id: authorization ? authorization.authorization_id : "",
        },
      };
      console.log("Sending WebSocket message:", message);
      send(message);
    };

    const handleAuthorization = (a: AuthorizationResponse) => {
      console.log("Received authorization:", a);

      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // Check if this is a newer authorization than the previous one
      if (!prev.current || compare(prev.current.created_at, a.created_at) < 0) {
        setAuthorization(a);
        setIsConnecting(false);

        if (inClient) {
          window.location.href = `mixin://codes/${a.code_id}`;
        }
        return false;
      }

      // If we have a valid authorization code, handle login immediately
      if (a.authorization_code && a.authorization_code.length > 16) {
        handleLogin(a.authorization_code);
        return true;
      }

      return false;
    };

    ws.current.onopen = function () {
      console.log("WebSocket connected successfully");
      setIsConnecting(false);
      console.log("Sending initial REFRESH_OAUTH_CODE request...");
      sendRefreshCode("");
    };

    ws.current.onmessage = function (event) {
      const fileReader = new FileReader();
      fileReader.onload = function () {
        try {
          const msg = this.result
            ? pako.ungzip(new Uint8Array(this.result as ArrayBuffer), {
                to: "string",
              })
            : "{}";
          const data = JSON.parse(msg);
          console.log("WebSocket message received:", data);

          // Handle different response formats
          if (data.data && data.data.code_id) {
            console.log(
              "Received authorization data with code_id:",
              data.data.code_id
            );
            const handled = handleAuthorization(data.data);

            // If not handled (no auto-login), refresh the code after 1 second
            if (!handled) {
              setTimeout(function () {
                sendRefreshCode(data.data);
              }, 1000);
            }
          } else if (data.error) {
            console.error("WebSocket error response:", data.error);
            setError(data.error.description || "Authentication failed");
          } else {
            console.log("Unexpected WebSocket message format:", data);
          }
        } catch (e) {
          console.error("Error processing WebSocket message:", e);
        }
      };
      fileReader.readAsArrayBuffer(event.data);
    };

    ws.current.onerror = function (error) {
      console.error("WebSocket error:", error);
      setError("Connection failed. Please try again.");
      setIsConnecting(false);
    };

    ws.current.onclose = function () {
      console.log("WebSocket closed");
    };

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [isOpen]);

  // Reset authorization state when user is already logged in
  useEffect(() => {
    const { user } = useAppStore.getState();
    if (!user) {
      setAuthorization(null);
    }
  }, [useAppStore.getState().user]);

  const handleLogin = async (code: string) => {
    try {
      const { seed, publicKey } = getED25519KeyPair();

      // // Use Mixin SDK to exchange code for token
      // const tokenData = await fetch("https://api.mixin.one/oauth/token", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     client_id: clientId,
      //     code,
      //     ed25519: base64RawURLEncode(publicKey),
      //     code_verifier: verifier,
      //   }),
      // }).then((res) => res.json());

      // if (!tokenData.data || !tokenData.data.scope) {
      //   setError(tokenData.error?.description || "Failed to get access token");
      //   return;
      // }

      // if (
      //   tokenData.data.scope.indexOf("ASSETS:READ") < 0 ||
      //   tokenData.data.scope.indexOf("SNAPSHOTS:READ") < 0
      // ) {
      //   setError("Insufficient scope permissions");
      //   return;
      // }

      // const keystore = {
      //   app_id: clientId,
      //   scope: tokenData.data.scope,
      //   authorization_id: tokenData.data.authorization_id,
      //   session_private_key: seed.toString("hex"),
      // };

      let client = getMixinClient();
      // Set keystore and get Mixin client
      // let mixinClient = setKeystore(keystore);
      const { scope, authorization_id } = await client.oauth.getToken({
        client_id: clientId,
        code,
        ed25519: base64RawURLEncode(publicKey),
        code_verifier: verifier,
      });

      if (
        !scope ||
        scope.indexOf("ASSETS:READ") < 0 ||
        scope.indexOf("SNAPSHOTS:READ") < 0
      ) {
        // TODO toast
        return;
      }

      client = setKeystore({
        app_id: clientId,
        scope,
        authorization_id,
        session_private_key: seed.toString("hex"),
      });
      await getMe();
      // props.onClose();

      // if (!userData.data) {
      //   setError("Failed to get user profile");
      //   return;
      // }

      // Update store with user info
      // useAppStore.getState().login(
      //   {
      //     user_id: user!.user_id,
      //     full_name: user!.full_name,
      //     avatar_url: user!.avatar_url,
      //   },
      //   keystore
      // );

      // Close modal after successful login
      onClose();
    } catch (e: any) {
      console.error("Login error:", e);
      setError("Login failed. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-xl font-semibold mb-4 text-center">
          Login with Mixin
        </h2>

        <div className="text-center mb-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          ) : null}

          {isConnecting ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
              <p className="text-gray-600">Connecting to Mixin...</p>
            </div>
          ) : authorization ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                使用 Mixin 扫码或点击按钮登录
              </p>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=mixin://codes/${authorization.code_id}`}
                  alt="Mixin Login QR Code"
                  className="w-48 h-48 border border-gray-200 rounded"
                />
              </div>
              <button
                onClick={() => window.open(`mixin://codes/${authorization.code_id}`, "_blank", "noopener,noreferrer")}
                className="btn-primary w-full"
              >
                <svg
                  className="w-5 h-5 mr-2 inline-block"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                在 Mixin 中打开
              </button>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span>等待授权中...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">Preparing login...</p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
