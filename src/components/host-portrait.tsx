import { cn } from "@/lib/utils";
import { hosts } from "@/data/show";

type Host = (typeof hosts)["dan"];

export function HostPortrait({
  host,
  className,
}: {
  host: Host;
  className?: string;
}) {
  return (
    <img
      src={host.photo}
      alt={`${host.name}, host of SpaceBat`}
      className={cn("aspect-[2/3] w-full object-cover object-top", className)}
    />
  );
}
