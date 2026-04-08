import { useEffect } from 'react'
import './index.css'
import AnimatedBackground from './components/AnimatedBackground'
import Header from './components/Header'
import Hero from './components/Hero'
import ProfilesSection from './components/ProfilesSection'
import Sectors from './components/Sectors'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import Pricing from './components/Pricing'
import CTABanner from './components/CTABanner'
import Footer from './components/Footer'
import StickyButtons from './components/StickyButtons'

export default function App() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <AnimatedBackground />
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <Hero />
          <ProfilesSection />
          <Sectors />
          <Features />
          <HowItWorks />
          <Pricing />
          <CTABanner />
        </main>
        <Footer />
        <StickyButtons />
      </div>
    </div>
  )
}
