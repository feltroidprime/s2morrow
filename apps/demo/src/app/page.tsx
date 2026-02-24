import { Footer } from "@/components/landing/Footer"
import { Hero } from "@/components/landing/Hero"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PlaygroundSection } from "@/components/interactive/PlaygroundSection"
import { AccountDeploySection } from "@/components/interactive/AccountDeploySection"

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      <PlaygroundSection />
      <AccountDeploySection />
      <Footer />
    </main>
  )
}
