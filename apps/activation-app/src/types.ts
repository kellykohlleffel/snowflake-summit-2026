export interface IndustryConfig {
  id: string;
  label: string;
  description: string;
  color: string;
  columns?: ColumnDef[]; // Optional — columns derived dynamically from data if not specified
}

export interface ColumnDef {
  key: string;
  label: string;
  format?: "number" | "percent" | "badge";
}

export interface ActivationRecord {
  [key: string]: string | number | boolean;
}

export interface ActivationData {
  title: string;
  source: string;
  records: ActivationRecord[];
  activated_at: string;
}

// Industry configurations — columns are derived dynamically from the activation data
export const INDUSTRIES: IndustryConfig[] = [
  { id: "pharma", label: "Pharma", description: "Clinical Trials Risk Analysis", color: "emerald" },
  { id: "retail", label: "Retail", description: "Customer Re-engagement", color: "blue" },
  { id: "hed", label: "Higher Ed", description: "Student Retention", color: "purple" },
  { id: "financial", label: "Financial", description: "Financial Analytics", color: "amber" },
  { id: "agriculture", label: "Agriculture", description: "Livestock Weather Risk", color: "lime" },
  { id: "healthcare", label: "Healthcare", description: "Clinical Decision Support", color: "rose" },
  { id: "supply_chain", label: "Supply Chain", description: "Demand Intelligence", color: "cyan" },
];
