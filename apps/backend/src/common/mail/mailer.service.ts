import { Inject, Injectable } from '@nestjs/common';

export const MAIL_TRANSPORT = Symbol('MailTransport');
export const MAIL_FROM = Symbol('MailFrom');

export interface MailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailerService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(MAIL_FROM) private readonly from: string,
  ) {}

  async send(message: Message): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
