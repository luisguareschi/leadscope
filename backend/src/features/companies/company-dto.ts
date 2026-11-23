export const companySelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  archivedAt: true,
  assistantPaused: true,
  assistantPausedAt: true,
  assistantPausedByEmail: true,
  operators: {
    select: { id: true, email: true, archivedAt: true },
    orderBy: { createdAt: "asc" as const },
  },
};

export type CompanyOperatorRow = {
  id: string;
  email: string;
  archivedAt: Date | null;
};

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  archivedAt: Date | null;
  assistantPaused: boolean;
  assistantPausedAt: Date | null;
  assistantPausedByEmail: string | null;
  operators: CompanyOperatorRow[];
};

/** What a platform admin may see. No secrets, no threads, no config. */
export function toCompanyDto(company: CompanyRow) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    createdAt: company.createdAt,
    archivedAt: company.archivedAt,
    assistantPaused: company.assistantPaused,
    assistantPausedAt: company.assistantPausedAt,
    assistantPausedByEmail: company.assistantPausedByEmail,
    operators: company.operators.map((operator) => ({
      id: operator.id,
      email: operator.email,
      archived: operator.archivedAt !== null,
    })),
  };
}

export type CompanyDto = ReturnType<typeof toCompanyDto>;
