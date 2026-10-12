import { Search } from "lucide-react";
import { Field } from "../ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Badge } from "../ui/badge";

export default function SearchBar() {
  return (
    <Field orientation={"horizontal"}>
      <InputGroup className="max-w-xs whitespace-nowrap h-10 rounded-full">
        <InputGroupInput placeholder="e.g. Paracetamol, Ibuprofen, etc." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
      <Badge variant="secondary" className="ml-auto h-10 w-10">
        12
      </Badge>
    </Field>
  );
}
