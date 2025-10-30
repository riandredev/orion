import { Order as ChurchOrder } from '@/components/church-order'
import { RecentActivity } from '@/components/recent-activity'
import VerseSelector from '@/components/verse-selector'
import { Projection } from '@/components/projection'
import HymnSelector from '@/components/hymn-selector'
import { Separator } from '@/components/ui/separator'

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <HymnSelector />
      </div>
      <div className="my-6 -ml-6 w-[calc(100%+3rem)]">
        <Separator />
      </div>
      <div className="flex gap-4 items-start">
        {/* Projection */}
        <div className="w-[30rem]">
          <Projection />
        </div>

        {/* Church order */}
        <div className="flex-1 basis-0 min-w-0">
          <ChurchOrder />
        </div>

        {/* Recent activity */}
        <div className="w-[30rem]">
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
