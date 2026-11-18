import type { LoadedCompany } from "../companies/load-company.js";
import type { TurnRules } from "../engine/types.js";

/** What `decideTurn` needs from a company's config. */
export function rulesFor(company: LoadedCompany): TurnRules {
  return {
    maxReplyChars: company.config.maxReplyChars,
    collect: company.config.collect,
    messages: company.config.messages,
  };
}
