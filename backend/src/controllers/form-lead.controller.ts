import { Router } from "express";
import { z } from "zod";
import { acceptFormLead, FormLeadDeps } from "../services/form-lead.service";

const formSchema = z.object({
  phone: z.string().min(1),
  email: z.string().email().optional(),
  hubspotContactId: z.string().min(1).optional(),
});

export function formLeadRouter(deps: FormLeadDeps) {
  const router = Router();

  router.post("/form-lead", async (req, res) => {
    const parsed = formSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    const result = await acceptFormLead(deps, {
      secret: req.header("x-form-lead-secret") ?? "",
      ...parsed.data,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json({ ok: true });
  });

  return router;
}
