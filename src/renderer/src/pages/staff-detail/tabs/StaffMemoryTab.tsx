import Markdown from 'react-markdown'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

export function StaffMemoryTab({ staffId }: { staffId: string }): React.ReactElement {
  const { data: memory, isLoading } = useQuery({
    queryKey: ['staff-memory', staffId],
    queryFn: () => api.getStaffMemory(staffId),
    refetchInterval: 30_000
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!memory?.content) {
    return (
      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="mb-1 text-sm font-medium text-foreground">No learnings yet</p>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            The agent will write learnings to memory.md after its first Evaluate cycle.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-lg">Agent Memory</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown>{memory.content}</Markdown>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
