import { UserAssetBalance } from '@/types/computer.types'
import { buildMixAddress, newMixinInvoice, attachInvoiceEntry, getInvoiceString } from '@mixin.dev/mixin-node-sdk'
import { v4 as uuidv4 } from 'uuid'

export interface InvoiceResponse {
  payUrl: string
  traceIds: string[]
}

export class FluxorService {
  static generateInvoice(assets: UserAssetBalance[]): InvoiceResponse {
    // 获取 Client ID 用于创建 Mix Address
    const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || ''
    if (!clientId) {
      throw new Error('NEXT_PUBLIC_CLIENT_ID is not configured')
    }

    // 创建 Mix Address (threshold=1 表示单签)
    const mixAddress = buildMixAddress({
      version: 2,
      xinMembers: [],
      uuidMembers: [clientId],
      threshold: 1,
    })

    // 创建 Invoice 对象
    const invoice = newMixinInvoice(mixAddress)
    if (!invoice) {
      throw new Error('Failed to create invoice')
    }

    const traceIds: string[] = []

    // 为每个资产添加 Invoice Entry
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]
      // 生成唯一的 trace ID
      const traceId = uuidv4()
      traceIds.push(traceId)

      // 使用 attachInvoiceEntry 添加 entry
      // 第一个 entry (index 0) 不需要 index_references
      // 后续的 entry 需要引用前一个 entry 的 index
      attachInvoiceEntry(invoice, {
        trace_id: traceId,
        asset_id: asset.asset_id,
        amount: asset.total_amount,
        extra: Buffer.from([]),
        index_references: i === 0 ? [] : [i - 1],
        hash_references: [],
      })
    }

    // 使用 getInvoiceString 生成支付 URL
    const invoiceString = getInvoiceString(invoice)
    const payUrl = 'https://mixin.one/pay/' + invoiceString

    return {
      payUrl,
      traceIds,
    }
  }

  // Supported assets for reference
  static readonly SUPPORTED_ASSETS = {
    BTC: 'c6d0c728-2624-429b-8e0d-d9d19b6592fa',
    ETH: '43d61dcd-e413-450d-80b8-101d5e903357',
    USDT: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
    USDC: '9b180ab6-6abe-3dc0-a13f-04169eb34bfa',
    XIN: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  }
}