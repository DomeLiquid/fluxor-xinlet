"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import useMixin from "@/hooks/useMixin";
import MixinWallet from "@/components/MixinWallet";
import AssetList from "@/components/AssetList";
import ExchangePanel from "@/components/ExchangePanel";
import TabBar from "@/components/TabBar";
import BulkSwap from "@/components/BulkSwap";
import SplitSwap from "@/components/SplitSwap";

export default function Home() {
  const { user, clear } = useAppStore();

  // Initialize Mixin asset fetching
  useMixin();

  // Check for existing keystore on mount
  useEffect(() => {
    const keystore = localStorage.getItem("mixin_keystore");
    const userData = localStorage.getItem("mixin_user");

    if (keystore && userData) {
      const parsedKeystore = JSON.parse(keystore);
      const parsedUser = JSON.parse(userData);
      // useAppStore.getState().login(parsedUser, parsedKeystore)
    }
  }, []);

  // Save keystore and user to localStorage when they change
  useEffect(() => {
    const { keystore, user } = useAppStore.getState();
    if (keystore && user) {
      localStorage.setItem("mixin_keystore", JSON.stringify(keystore));
      localStorage.setItem("mixin_user", JSON.stringify(user));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Fluxor Mini
              </h1>
              <p className="text-gray-600 mb-8">
                Convert your assets to XIN instantly with micropayments
              </p>
              {/* Desktop connect button */}
              <div className="hidden md:block">
                <MixinWallet />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <MixinWallet />
          </div>
        </div>
      </div>
    );
  }

  const handleDisconnect = () => {
    localStorage.removeItem("mixin_keystore");
    localStorage.removeItem("mixin_user");
    clear();
  };

  return (
    <div className="min-h-screen pb-20 md:pb-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-6 px-4 pt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fluxor Mini</h1>
            <p className="text-gray-600">Welcome back, {user?.full_name}</p>
          </div>
          {/* Desktop logout button */}
          <button
            onClick={handleDisconnect}
            className="btn-secondary hidden md:block"
          >
            断开连接
          </button>
        </header>

        <TabBar>
          {(activeTab) => (
            <div className="px-4 pb-4">
              {activeTab === 'exchange' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <AssetList />
                  </div>
                  <div className="lg:col-span-1">
                    <ExchangePanel />
                  </div>
                </div>
              )}

              {activeTab === 'bulkSwap' && (
                <BulkSwap />
              )}

              {activeTab === 'splitSwap' && (
                <SplitSwap />
              )}
            </div>
          )}
        </TabBar>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <button
            onClick={handleDisconnect}
            className="btn-secondary w-full"
          >
            断开连接
          </button>
        </div>
      </div>
    </div>
  );
}
