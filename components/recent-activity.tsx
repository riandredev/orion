import { Icon, Card } from '@gravity-ui/uikit'
import { ClockArrowRotateLeft } from '@gravity-ui/icons'

export function RecentActivity() {
  return (
    <div className="w-full">
      <div className="flex justify-start items-center gap-3">
        <Icon data={ClockArrowRotateLeft} size={20} />
        <span className="text-foreground text-base font-medium">Activity</span>
      </div>
      <Card className="h-72 w-full mt-3 bg-card-background border border-border p-4 flex flex-col justify-center items-center">
        <Icon data={ClockArrowRotateLeft} size={28} />
        <span className="text-sm font-medium mt-2">No activity</span>
      </Card>
    </div>
  );
}
