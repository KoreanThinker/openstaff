import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Download,
  Loader2,
  Check,
  Lock,
  Unlock,
  WifiOff
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import type { RegistryTemplate, RegistrySkill } from '@shared/types'

type TabType = 'templates' | 'skills'

const categoryColors: Record<string, string> = {
  marketing: 'bg-chart-1/15',
  seo: 'bg-chart-2/15',
  dev: 'bg-chart-3/15',
  analytics: 'bg-chart-4/15',
  content: 'bg-chart-5/15',
  social: 'bg-chart-1/10',
  default: 'bg-muted'
}

function getGradient(category: string): string {
  return (
    categoryColors[category.toLowerCase()] || categoryColors.default
  )
}

function TemplateCard({
  template,
  onClick,
  onDownload
}: {
  template: RegistryTemplate
  onClick: () => void
  onDownload: () => void
}): React.ReactElement {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setDownloading(true)
      onDownload()
      // Reset state after navigation (component may unmount before this fires)
      setTimeout(() => setDownloading(false), 1500)
    },
    [onDownload]
  )

  const skillsDisplay = template.required_skills.slice(0, 2).join(', ')
  const extraSkills = template.required_skills.length - 2

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-foreground/20"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Gradient thumbnail */}
        <div
          className={cn(
            'flex h-32 items-center justify-center rounded-t-lg',
            getGradient(template.category)
          )}
        >
          <span className="text-3xl font-bold text-foreground/30">
            {template.name.charAt(0)}
          </span>
        </div>

        <div className="space-y-2 p-4">
          <h3 className="text-base font-semibold text-foreground">
            {template.name}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {template.role}
          </p>
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {template.category}
          </span>
          <p className="text-xs text-muted-foreground">
            Skills: {skillsDisplay}
            {extraSkills > 0 && ` +${extraSkills}`}
          </p>
          <Button
            className="w-full rounded-full"
            size="sm"
            disabled={downloading}
            onClick={handleDownload}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SkillRegistryCard({
  skill,
  isInstalled,
  onClick,
  onInstall
}: {
  skill: RegistrySkill
  isInstalled: boolean
  onClick: () => void
  onInstall: () => Promise<void> | void
}): React.ReactElement {
  const [installing, setInstalling] = useState(false)

  const handleInstall = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isInstalled || installing) return
      setInstalling(true)
      try {
        await onInstall()
      } finally {
        setInstalling(false)
      }
    },
    [isInstalled, installing, onInstall]
  )

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-foreground/20"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div
          className={cn(
            'flex h-32 items-center justify-center rounded-t-lg',
            getGradient(skill.category)
          )}
        >
          <span className="text-3xl font-bold text-foreground/30">
            {skill.name.charAt(0)}
          </span>
        </div>

        <div className="space-y-2 p-4">
          <h3 className="text-base font-semibold text-foreground">
            {skill.name}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {skill.description}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {skill.auth_required ? (
              <>
                <Lock className="h-3 w-3" />
                <span>Auth required</span>
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3" />
                <span>No auth required</span>
              </>
            )}
          </div>
          <Button
            className="w-full rounded-full"
            size="sm"
            variant={isInstalled ? 'outline' : 'default'}
            disabled={isInstalled || installing}
            onClick={handleInstall}
          >
            {installing ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Installing...
              </>
            ) : isInstalled ? (
              <>
                <Check className="mr-2 h-3.5 w-3.5" />
                Installed
              </>
            ) : (
              'Install'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CardSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-0">
        <Skeleton className="h-32 w-full rounded-t-lg" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function Registry(): React.ReactElement {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabType>('templates')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<RegistryTemplate | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<RegistrySkill | null>(null)

  const {
    data: registry,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['registry'],
    queryFn: api.getRegistry
  })

  const { data: installedSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: api.getSkills
  })

  const installedSkillNames = useMemo(
    () => new Set(installedSkills?.map((s) => s.name) || []),
    [installedSkills]
  )

  const categories = useMemo(() => {
    if (!registry) return ['all']
    const items =
      tab === 'templates' ? registry.templates : registry.skills
    const cats = new Set(items.map((item) => item.category))
    return ['all', ...Array.from(cats)]
  }, [registry, tab])

  const filteredTemplates = useMemo(() => {
    if (!registry) return []
    return registry.templates.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.role.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      const matchCategory =
        selectedCategory === 'all' || t.category === selectedCategory
      return matchSearch && matchCategory
    })
  }, [registry, search, selectedCategory])

  const filteredSkills = useMemo(() => {
    if (!registry) return []
    return registry.skills.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase())
      const matchCategory =
        selectedCategory === 'all' || s.category === selectedCategory
      return matchSearch && matchCategory
    })
  }, [registry, search, selectedCategory])

  const handleTemplateDownload = useCallback(
    (template: RegistryTemplate) => {
      navigate('/staffs/new', { state: { template } })
    },
    [navigate]
  )

  const handleOpenTemplateDetail = useCallback((template: RegistryTemplate) => {
    setSelectedTemplate(template)
    setSelectedSkill(null)
    setDetailOpen(true)
  }, [])

  const handleOpenSkillDetail = useCallback((skill: RegistrySkill) => {
    setSelectedSkill(skill)
    setSelectedTemplate(null)
    setDetailOpen(true)
  }, [])

  const handleSkillInstall = useCallback(async (skillName: string) => {
    try {
      await api.installRegistrySkill(skillName)
      await queryClient.invalidateQueries({ queryKey: ['skills'] })
      toast({ title: `Skill "${skillName}" installed` })
    } catch (err) {
      toast({
        title: 'Install failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }, [queryClient])

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Registry</h1>
      </div>

      {/* Search + Tab toggle */}
      <div className="flex flex-col gap-3 px-6 pb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates and skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <button
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === 'templates'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            onClick={() => {
              setTab('templates')
              setSelectedCategory('all')
            }}
          >
            Templates
          </button>
          <button
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === 'skills'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            onClick={() => {
              setTab('skills')
              setSelectedCategory('all')
            }}
          >
            Skills
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto px-6 pb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              selectedCategory === cat
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16">
            <WifiOff className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-foreground">
              Unable to connect to the registry.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your internet connection and try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && tab === 'templates' && (
          <>
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  No results found{search ? ` for "${search}"` : ''}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term or{' '}
                  <button
                    className="text-foreground underline"
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory('all')
                    }}
                  >
                    browse all templates
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onClick={() => handleOpenTemplateDetail(template)}
                    onDownload={() => handleTemplateDownload(template)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && !isError && tab === 'skills' && (
          <>
            {filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  No results found{search ? ` for "${search}"` : ''}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term or{' '}
                  <button
                    className="text-foreground underline"
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory('all')
                    }}
                  >
                    browse all skills
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSkills.map((skill) => (
                  <SkillRegistryCard
                    key={skill.name}
                    skill={skill}
                    isInstalled={installedSkillNames.has(skill.name)}
                    onClick={() => handleOpenSkillDetail(skill)}
                    onInstall={() => handleSkillInstall(skill.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail slide-over */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selectedTemplate && (
            <div className="flex flex-col gap-5">
              <div
                className={cn(
                  'flex h-40 items-center justify-center rounded-lg',
                  getGradient(selectedTemplate.category)
                )}
              >
                <span className="text-4xl font-bold text-foreground/30">
                  {selectedTemplate.name.charAt(0)}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedTemplate.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.role}
                </p>
                <span className="mt-2 inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {selectedTemplate.category}
                </span>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Gather
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.gather}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Execute
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.execute}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Evaluate
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.evaluate}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  KPI
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedTemplate.kpi}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Required Skills
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTemplate.required_skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Recommended
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agent: {selectedTemplate.recommended_agent} / Model:{' '}
                  {selectedTemplate.recommended_model}
                </p>
              </div>

              <Button
                className="w-full rounded-full"
                onClick={() => {
                  setDetailOpen(false)
                  handleTemplateDownload(selectedTemplate)
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          )}

          {selectedSkill && (
            <div className="flex flex-col gap-5">
              <div
                className={cn(
                  'flex h-40 items-center justify-center rounded-lg',
                  getGradient(selectedSkill.category)
                )}
              >
                <span className="text-4xl font-bold text-foreground/30">
                  {selectedSkill.name.charAt(0)}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedSkill.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  v{selectedSkill.version} by {selectedSkill.author}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Description
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSkill.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Authentication
                </h3>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {selectedSkill.auth_required ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        Required:{' '}
                        {selectedSkill.required_env_vars.join(', ') ||
                          'Credentials needed'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5" />
                      <span>No authentication required</span>
                    </>
                  )}
                </div>
              </div>

              <Button
                className="w-full rounded-full"
                variant={
                  installedSkillNames.has(selectedSkill.name)
                    ? 'outline'
                    : 'default'
                }
                disabled={installedSkillNames.has(selectedSkill.name)}
                onClick={() => handleSkillInstall(selectedSkill.name)}
              >
                {installedSkillNames.has(selectedSkill.name) ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Installed
                  </>
                ) : (
                  'Install'
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
