"use client"

import type { ReactNode } from "react"
import { RegistryProvider } from "@effect-atom/atom-react"

interface ProvidersProps {
  readonly children?: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return <RegistryProvider>{children}</RegistryProvider>
}
