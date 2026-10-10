export type SendTextInput = {
  to: string;
  body: string;
  phoneNumberId: string;
  accessToken: string;
};

export type SendTemplateInput = {
  to: string;
  templateName: string;
  language: string;
  phoneNumberId: string;
  accessToken: string;
};

export interface Channel {
  sendText(input: SendTextInput): Promise<{ messageId: string | null }>;
  sendTemplate(input: SendTemplateInput): Promise<{ messageId: string | null }>;
}

export class FakeChannel implements Channel {
  readonly sent: ({ kind: "text"; body: string } | { kind: "template"; templateName: string })[] = [];

  async sendText(input: SendTextInput): Promise<{ messageId: string | null }> {
    this.sent.push({ kind: "text", body: input.body });
    return { messageId: `fake-text-${this.sent.length}` };
  }

  async sendTemplate(input: SendTemplateInput): Promise<{ messageId: string | null }> {
    this.sent.push({ kind: "template", templateName: input.templateName });
    return { messageId: `fake-template-${this.sent.length}` };
  }
}
