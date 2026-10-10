export function buildCrmSummary(input: {
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  email: string | null;
  messages: { direction: "in" | "out"; body: string }[];
}): string {
  const knows = input.knowsProjects == null ? "" : input.knowsProjects ? "sí" : "no";
  const lines = [
    `Interés: ${input.interest ?? ""}`,
    `Presupuesto: ${input.budget ?? ""}`,
    `Conoce los proyectos: ${knows}`,
    `Horario de llamada: ${input.callTime ?? ""}`,
  ];
  if (input.email) lines.push(`Email: ${input.email}`);
  lines.push("", "Transcripción:");
  for (const message of input.messages) {
    lines.push(`${message.direction === "in" ? "Lead" : "Asistente"}: ${message.body}`);
  }
  return lines.join("\n");
}
