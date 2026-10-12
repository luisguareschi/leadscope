export const companySelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  operators: {
    select: { email: true },
    orderBy: { createdAt: "asc" as const },
  },
};

export type CompanyOperatorRow = { email: string };

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  operators: CompanyOperatorRow[];
};

/** What a platform admin may see. No secrets, no threads, no config. */
export function toCompanyDto(company: CompanyRow) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    createdAt: company.createdAt,
    operators: company.operators.map((operator) => ({
      email: operator.email,
    })),
  };
}

export type CompanyDto = ReturnType<typeof toCompanyDto>;
