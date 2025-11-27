"use client"

import { useState } from "react"
import Sidebar from "./Sidebar"
import Navbar from "./Navbar"

export default function Layout({ children, activePage = "create" }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activePage={activePage} />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
