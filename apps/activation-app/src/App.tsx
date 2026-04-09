import { useState } from "react";
import IndustryTab from "./IndustryTab";
import { INDUSTRIES } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState(INDUSTRIES[0].id);
  const [darkMode, setDarkMode] = useState(false); // light mode default
  const activeIndustry = INDUSTRIES.find((i) => i.id === activeTab) ?? INDUSTRIES[0];

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-10 backdrop-blur-sm ${
        darkMode
          ? "border-gray-800 bg-gray-950/80"
          : "border-gray-200 bg-white/80"
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                Fivetran Activations
              </h1>
              <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>AI Industry Solutions</p>
            </div>
          </div>
          <div className={`flex items-center gap-4 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
            <span>MOVE &rarr; TRANSFORM &rarr; AGENT &rarr; <span className="text-cyan-500 font-medium">ACTIVATE</span></span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                darkMode
                  ? "bg-gray-800 text-gray-400 hover:text-gray-200"
                  : "bg-gray-100 text-gray-500 hover:text-gray-700"
              }`}
            >
              {darkMode ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              {darkMode ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <nav className={`flex gap-1 border-b -mb-px ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
          {INDUSTRIES.map((industry) => (
            <button
              key={industry.id}
              onClick={() => setActiveTab(industry.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors text-center ${
                activeTab === industry.id
                  ? darkMode
                    ? "bg-gray-900 text-white border border-gray-800 border-b-gray-950 -mb-px"
                    : "bg-white text-gray-900 border border-gray-200 border-b-gray-50 -mb-px"
                  : darkMode
                    ? "text-gray-500 hover:text-gray-300 hover:bg-gray-900/30"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="leading-tight">
                <div>{industry.label}</div>
                <div className={`text-xs font-normal ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                  {industry.description}
                </div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <IndustryTab industry={activeIndustry} darkMode={darkMode} />
      </main>

      {/* Footer */}
      <footer className={`max-w-7xl mx-auto px-6 py-8 text-center text-xs ${darkMode ? "text-gray-700" : "text-gray-400"}`}>
        Powered by Fivetran + Snowflake + dbt + Cortex AI
      </footer>
    </div>
  );
}
