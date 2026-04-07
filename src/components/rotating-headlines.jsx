import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const headlines = [
  {
    heading: "Feel Your Best, Every Day",
    subheading: "Natural support to help you feel more confident, energized.",
    style: "premium"
  },
  {
    heading: "Rediscover Your Balance",
    subheading: "Natural solutions designed to support your confidence, energy, and overall well-being.",
    style: "emotional"
  },
  {
    heading: "Wellness You Can Trust",
    subheading: "Thoughtfully developed formulas focused on consistency, quality, and results.",
    style: "trust"
  },
  {
    heading: "Energy. Confidence. Balance.",
    subheading: "Simple, natural support to help you feel at your best every day.",
    style: "bold"
  },
  {
    heading: "Your Daily Wellness Routine",
    subheading: "Easy-to-use, natural support designed to fit into your lifestyle.",
    style: "modern"
  },
  {
    heading: "Support When You Need It Most",
    subheading: "Helping you restore balance, energy, and confidence—naturally.",
    style: "solution"
  },
  {
    heading: "Feel Like You Again",
    subheading: "Gentle, natural support for confidence, energy, and well-being.",
    style: "playful"
  },
  {
    heading: "Feel Better, Naturally",
    subheading: "Clean, effective support for your everyday wellness.",
    style: "short"
  },
  {
    heading: "A Natural Way to Support Your Well-Being",
    subheading: "Made with trusted ingredients and designed for real, everyday results.",
    style: "landing"
  }
]

export function RotatingHeadlines() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % headlines.length)
        setIsAnimating(false)
      }, 300)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const currentHeadline = headlines[currentIndex]

  const getHeadingClass = (style) => {
    switch (style) {
      case 'premium':
        return "text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 to-pink-400 bg-clip-text text-transparent"
      case 'emotional':
        return "text-4xl md:text-5xl font-light text-pink-600 italic"
      case 'trust':
        return "text-4xl md:text-5xl font-semibold text-gray-800 dark:text-gray-200"
      case 'bold':
        return "text-4xl md:text-5xl font-black tracking-tight text-pink-500"
      case 'modern':
        return "text-4xl md:text-5xl font-thin tracking-wide text-gray-700 dark:text-gray-300"
      case 'solution':
        return "text-4xl md:text-5xl font-semibold text-gray-900 dark:text-gray-100"
      case 'playful':
        return "text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-400"
      case 'short':
        return "text-4xl md:text-5xl font-bold text-pink-600"
      case 'landing':
        return "text-4xl md:text-5xl font-semibold text-pink-700 dark:text-pink-400"
      default:
        return "text-4xl md:text-5xl font-bold text-foreground"
    }
  }

  const getSubheadingClass = (style) => {
    switch (style) {
      case 'premium':
        return "text-lg text-gray-600 dark:text-gray-300 font-medium"
      case 'emotional':
        return "text-lg text-gray-800 dark:text-gray-400 italic"
      case 'trust':
        return "text-lg text-gray-600 dark:text-gray-400"
      case 'bold':
        return "text-lg text-gray-700 dark:text-gray-300 font-medium"
      case 'modern':
        return "text-lg text-gray-500 dark:text-gray-400 font-light"
      case 'solution':
        return "text-lg text-gray-600 dark:text-gray-300"
      case 'playful':
        return "text-lg text-pink-500 dark:text-pink-400"
      case 'short':
        return "text-lg text-gray-600 dark:text-gray-300"
      case 'landing':
        return "text-lg text-gray-700 dark:text-gray-300"
      default:
        return "text-lg text-muted-foreground"
    }
  }

  return (
    <div className="text-center space-y-6 max-w-4xl mx-auto px-4">
      <div className={cn(
        "transition-all duration-300 ease-in-out transform",
        isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
      )}>
        <h1 className={getHeadingClass(currentHeadline.style)}>
          {currentHeadline.heading}
        </h1>
        <p className={getSubheadingClass(currentHeadline.style)}>
          {currentHeadline.subheading}
        </p>
      </div>
      
      {/* Progress indicator */}
      <div className="flex justify-center space-x-2">
        {headlines.map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === currentIndex
                ? "w-8 bg-pink-500"
                : "w-2 bg-pink-200 dark:bg-pink-800"
            )}
          />
        ))}
      </div>
    </div>
  )
}
