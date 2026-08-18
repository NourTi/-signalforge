export type ExportableLead = {
  companyName: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  contactEmail: string | null;
  status: string;
  createdAt: Date;
};

export const leadExportColumns = ["companyName", "website", "industry", "country", "contactEmail", "status", "createdAt"] as const;

export function toSafeLeadExport(lead: ExportableLead) {
  return {
    companyName: lead.companyName,
    website: lead.website,
    industry: lead.industry,
    country: lead.country,
    contactEmail: lead.contactEmail,
    status: lead.status,
    createdAt: lead.createdAt,
  };
}
