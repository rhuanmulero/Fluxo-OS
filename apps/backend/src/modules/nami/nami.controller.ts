import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { NamiMessageDto, NamiSettingsDto } from './dto/nami.dto';
import { NamiService } from './nami.service';

@Controller('me/nami')
@UseGuards(AuthGuard)
export class NamiController {
  constructor(private readonly nami: NamiService) {}
  @Get('settings') settings(@CurrentUser() user: AuthenticatedUser) { return this.nami.settings(user.id); }
  @Put('settings') save(@CurrentUser() user: AuthenticatedUser, @Body() dto: NamiSettingsDto) { return this.nami.saveSettings(user.id, dto); }
  @Delete('settings') @HttpCode(204) removeKey(@CurrentUser() user: AuthenticatedUser) { return this.nami.removeSettings(user.id); }
  @Get('conversations') list(@CurrentUser() user: AuthenticatedUser) { return this.nami.list(user.id); }
  @Get('conversations/:id') conversation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.nami.conversation(user.id, id); }
  @Delete('conversations/:id') @HttpCode(204) remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.nami.removeConversation(user.id, id); }
  @Post('messages')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: NamiMessageDto) { return this.nami.send(user.id, dto); }
}
