import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Label } from "@/components/ui/label"

export function Pattern() {
  return (
    <Field orientation="horizontal" className="mx-auto w-auto">
      <Checkbox id="label-demo-terms" />
      <Label htmlFor="label-demo-terms">Accept terms and conditions</Label>
    </Field>
  )
}