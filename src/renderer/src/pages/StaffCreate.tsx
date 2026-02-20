import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Zap, BarChart3, X, Plus, Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Loop Visualization ─────────────────────────────────────────────

interface LoopVisualizationProps {
  activePhase: 'gather' | 'execute' | 'evaluate' | null
}

function LoopVisualization({ activePhase }: LoopVisualizationProps): React.ReactElement {
  return (
    <Card className="border border-border">
      <CardContent className="py-10 px-6">
        <div className="flex flex-col items-center gap-4">
          {/* Nodes and arrows */}
          <div className="relative w-full max-w-lg">
            <svg
              viewBox="0 0 500 180"
              className="w-full h-auto"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Staff loop visualization: Gather, Execute, Evaluate cycle"
            >
              {/* Forward arrows: Gather -> Execute -> Evaluate */}
              <line
                x1="140" y1="60" x2="185" y2="60"
                className="stroke-border" strokeWidth="2" markerEnd="url(#arrowhead)"
              />
              <line
                x1="315" y1="60" x2="360" y2="60"
                className="stroke-border" strokeWidth="2" markerEnd="url(#arrowhead)"
              />

              {/* Return arrow: Evaluate -> Gather (curved, underneath) */}
              <path
                d="M 425 85 C 425 150, 75 150, 75 85"
                fill="none"
                className="stroke-border"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />

              {/* Animated traveling dot */}
              <circle r="4" className="fill-primary">
                <animateMotion
                  dur="9s"
                  repeatCount="indefinite"
                  path="M 90 60 L 250 60 L 410 60 C 425 60, 425 85, 425 85 C 425 150, 75 150, 75 85 C 75 85, 75 60, 90 60"
                />
              </circle>

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 8 3, 0 6"
                    className="fill-border"
                  />
                </marker>
              </defs>

              {/* Gather node */}
              <foreignObject x="20" y="30" width="120" height="60">
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-full px-4 py-2 transition-transform duration-300',
                    'bg-chart-1/10 text-chart-1',
                    activePhase === 'gather' && 'scale-110 ring-2 ring-chart-1/40'
                  )}
                >
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-medium">Gather</span>
                </div>
              </foreignObject>

              {/* Execute node */}
              <foreignObject x="190" y="30" width="120" height="60">
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-full px-4 py-2 transition-transform duration-300',
                    'bg-chart-2/10 text-chart-2',
                    activePhase === 'execute' && 'scale-110 ring-2 ring-chart-2/40'
                  )}
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">Execute</span>
                </div>
              </foreignObject>

              {/* Evaluate node */}
              <foreignObject x="360" y="30" width="120" height="60">
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-full px-4 py-2 transition-transform duration-300',
                    'bg-chart-3/10 text-chart-3',
                    activePhase === 'evaluate' && 'scale-110 ring-2 ring-chart-3/40'
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Evaluate</span>
                </div>
              </foreignObject>
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Your Staff repeats this cycle forever
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Form Types ─────────────────────────────────────────────────────

interface FormData {
  name: string
  role: string
  gather: string
  execute: string
  evaluate: string
  kpi: string
  skills: string[]
  agent: string
  model: string
}

interface FormErrors {
  name?: string
  role?: string
  gather?: string
  execute?: string
  evaluate?: string
}

const INITIAL_FORM: FormData = {
  name: '',
  role: '',
  gather: '',
  execute: '',
  evaluate: '',
  kpi: '',
  skills: [],
  agent: 'claude-code',
  model: 'claude-sonnet-4-5'
}

// ─── Main Component ─────────────────────────────────────────────────

export function StaffCreate(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [activePhase, setActivePhase] = useState<'gather' | 'execute' | 'evaluate' | null>(null)
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [skillsPopoverOpen, setSkillsPopoverOpen] = useState(false)
  const [registryDialogOpen, setRegistryDialogOpen] = useState(false)
  const isDirty = useRef(false)
  const firstErrorRef = useRef<HTMLElement | null>(null)

  // ─── Data Fetching ────────────────────────────────────────────────

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => api.getStaff(id!),
    enabled: isEditMode
  })

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.getSkills()
  })

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.getAgents()
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings()
  })

  // ─── Populate form in edit mode ───────────────────────────────────

  useEffect(() => {
    if (isEditMode && staff) {
      setForm({
        name: staff.name,
        role: staff.role,
        gather: staff.gather,
        execute: staff.execute,
        evaluate: staff.evaluate,
        kpi: staff.kpi,
        skills: staff.skills,
        agent: staff.agent,
        model: staff.model
      })
    }
  }, [isEditMode, staff])

  // ─── Apply template callback (must be before useEffect that uses it) ──

  const applyTemplate = useCallback((template: {
    role: string
    gather: string
    execute: string
    evaluate: string
    kpi: string
    required_skills: string[]
    recommended_agent: string
    recommended_model: string
  }) => {
    isDirty.current = true
    setForm((prev) => ({
      ...prev,
      role: template.role,
      gather: template.gather,
      execute: template.execute,
      evaluate: template.evaluate,
      kpi: template.kpi,
      skills: template.required_skills,
      agent: template.recommended_agent,
      model: template.recommended_model
    }))
  }, [])

  // ─── Apply template from location state (Registry → Create) ──────

  useEffect(() => {
    const state = location.state as { template?: { role: string; gather: string; execute: string; evaluate: string; kpi: string; required_skills: string[]; recommended_agent: string; recommended_model: string } } | null
    if (!isEditMode && state?.template) {
      applyTemplate(state.template)
      // Clear location state to prevent re-apply on re-renders
      window.history.replaceState({}, '')
    }
  }, [location.state, isEditMode, applyTemplate])

  // ─── Set defaults from settings ───────────────────────────────────

  useEffect(() => {
    if (!isEditMode && settings) {
      setForm((prev) => ({
        ...prev,
        agent: settings.default_agent || prev.agent,
        model: settings.default_model || prev.model
      }))
    }
  }, [isEditMode, settings])

  // ─── Available models for the selected agent ──────────────────────

  const selectedAgent = agents?.find((a) => a.id === form.agent)
  const availableModels = selectedAgent?.models ?? []

  // ─── Form Handlers ────────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    isDirty.current = true
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field in errors) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field as keyof FormErrors]
        return next
      })
    }
  }, [errors])

  const handleAgentChange = useCallback((agentId: string) => {
    isDirty.current = true
    const agent = agents?.find((a) => a.id === agentId)
    const firstModel = agent?.models[0]?.id ?? ''
    setForm((prev) => ({ ...prev, agent: agentId, model: firstModel }))
  }, [agents])

  const addSkill = useCallback((skillName: string) => {
    isDirty.current = true
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillName) ? prev.skills : [...prev.skills, skillName]
    }))
    setSkillsPopoverOpen(false)
  }, [])

  const removeSkill = useCallback((skillName: string) => {
    isDirty.current = true
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillName)
    }))
  }, [])

  // ─── Validation ───────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    firstErrorRef.current = null
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Staff name is required'
    else if (form.name.length > 80) errs.name = 'Staff name must be 80 characters or less'
    if (!form.role.trim()) errs.role = 'Role is required'
    else if (form.role.length > 120) errs.role = 'Role must be 120 characters or less'
    if (!form.gather.trim()) errs.gather = 'Gather instructions are required'
    else if (form.gather.length > 2000) errs.gather = 'Gather must be 2000 characters or less'
    if (!form.execute.trim()) errs.execute = 'Execute instructions are required'
    else if (form.execute.length > 2000) errs.execute = 'Execute must be 2000 characters or less'
    if (!form.evaluate.trim()) errs.evaluate = 'Evaluate instructions are required'
    else if (form.evaluate.length > 2000) errs.evaluate = 'Evaluate must be 2000 characters or less'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form])

  // ─── Submit ───────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Partial<FormData>) => api.createStaff(data),
    onSuccess: (result) => {
      setSubmitState('success')
      queryClient.invalidateQueries({ queryKey: ['staffs'] })
      setTimeout(() => navigate(`/staffs/${result.id}`), 500)
    },
    onError: (err: Error) => {
      setSubmitState('error')
      setSubmitError(err.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormData>) => api.updateStaff(id!, data),
    onSuccess: () => {
      setSubmitState('success')
      queryClient.invalidateQueries({ queryKey: ['staffs'] })
      queryClient.invalidateQueries({ queryKey: ['staff', id] })
      setTimeout(() => navigate(`/staffs/${id}`), 500)
    },
    onError: (err: Error) => {
      setSubmitState('error')
      setSubmitError(err.message)
    }
  })

  const handleSubmit = useCallback(() => {
    if (!validate()) {
      // Scroll to first error
      setTimeout(() => {
        firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
      return
    }
    setSubmitState('submitting')
    setSubmitError(null)
    const payload = { ...form }
    if (isEditMode) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }, [form, isEditMode, validate, createMutation, updateMutation])

  // ─── Cancel with dirty check ──────────────────────────────────────

  const handleCancel = useCallback(() => {
    if (isDirty.current) {
      setShowDiscardDialog(true)
    } else {
      navigate(isEditMode ? `/staffs/${id}` : '/')
    }
  }, [isEditMode, id, navigate])

  const confirmDiscard = useCallback(() => {
    setShowDiscardDialog(false)
    navigate(isEditMode ? `/staffs/${id}` : '/')
  }, [isEditMode, id, navigate])

  // ─── Import from template ─────────────────────────────────────────

  const { data: templates } = useQuery({
    queryKey: ['registry-templates'],
    queryFn: () => api.getRegistryTemplates(),
    enabled: false
  })

  // ─── Loading State ────────────────────────────────────────────────

  if (isEditMode && staffLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const isFormDisabled = submitState === 'submitting'
  const isSubmitDisabled = isFormDisabled || (!form.name.trim() || !form.role.trim() || !form.gather.trim() || !form.execute.trim() || !form.evaluate.trim())

  const unselectedSkills = skills?.filter((s) => !form.skills.includes(s.name)) ?? []

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditMode ? 'Edit Staff' : 'Create Staff'}
          </h1>
        </div>

        {!isEditMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full">
                Import Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                queryClient.fetchQuery({ queryKey: ['registry-templates'], queryFn: () => api.getRegistryTemplates() })
                setRegistryDialogOpen(true)
              }}>
                Browse Registry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                // Use native file input (works in both Electron and web)
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const data = JSON.parse(text)
                    if (data.role) {
                      applyTemplate(data)
                      toast({ title: 'Template imported successfully' })
                    } else {
                      toast({ title: 'Invalid template', description: 'File does not contain a valid staff template', variant: 'destructive' })
                    }
                  } catch {
                    toast({ title: 'Import failed', description: 'Could not read or parse file', variant: 'destructive' })
                  }
                }
                input.click()
              }}>Import File</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Submit error banner */}
      {submitError && (
        <div className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to {isEditMode ? 'save' : 'create'} Staff. {submitError}
        </div>
      )}

      {/* Loop Visualization */}
      <LoopVisualization activePhase={activePhase} />

      {/* Identity Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="staff-name">
              Staff Name
            </label>
            <Input
              id="staff-name"
              name="name"
              placeholder="e.g., Meta Ads Creative Designer"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={isFormDisabled}
              className={cn(errors.name && 'border-destructive')}
              ref={(el) => { if (errors.name && !firstErrorRef.current) firstErrorRef.current = el }}
            />
            <div className="flex items-center justify-between">
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">A friendly name for this Staff</p>
              )}
              <span className={cn('text-xs', form.name.length > 70 ? 'text-destructive' : 'text-muted-foreground')}>
                {form.name.length}/80
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="staff-role">
              Role
            </label>
            <Input
              id="staff-role"
              name="role"
              placeholder="e.g., Meta ads creative designer"
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              disabled={isFormDisabled}
              className={cn(errors.role && 'border-destructive')}
              ref={(el) => { if (errors.role && !firstErrorRef.current) firstErrorRef.current = el }}
            />
            {errors.role ? (
              <p className="text-sm text-destructive">{errors.role}</p>
            ) : (
              <p className="text-sm text-muted-foreground">One-line job title describing what this Staff does</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* The Loop Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">The Loop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6 pl-10">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

            {/* Step 1: Gather */}
            <div className="relative space-y-2">
              <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-chart-1/10 text-sm font-bold text-chart-1">
                1
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Search className="h-4 w-4 text-chart-1" />
                Gather
              </label>
              <Textarea
                name="gather"
                rows={4}
                placeholder={"Where and how should this Staff collect information?\n\ne.g., Collect trending posts from Instagram and X for the last 3 days in our product category. Analyze visual styles, copy patterns, and hashtags of top 100 posts."}
                value={form.gather}
                onChange={(e) => updateField('gather', e.target.value)}
                onFocus={() => setActivePhase('gather')}
                onBlur={() => setActivePhase(null)}
                disabled={isFormDisabled}
                className={cn(errors.gather && 'border-destructive')}
              />
              {errors.gather ? (
                <p className="text-sm text-destructive">{errors.gather}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Tell your Staff where to look and what to collect</p>
              )}
            </div>

            {/* Step 2: Execute */}
            <div className="relative space-y-2">
              <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-chart-2/10 text-sm font-bold text-chart-2">
                2
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Zap className="h-4 w-4 text-chart-2" />
                Execute
              </label>
              <Textarea
                name="execute"
                rows={4}
                placeholder={"What specific work should this Staff perform?\n\ne.g., Create 3 ad creatives with A/B test variants per day, tailored to our product."}
                value={form.execute}
                onChange={(e) => updateField('execute', e.target.value)}
                onFocus={() => setActivePhase('execute')}
                onBlur={() => setActivePhase(null)}
                disabled={isFormDisabled}
                className={cn(errors.execute && 'border-destructive')}
              />
              {errors.execute ? (
                <p className="text-sm text-destructive">{errors.execute}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Describe the actual work to produce</p>
              )}
            </div>

            {/* Step 3: Evaluate */}
            <div className="relative space-y-2">
              <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-chart-3/10 text-sm font-bold text-chart-3">
                3
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BarChart3 className="h-4 w-4 text-chart-3" />
                Evaluate
              </label>
              <Textarea
                name="evaluate"
                rows={4}
                placeholder={"How should this Staff measure results and learn?\n\ne.g., Check CPI, CPM, CTR from Meta Ads dashboard. Analyze which patterns perform best and apply learnings."}
                value={form.evaluate}
                onChange={(e) => updateField('evaluate', e.target.value)}
                onFocus={() => setActivePhase('evaluate')}
                onBlur={() => setActivePhase(null)}
                disabled={isFormDisabled}
                className={cn(errors.evaluate && 'border-destructive')}
              />
              {errors.evaluate ? (
                <p className="text-sm text-destructive">{errors.evaluate}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Define how to measure performance and what to learn</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">KPI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="e.g., CPI < $2.00, CTR > 3%, daily creatives >= 3"
              value={form.kpi}
              onChange={(e) => updateField('kpi', e.target.value)}
              disabled={isFormDisabled}
            />
            <p className="text-sm text-muted-foreground">
              Long-term metrics tracked on the dashboard. These are not part of the loop instructions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Skills + Agent & Model (2-column) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Skills Card */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {form.skills.map((skillName) => (
                <Badge
                  key={skillName}
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-sm"
                >
                  {skillName}
                  <button
                    type="button"
                    onClick={() => removeSkill(skillName)}
                    disabled={isFormDisabled}
                    className="ml-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}

              <DropdownMenu open={skillsPopoverOpen} onOpenChange={setSkillsPopoverOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isFormDisabled}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Skill
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {unselectedSkills.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {skills?.length === 0
                        ? 'No Skills installed. Go to Skills to add some.'
                        : 'All installed Skills have been added.'}
                    </div>
                  ) : (
                    unselectedSkills.map((skill) => (
                      <DropdownMenuItem key={skill.name} onClick={() => addSkill(skill.name)}>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              skill.auth_status === 'active' ? 'bg-success' : 'bg-warning'
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium">{skill.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {skill.description}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Agent & Model Card */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Agent & Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Agent</label>
              <Select
                value={form.agent}
                onValueChange={handleAgentChange}
                disabled={isFormDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        {agent.name}
                        {!agent.installed && (
                          <Badge variant="outline" className="rounded-full text-xs">
                            Not Installed
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  )) ?? (
                    <SelectItem value="claude-code">Claude Code</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">The AI agent that powers this Staff</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Model</label>
              <Select
                value={form.model}
                onValueChange={(v) => updateField('model', v)}
                disabled={isFormDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_models" disabled>
                      No models available for selected agent
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">The AI model to use. Faster models cost less.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 z-50 -mx-6 border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          {submitState !== 'submitting' && (
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          <div className="ml-auto">
            <Button
              className="rounded-full"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              {submitState === 'submitting' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitState === 'success' && (
                <Check className="mr-2 h-4 w-4" />
              )}
              {submitState === 'submitting'
                ? (isEditMode ? 'Saving...' : 'Creating...')
                : submitState === 'success'
                  ? (isEditMode ? 'Saved!' : 'Created!')
                  : (isEditMode ? 'Save & Restart' : 'Create & Start')}
            </Button>
          </div>
        </div>
      </div>

      {/* Browse Registry Dialog */}
      <Dialog open={registryDialogOpen} onOpenChange={setRegistryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>
              Select a template to pre-fill the Staff form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {templates?.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer transition-colors hover:border-foreground/20"
                onClick={() => {
                  applyTemplate(t)
                  setRegistryDialogOpen(false)
                }}
              >
                <CardContent className="p-4">
                  <h4 className="font-semibold text-foreground">{t.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.role}</p>
                  <Badge variant="outline" className="mt-2 rounded-full text-xs">{t.category}</Badge>
                </CardContent>
              </Card>
            )) ?? (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-8">Loading templates...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
