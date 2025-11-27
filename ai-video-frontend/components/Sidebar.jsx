"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

export default function Sidebar({ activePage = "create" }) {
  const [toolsExpanded, setToolsExpanded] = useState(true)

  const navItems = [
    { id: "series", label: "SERIES", icon: "square" },
    { id: "view", label: "VIEW", icon: "square" },
    { id: "create", label: "CREATE", icon: "circle", active: true },
    { id: "tools", label: "TOOLS", icon: "square", hasSubmenu: true },
    { id: "guides", label: "GUIDES", icon: "square" },
    { id: "billing", label: "BILLING", icon: "square" },
    { id: "account", label: "ACCOUNT", icon: "square" },
  ]

  const renderIcon = (iconType) => {
    switch (iconType) {
      case "circle":
        return <div className="w-4 h-4 bg-white rounded-full"></div>
      case "square":
        return <div className="w-4 h-4 border border-current rounded"></div>
      default:
        return <div className="w-4 h-4 border border-current rounded"></div>
    }
  }

  return (
    <div className="w-64 bg-slate-800 text-white flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs font-bold">A</span>
          </div>
          <span className="font-semibold">AutoShorts.ai</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          if (item.id === "tools") {
            return (
              <div key={item.id}>
                <button
                  onClick={() => setToolsExpanded(!toolsExpanded)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full transition-colors ${
                    activePage === item.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-slate-700"
                  }`}
                >
                  {renderIcon(item.icon)}
                  <span>{item.label}</span>
                  {toolsExpanded ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
                {toolsExpanded && (
                  <div className="ml-6 mt-1">
                    <a
                      href="#"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-400 hover:bg-slate-700"
                    >
                      <div className="w-4 h-4 bg-blue-400 rounded"></div>
                      <span>AI AVATAR</span>
                    </a>
                  </div>
                )}
              </div>
            )
          }

          return (
            <a
              key={item.id}
              href="#"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activePage === item.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-slate-700"
              }`}
            >
              {renderIcon(item.icon)}
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
