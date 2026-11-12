import { DisabledState } from "@/features/share/states";

/** Unknown token: the same calm page, with no brand (we do not know the agency). */
export default function ShareNotFound() {
  return <DisabledState agency={null} />;
}
