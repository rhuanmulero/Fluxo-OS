import { readCreation } from './nami-creation';
import { NamiProjectContextService } from './nami-project-context.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { NamiKeyService } from './nami-key.service';
import { GeminiService } from './gemini.service';
import { NamiMessageDto, NamiSettingsDto, UpdateNamiConversationDto } from './dto/nami.dto';

export const DEFAULT_NAMI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class NamiService {
  private readonly busy = new Set<string>();
  constructor(private readonly prisma: PrismaService, private readonly keys: NamiKeyService, private readonly gemini: GeminiService, private readonly projects: NamiProjectContextService) {}

  async settings(userId: string) {
    const saved = await this.prisma.namiSettings.findUnique({ where: { userId } });
    return { configured: Boolean(saved), model: saved?.model ?? DEFAULT_NAMI_MODEL };
  }

  async saveSettings(userId: string, dto: NamiSettingsDto) {
    const saved = await this.prisma.namiSettings.findUnique({ where: { userId } });
    if (!saved && !dto.apiKey) throw new BadRequestException('Informe sua chave do Gemini.');
    const encryptedKey = dto.apiKey ? this.keys.encrypt(dto.apiKey) : saved!.encryptedKey;
    await this.prisma.namiSettings.upsert({ where: { userId }, create: { userId, encryptedKey, model: dto.model }, update: { encryptedKey, model: dto.model } });
    return this.settings(userId);
  }

  async removeSettings(userId: string) {
    await this.prisma.namiSettings.deleteMany({ where: { userId } });
  }

  list(userId: string) {
    return this.prisma.namiConversation.findMany({ where: { userId }, orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }], take: 100, select: { id: true, title: true, pinned: true, updatedAt: true } });
  }

  async conversation(userId: string, id: string) {
    const conversation = await this.prisma.namiConversation.findFirst({ where: { id, userId }, include: { messages: { orderBy: { position: 'asc' } } } });
    if (!conversation) throw new NotFoundException('Conversa não encontrada.');
    return conversation;
  }

  async updateConversation(userId: string, id: string, dto: UpdateNamiConversationDto) {
    if (dto.title === undefined && dto.pinned === undefined) {
      throw new BadRequestException('Informe uma alteração para a conversa.');
    }
    const result = await this.prisma.namiConversation.updateMany({ where: { id, userId }, data: dto });
    if (!result.count) throw new NotFoundException('Conversa não encontrada.');
  }

  async removeConversation(userId: string, id: string) {
    const result = await this.prisma.namiConversation.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Conversa não encontrada.');
  }

  async send(userId: string, dto: NamiMessageDto) {
    if (this.busy.has(userId)) throw new ConflictException('Aguarde a resposta anterior da Nami.');
    this.busy.add(userId);
    try {
      const settings = await this.prisma.namiSettings.findUnique({ where: { userId } });
      if (!settings) throw new BadRequestException('Configure sua chave do Gemini para conversar com a Nami.');
      const conversation = dto.conversationId ? await this.conversation(userId, dto.conversationId) : null;
      const history = conversation?.messages ?? [];
      if (history.length >= 200) throw new BadRequestException('Esta conversa atingiu o limite. Inicie uma nova conversa.');
      const context = dto.projectId ? await this.projects.read(userId, dto.projectId) : undefined;
      const messages = [
        ...history.slice(-40).map(({ role, content }) => ({ role, content })),
        { role: 'user', content: dto.message },
      ];
      const args = [this.keys.decrypt(settings.encryptedKey), settings.model, messages] as const;
      const answer = context ? await this.gemini.reply(...args, JSON.stringify(context)) : await this.gemini.reply(...args);
      const creation = readCreation(answer);
      // Persistimos o par apenas após sucesso: falhas não deixam mensagens incompletas.
      const saved = await this.prisma.$transaction(async tx => {
        const target = conversation
          ? await tx.namiConversation.update({ where: { id: conversation.id, userId }, data: { updatedAt: new Date() } })
          : await tx.namiConversation.create({ data: { userId, title: dto.message.slice(0, 80) } });
        await tx.namiMessage.createMany({ data: [
          { conversationId: target.id, role: 'user', content: dto.message, position: history.length },
          { conversationId: target.id, role: 'model', content: creation.text, position: history.length + 1 },
        ] });
        return tx.namiConversation.findUniqueOrThrow({ where: { id: target.id }, include: { messages: { orderBy: { position: 'asc' } } } });
      });
      return { ...saved, ...(creation.proposal ? { creation: creation.proposal } : {}) };
    } finally { this.busy.delete(userId); }
  }
}
