import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Badge } from "../ui/badge";

export default function SearchBar() {
  return (
    <div className="flex items-center gap-3">
      <InputGroup className="h-12 flex-1 rounded-2xl">
        <InputGroupAddon align="inline-start" className="pl-3.5">
          <Search className="size-5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search medicines & supplements…" />
      </InputGroup>
      <Badge
        variant="outline"
        className="h-12 w-12 shrink-0 justify-center rounded-2xl text-sm font-semibold"
      >
        12
      </Badge>
    </div>
  );
}
