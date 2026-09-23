import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { EnvironmentVariables } from '../config/environment-variables';
import { MAIL_FROM, MAIL_TRANSPORT, MailerService } from './mailer.service';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createTransport({
          host: config.get('SMTP_HOST', { infer: true }),
          port: config.get('SMTP_PORT', { infer: true }),
          secure: config.get('SMTP_PORT', { infer: true }) === 465,
          auth: {
            user: config.get('SMTP_USER', { infer: true }),
            pass: config.get('SMTP_PASSWORD', { infer: true }),
          },
        }),
    },
    {
      provide: MAIL_FROM,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): string =>
        config.get('SMTP_FROM', { infer: true }),
    },
    MailerService,
  ],
  exports: [MailerService],
})
export class MailModule {}
