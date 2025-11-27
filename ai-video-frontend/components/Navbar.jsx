"use client"

import { Button } from "@/components/ui/button"

export default function Navbar() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <span className="font-semibold text-gray-900">AutoShorts.ai</span>
        </div>

        <div className="flex items-center gap-4">
          <Button className="bg-blue-600 hover:bg-blue-700">Upgrade</Button>
          <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
            Dashboard
          </a>
          <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
            Affiliates
          </a>
          <a href="#" className="text-gray-600 hover:text-gray-700 font-medium">
            Logout
          </a>
        </div>
      </div>
    </header>
  )
}
