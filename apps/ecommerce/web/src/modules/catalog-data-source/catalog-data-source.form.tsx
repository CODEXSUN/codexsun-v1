import { DatabaseIcon, ServerIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@codexsun/ui/components/radio-group";
import type {
  CatalogDataSourceModule,
  CatalogDataSourceProvider,
  CatalogModuleDataSource
} from "./catalog-data-source.types";

export function CatalogDataSourceForm({
  busy,
  frappeConfigured,
  item,
  onChange
}: {
  busy: boolean;
  frappeConfigured: boolean;
  item: CatalogModuleDataSource;
  onChange: (module: CatalogDataSourceModule, provider: CatalogDataSourceProvider) => void;
}) {
  return (
    <RadioGroup
      aria-label={`${item.label} data source`}
      className="grid grid-cols-2 gap-4"
      disabled={busy}
      onValueChange={(provider) => onChange(item.module, provider as CatalogDataSourceProvider)}
      value={item.provider}
    >
      <SourceOption icon={DatabaseIcon} label="Local projection" value="own" />
      <SourceOption
        disabled={!frappeConfigured}
        icon={ServerIcon}
        label="Frappe import"
        value="frappe"
      />
    </RadioGroup>
  );
}

function SourceOption({
  disabled = false,
  icon: Icon,
  label,
  value
}: {
  disabled?: boolean;
  icon: typeof DatabaseIcon;
  label: string;
  value: CatalogDataSourceProvider;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
      <RadioGroupItem disabled={disabled} value={value} />
      <Icon className="size-4" />
      <span>{label}</span>
    </label>
  );
}
