"use client"

import React from "react"
import { ChatInterface } from "@/components/ChatInterface"

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <ChatInterface />
    </main>
  )
}
