type Props = {
  message?: string;
};

export function BuilderPageLoading({
  message = "Loading floor builder…",
}: Props) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[#fafbfc]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
