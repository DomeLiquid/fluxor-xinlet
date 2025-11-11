'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAppStore } from '@/store'
import { useTokenStore } from '@/store/useTokenStore'

interface PaymentQRCodeProps {
  payUrl: string
  traceIds: string[]
  onClose: () => void
}

export default function PaymentQRCode({ payUrl, traceIds, onClose }: PaymentQRCodeProps) {
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>('pending')
  const [isClosing, setIsClosing] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef<boolean>(false)
  const { getMixinClient, updateBalances } = useAppStore()
  const computerAssets = useTokenStore((s) => s.computerAssets)

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(payUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  const handlePayClick = () => {
    window.open(payUrl, '_blank', 'noopener,noreferrer')
  }

  // 使用 Mixin SDK 轮询最后一个 traceId 的状态
  useEffect(() => {
    if (paymentStatus === 'pending' && traceIds.length > 0) {
      const lastTraceId = traceIds[traceIds.length - 1]

      const pollPaymentStatus = async () => {
        if (isPollingRef.current) return

        try {
          isPollingRef.current = true
          const mixinClient = getMixinClient()

          // 使用 Mixin SDK 检查最后一个 traceId 的交易状态
          const transaction = await mixinClient.utxo.fetchTransaction(lastTraceId)

          // 如果交易存在且状态为 "spent"，表示支付完成
          if (transaction && transaction.state === 'spent') {
            setPaymentStatus('completed')
            // 立即刷新资产余额
            updateBalances(computerAssets)
            // 支付完成后4秒自动关闭
            setTimeout(() => {
              setIsClosing(true)
              setTimeout(() => {
                onClose()
              }, 500)
            }, 4000)
          }
        } catch (error: any) {
          // 如果是 404 错误，说明交易还未创建，继续轮询
          if (error?.response?.status !== 404) {
            console.error('Error checking payment status:', error)
          }
        } finally {
          isPollingRef.current = false
        }
      }

      // 立即执行一次
      pollPaymentStatus()

      // 设置定时轮询，每5秒检查一次
      timerRef.current = setInterval(pollPaymentStatus, 5000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [paymentStatus, traceIds, getMixinClient, onClose, updateBalances, computerAssets])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 500)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg p-6 max-w-md w-full transition-all duration-500 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Mixin 支付</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {paymentStatus === 'pending' ? (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <QRCodeSVG
                  value={payUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>等待支付结果...</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-5 flex-1">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-center md:text-left">
                  使用 Mixin 支付
                </h3>
                <p className="text-sm text-gray-600 text-center md:text-left">
                  扫描二维码或点击按钮在 Mixin 中完成支付
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePayClick}
                  className="btn-primary w-full max-w-[200px] mx-auto md:mx-0"
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

                <button
                  onClick={handleCopyUrl}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium w-full text-center"
                >
                  {copied ? '已复制！' : '复制支付链接'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">支付完成</h3>
            <p className="text-sm text-gray-600">
              页面即将关闭...
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 w-full">
              <p className="text-green-700 text-sm">
                ✅ 机器人已经处理完毕，XIN 已发送到您的钱包
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}