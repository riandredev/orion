import { Progress } from "@/components/ui/progress"

interface LoaderProps {
  message: string;
  progress: number;
}

export function Loader({ message, progress }: LoaderProps) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Progress value={progress} />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
