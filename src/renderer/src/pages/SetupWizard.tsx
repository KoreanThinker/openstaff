import * as React from 'react'
// No router needed — App re-renders when setupCompleted changes
import { ArrowRight, ArrowLeft, Globe, Sparkles, Search, Zap, BarChart3, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/stores/settings-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const STEPS = ['Welcome', 'Remote Access', 'Complete'] as const

function StepIndicator({ current }: { current: number }): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-3">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                i < current
                  ? 'bg-success text-success-foreground'
                  : i === current
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                i === current ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px w-8',
                i < current ? 'bg-success' : 'bg-border'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function LoopVisualization(): React.ReactElement {
  return (
    <div className="flex items-center justify-center py-6">
      <svg
        viewBox="0 0 500 180"
        className="w-full max-w-sm h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="140" y1="60" x2="185" y2="60" className="stroke-border" strokeWidth="2" markerEnd="url(#wiz-arrow)" />
        <line x1="315" y1="60" x2="360" y2="60" className="stroke-border" strokeWidth="2" markerEnd="url(#wiz-arrow)" />
        <path d="M 425 85 C 425 150, 75 150, 75 85" fill="none" className="stroke-border" strokeWidth="2" markerEnd="url(#wiz-arrow)" />
        <circle r="4" className="fill-primary">
          <animateMotion dur="9s" repeatCount="indefinite" path="M 90 60 L 250 60 L 410 60 C 425 60, 425 85, 425 85 C 425 150, 75 150, 75 85 C 75 85, 75 60, 90 60" />
        </circle>
        <defs>
          <marker id="wiz-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="fill-border" />
          </marker>
        </defs>
        <foreignObject x="20" y="30" width="120" height="60">
          <div className="flex items-center justify-center gap-2 rounded-full px-4 py-2 bg-chart-1/10 text-chart-1">
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium">Gather</span>
          </div>
        </foreignObject>
        <foreignObject x="190" y="30" width="120" height="60">
          <div className="flex items-center justify-center gap-2 rounded-full px-4 py-2 bg-chart-2/10 text-chart-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Execute</span>
          </div>
        </foreignObject>
        <foreignObject x="360" y="30" width="120" height="60">
          <div className="flex items-center justify-center gap-2 rounded-full px-4 py-2 bg-chart-3/10 text-chart-3">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Evaluate</span>
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}

export function SetupWizard(): React.ReactElement {
  const setSetupCompleted = useSettingsStore((s) => s.setSetupCompleted)
  const [step, setStep] = React.useState(0)
  const [ngrokKey, setNgrokKey] = React.useState('')
  const [dashPassword, setDashPassword] = React.useState('')

  const isPartialFill = (ngrokKey && !dashPassword) || (!ngrokKey && dashPassword)
  const canAdvanceStep2 = !isPartialFill

  const handleComplete = async (): Promise<void> => {
    try {
      const settings: Record<string, unknown> = {
        setup_completed: true
      }
      if (ngrokKey) settings.ngrok_api_key = ngrokKey
      if (dashPassword) settings.ngrok_auth_password = dashPassword
      await api.updateSettings(settings)
    } catch {
      toast({
        title: 'Settings could not be saved',
        description: 'Remote access settings will need to be configured in Settings.',
        variant: 'destructive'
      })
    }
    // Always mark complete - the wizard is a one-time flow
    setSetupCompleted(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        <StepIndicator current={step} />

        {/* Step 1: Welcome */}
        {step === 0 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                <span className="text-2xl font-bold text-primary-foreground">OS</span>
              </div>
              <CardTitle className="text-2xl">Welcome to OpenStaff</CardTitle>
              <CardDescription>
                Manage multiple AI coding agents running 24/7. Like PM2 for AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LoopVisualization />
              <p className="text-center text-sm text-muted-foreground">
                Each Staff runs an autonomous loop: gather context, execute tasks, and evaluate
                results -- continuously.
              </p>
              <Button className="w-full rounded-full" onClick={() => setStep(1)}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Remote Access */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Globe className="h-6 w-6 text-foreground" />
              </div>
              <CardTitle>Remote Access</CardTitle>
              <CardDescription>
                Optionally configure Ngrok for remote dashboard access. You can set this up later
                in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ngrok-key">Ngrok API Key</Label>
                <Input
                  id="ngrok-key"
                  type="password"
                  placeholder="Enter your Ngrok API key..."
                  value={ngrokKey}
                  onChange={(e) => setNgrokKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-password">Dashboard Password</Label>
                <Input
                  id="dash-password"
                  type="password"
                  placeholder="Set a password for remote access..."
                  value={dashPassword}
                  onChange={(e) => setDashPassword(e.target.value)}
                />
              </div>
              {isPartialFill && (
                <p className="text-sm text-warning">Both fields are needed for remote access.</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setStep(2)}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  onClick={() => setStep(2)}
                  disabled={!canAdvanceStep2}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Complete */}
        {step === 2 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/20">
                <Sparkles className="h-6 w-6 text-success" />
              </div>
              <CardTitle>You&apos;re all set!</CardTitle>
              <CardDescription>
                OpenStaff is ready to manage your AI coding agents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg bg-muted p-4">
                <p className="text-sm font-medium text-foreground">Next steps:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-success">1.</span>
                    Install an AI agent (Claude Code) from the Agents page
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-success">2.</span>
                    Create your first Staff with a role and instructions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-success">3.</span>
                    Start the Staff and watch it work autonomously
                  </li>
                </ul>
              </div>
              <Button className="w-full rounded-full" onClick={handleComplete}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
