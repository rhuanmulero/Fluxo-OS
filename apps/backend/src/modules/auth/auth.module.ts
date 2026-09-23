import { Module } from '@nestjs/common';
import { MailModule } from '../../common/mail/mail.module';
import { AuthController } from './auth.controller';
import { betterAuthProvider, BETTER_AUTH } from './better-auth/auth.handler';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [betterAuthProvider],
  exports: [BETTER_AUTH],
})
export class AuthModule {}
