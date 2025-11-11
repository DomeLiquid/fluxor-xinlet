'use client'

import { useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import { MixinLoginModal } from './MixinLoginModal'

export default function MixinWallet() {
  const { user } = useAppStore()

  const [show, setShow] = useState(false)
  const handleOpen = useCallback(() => setShow(true), [setShow])
  const handleClose = useCallback(() => setShow(false), [setShow])

  return (
    <div>
      {user ? (
        <div className="flex items-center space-x-3">
          <img
            src={user.avatar_url}
            alt={user.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span className="font-medium">{user.full_name}</span>
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="btn-primary w-full"
        >
          Connect Wallet
        </button>
      )}
      {show && <MixinLoginModal isOpen={true} onClose={handleClose} />}
    </div>
  )
}