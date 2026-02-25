import { Footer } from "@/components/landing/Footer"
import { Hero } from "@/components/landing/Hero"
import { NavHeader } from "@/components/landing/NavHeader"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PlaygroundSection } from "@/components/interactive/PlaygroundSection"
import { PipelineSection } from "@/components/interactive/PipelineSection"
import { AccountDeploySection } from "@/components/interactive/AccountDeploySection"

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <NavHeader />
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      <PlaygroundSection />
      <PipelineSection />
      <AccountDeploySection />
      <Footer />
    </main>
  )
}
