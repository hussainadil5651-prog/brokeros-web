'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ toast: (message: string, type?: Toast['type']) => void }>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto rounded-lg border px-4 py-3 text-xs font-semibold shadow-lg transition-all duration-300 animate-in slide-in-from-right-2 ${
            t.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' :
            t.type === 'error' ? 'border-rose-500/30 bg-rose-500/15 text-rose-300' :
            'border-amber-500/30 bg-amber-500/15 text-amber-300'
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
