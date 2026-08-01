import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const ONBOARDING_STORAGE_KEY = "relocation-maps:onboarding-v1"

const STEPS = [
  {
    title: "See the real cost of commuting",
    body: "This map compares peak travel time and transport cost from homes you might live in to an office in Jabodetabek — so you can shortlist places that actually fit your week.",
    image: "/onboarding/onboarding-01-offer.jpg",
    imageAlt:
      "Map illustration with an office pin linked to several home pins",
  },
  {
    title: "Pin the office, then homes",
    body: "Click the map or use sidebar presets. Click near an existing home (within ~400 m) to move it. Add as many homes as you like — routes update automatically.",
    image: "/onboarding/onboarding-02-pins.jpg",
    imageAlt: "Illustration of placing a home pin on the map from presets",
  },
  {
    title: "Compare time and cost bands",
    body: "Each home shows typical (P50) and slower-day (P80) one-way peak minutes, plus estimated monthly transport cost. Adjust WFO days and travel mode to try different scenarios.",
    image: "/onboarding/onboarding-03-bands.jpg",
    imageAlt: "Illustration of home comparison rows with commute time bands",
  },
  {
    title: "Save a plain-text summary",
    body: "Copy a decision brief with your comparison. Numbers are peak commute bands and fare estimates — not live Grab or Google ETAs.",
    image: "/onboarding/onboarding-04-brief.jpg",
    imageAlt: "Illustration of a decision brief document ready to copy",
  },
] as const

type OnboardingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1")
  } catch {
    // ignore quota / private mode
  }
}

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const finish = () => {
    markOnboardingSeen()
    onOpenChange(false)
    setStep(0)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      markOnboardingSeen()
      setStep(0)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <div className="bg-muted relative aspect-16/10 overflow-hidden">
          {STEPS.map((s, i) => (
            <img
              key={s.image}
              src={s.image}
              alt={i === step ? s.imageAlt : ""}
              aria-hidden={i !== step}
              className={
                i === step
                  ? "absolute inset-0 size-full object-cover transition-opacity duration-200"
                  : "absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200"
              }
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          ))}
          <div
            className="from-popover/0 to-popover pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b"
            aria-hidden
          />
        </div>

        <div className="space-y-4 p-4">
          <DialogHeader>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              How to use · {step + 1}/{STEPS.length}
            </p>
            <DialogTitle className="text-lg">{current.title}</DialogTitle>
            <DialogDescription>{current.body}</DialogDescription>
          </DialogHeader>

          <div
            className="flex items-center gap-1.5"
            aria-label={`Step ${step + 1} of ${STEPS.length}`}
          >
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "bg-primary h-1.5 w-5 rounded-full"
                    : "bg-muted-foreground/30 h-1.5 w-1.5 rounded-full"
                }
              />
            ))}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="sm:mr-auto"
            onClick={finish}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            {isLast ? (
              <Button type="button" onClick={finish}>
                Get started
              </Button>
            ) : (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
