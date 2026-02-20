import React, { useState, useMemo, useCallback, useEffect, createElement } from 'react'
import Markdown from 'react-markdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Puzzle,
  Search,
  MoreHorizontal,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Trash2,
  FolderOpen,
  AlertTriangle
} from 'lucide-react'
import { api } from '@/lib/api'
import { useHeaderActionStore } from '@/stores/header-action-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import type { SkillInfo, SkillAuthStatus } from '@shared/types'

type FilterStatus = 'all' | 'active' | 'needs_auth'

const statusConfig: Record<
  SkillAuthStatus,
  { label: string; className: string }
> = {
  active: { label: 'Active', className: 'bg-success/15 text-success' },
  needs_auth: {
    label: 'Needs Auth',
    className: 'bg-warning/15 text-warning'
  },
  not_configured: {
    label: 'Not Configured',
    className: 'bg-muted text-muted-foreground'
  }
}

function SkillIcon({ name }: { name: string }): React.ReactElement {
  const letter = name.charAt(0).toUpperCase()
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
      <span className="text-foreground text-sm font-semibold">{letter}</span>
    </div>
  )
}

function SkillStatusBadge({
  status
}: {
  status: SkillAuthStatus
}): React.ReactElement {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

function SkillCardSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <Skeleton className="mt-3 h-5 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-4/5" />
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

export function Skills(): React.ReactElement {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skillToDelete, setSkillToDelete] = useState<SkillInfo | null>(null)
  const [authValues, setAuthValues] = useState<Record<string, string>>({})
  const [showAuthValues, setShowAuthValues] = useState<Record<string, boolean>>(
    {}
  )
  const setActionButton = useHeaderActionStore((s) => s.setActionButton)

  useEffect(() => {
    setActionButton(
      createElement(Button, {
        size: 'sm',
        className: 'rounded-full gap-2',
        onClick: () => setAddModalOpen(true)
      }, '+ Add Skill')
    )
    return () => setActionButton(null)
  }, [setActionButton])

  const {
    data: skills,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['skills'],
    queryFn: api.getSkills
  })

  const deleteSkillMutation = useMutation({
    mutationFn: (name: string) => api.deleteSkill(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      setDeleteDialogOpen(false)
      setSkillToDelete(null)
      if (selectedSkill && skillToDelete?.name === selectedSkill.name) {
        setDetailOpen(false)
        setSelectedSkill(null)
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete skill', description: err.message, variant: 'destructive' })
    }
  })

  const saveAuthMutation = useMutation({
    mutationFn: ({ name, envVars }: { name: string; envVars: Record<string, string> }) =>
      api.updateSkillAuth(name, envVars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      toast({ title: 'Credentials saved' })
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save credentials', description: err.message, variant: 'destructive' })
    }
  })

  const filteredSkills = useMemo(() => {
    if (!skills) return []
    return skills.filter((skill) => {
      const matchesSearch =
        !search ||
        skill.name.toLowerCase().includes(search.toLowerCase()) ||
        skill.description.toLowerCase().includes(search.toLowerCase())
      const matchesFilter =
        filter === 'all' || skill.auth_status === filter
      return matchesSearch && matchesFilter
    })
  }, [skills, search, filter])

  const handleOpenDetail = useCallback((skill: SkillInfo) => {
    setSelectedSkill(skill)
    setDetailOpen(true)
    const initialAuth: Record<string, string> = {}
    skill.required_env_vars.forEach((v) => {
      initialAuth[v] = ''
    })
    setAuthValues(initialAuth)
    setShowAuthValues({})
  }, [])

  const handleDeleteClick = useCallback(
    (skill: SkillInfo, e?: React.MouseEvent) => {
      e?.stopPropagation()
      setSkillToDelete(skill)
      setDeleteDialogOpen(true)
    },
    []
  )

  const handleSaveAuth = useCallback(() => {
    if (!selectedSkill) return
    const nonEmpty: Record<string, string> = {}
    for (const [key, val] of Object.entries(authValues)) {
      if (val.trim()) nonEmpty[key] = val.trim()
    }
    if (Object.keys(nonEmpty).length > 0) {
      saveAuthMutation.mutate({ name: selectedSkill.name, envVars: nonEmpty })
    }
  }, [selectedSkill, authValues, saveAuthMutation])

  // Empty state
  if (!isLoading && !isError && skills && skills.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-6 pb-0">
          <h1 className="text-2xl font-semibold text-foreground">Skills</h1>
          <Button onClick={() => setAddModalOpen(true)}>+ Add Skill</Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <Puzzle className="h-16 w-16 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No skills installed yet
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Skills give your Staff superpowers -- connecting them to APIs, data
            sources, and tools they need to do their job.
          </p>
          <Button className="mt-6" onClick={() => setAddModalOpen(true)}>
            + Add Your First Skill
          </Button>
        </div>
        <AddSkillModal open={addModalOpen} onOpenChange={setAddModalOpen} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Skills</h1>
        <Button onClick={() => setAddModalOpen(true)}>+ Add Skill</Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 px-6 pb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'needs_auth'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Needs Auth'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Could not load skills.</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && filteredSkills.length === 0 && search && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              No skills match your search.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term or clear filters.
            </p>
          </div>
        )}

        {!isLoading && !isError && filteredSkills.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredSkills.map((skill) => (
              <Card
                key={skill.name}
                className="cursor-pointer transition-colors hover:border-foreground/20"
                onClick={() => handleOpenDetail(skill)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <SkillIcon name={skill.name} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Skill options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(skill)
                          }}
                        >
                          Configure Auth
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) =>
                            handleDeleteClick(skill, e)
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="mt-3 text-base font-medium text-foreground">
                    {skill.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {skill.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <SkillStatusBadge status={skill.auth_status} />
                    <span className="text-sm text-muted-foreground">
                      {skill.connected_staffs.length} Staff using
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selectedSkill && (
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setDetailOpen(false)}
                  aria-label="Close skill details"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteClick(selectedSkill)}
                  aria-label="Delete skill"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <SkillIcon name={selectedSkill.name} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedSkill.name}
                    </h2>
                    <SkillStatusBadge status={selectedSkill.auth_status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    v{selectedSkill.version} by {selectedSkill.author}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Description
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedSkill.description}
                </p>
                {selectedSkill.content && (
                  <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{selectedSkill.content}</Markdown>
                  </div>
                )}
              </div>

              {/* Authentication */}
              {selectedSkill.required_env_vars.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                      Authentication
                    </h3>
                    <div className="mt-3 space-y-3">
                      {selectedSkill.required_env_vars.map((envVar) => (
                        <div key={envVar}>
                          <Label className="text-xs text-muted-foreground">
                            {envVar}
                          </Label>
                          <div className="mt-1 flex gap-2">
                            <Input
                              type={
                                showAuthValues[envVar] ? 'text' : 'password'
                              }
                              placeholder="*****"
                              value={authValues[envVar] || ''}
                              onChange={(e) =>
                                setAuthValues((prev) => ({
                                  ...prev,
                                  [envVar]: e.target.value
                                }))
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Toggle visibility"
                              onClick={() =>
                                setShowAuthValues((prev) => ({
                                  ...prev,
                                  [envVar]: !prev[envVar]
                                }))
                              }
                            >
                              {showAuthValues[envVar] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Values are encrypted and stored securely using your OS
                      keychain.
                    </p>
                    <Button
                      className="mt-3"
                      onClick={handleSaveAuth}
                      disabled={saveAuthMutation.isPending}
                    >
                      {saveAuthMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save Credentials
                    </Button>
                  </div>
                </>
              )}

              {/* Connected Staff */}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Connected Staff
                </h3>
                {selectedSkill.connected_staffs.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No Staff are using this skill.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selectedSkill.connected_staffs.map((staffName) => (
                      <li
                        key={staffName}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        {staffName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Source */}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Source
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedSkill.source === 'local'
                    ? 'Local import'
                    : 'GitHub Registry'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Installed{' '}
                  {new Date(selectedSkill.installed_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Skill Modal */}
      <AddSkillModal open={addModalOpen} onOpenChange={setAddModalOpen} />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{skillToDelete?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          {skillToDelete &&
            skillToDelete.connected_staffs.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    This skill is currently used by:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {skillToDelete.connected_staffs.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    Deleting will remove this skill from all connected Staff.
                    Running Staff will be restarted without this skill.
                  </p>
                </div>
              </div>
            )}
          {skillToDelete &&
            skillToDelete.connected_staffs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSkillMutation.isPending}
              onClick={() =>
                skillToDelete && deleteSkillMutation.mutate(skillToDelete.name)
              }
            >
              {deleteSkillMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddSkillModal({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactElement {
  const [tab, setTab] = useState<'local' | 'registry'>('local')
  const [localPath, setLocalPath] = useState('')
  const queryClient = useQueryClient()

  const importMutation = useMutation({
    mutationFn: (path: string) => api.importSkill(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      onOpenChange(false)
      setLocalPath('')
    },
    onError: (err: Error) => {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' })
    }
  })

  const installRegistryMutation = useMutation({
    mutationFn: (name: string) => api.installRegistrySkill(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (err: Error) => {
      toast({ title: 'Install failed', description: err.message, variant: 'destructive' })
    }
  })

  const { data: registrySkills, isLoading: registryLoading } = useQuery({
    queryKey: ['registry-skills'],
    queryFn: api.getRegistrySkills,
    enabled: open && tab === 'registry'
  })

  const { data: installedSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: api.getSkills,
    enabled: open
  })

  const installedNames = useMemo(
    () => new Set(installedSkills?.map((s) => s.name) || []),
    [installedSkills]
  )

  const handleBrowse = useCallback(async () => {
    if (window.api?.selectDirectory) {
      const result = await window.api.selectDirectory()
      if (result) setLocalPath(result)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <button
            aria-pressed={tab === 'local'}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === 'local'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            onClick={() => setTab('local')}
          >
            Local Import
          </button>
          <button
            aria-pressed={tab === 'registry'}
            className={cn(
              'flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === 'registry'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            onClick={() => setTab('registry')}
          >
            GitHub Registry
          </button>
        </div>

        {tab === 'local' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a skill directory that contains a SKILL.md file.
            </p>
            <div className="flex gap-2">
              <Input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="Path to skill directory"
                className="flex-1"
              />
              <Button variant="outline" onClick={handleBrowse}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={!localPath.trim() || importMutation.isPending}
                onClick={() => importMutation.mutate(localPath)}
              >
                {importMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import Skill
              </Button>
            </DialogFooter>
          </div>
        )}

        {tab === 'registry' && (
          <div className="space-y-3">
            {registryLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            )}
            {!registryLoading && registrySkills && (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {registrySkills.map((skill) => {
                  const isInstalled = installedNames.has(skill.name)
                  return (
                    <div
                      key={skill.name}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {skill.name}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isInstalled ? 'outline' : 'default'}
                        disabled={isInstalled || installRegistryMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isInstalled) installRegistryMutation.mutate(skill.name)
                        }}
                      >
                        {installRegistryMutation.isPending ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {isInstalled ? 'Installed' : 'Install'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
