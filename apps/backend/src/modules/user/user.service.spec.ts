import { UserProfile } from '@prisma/client';
import { UserService } from './user.service';
import { ProfileChanges, UserProfileRepository } from './user-profile.repository.interface';

function profileOf(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'p1',
    userId: 'u1',
    jobTitle: 'Engenheiro de Software',
    bio: null,
    stack: ['TypeScript'],
    bannerUrl: null,
    themeColor: '#8b5cf6',
    vibe: null,
    status: 'ONLINE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeUserProfileRepository implements UserProfileRepository {
  saved: ProfileChanges | null = null;

  constructor(private stored: UserProfile | null) {}

  findByUserId(): Promise<UserProfile | null> {
    return Promise.resolve(this.stored);
  }

  upsert(userId: string, changes: ProfileChanges): Promise<UserProfile> {
    this.saved = changes;
    this.stored = profileOf({ userId, ...changes });
    return Promise.resolve(this.stored);
  }
}

describe('UserService', () => {
  it('devolve um perfil vazio quando o usuário ainda não tem um', async () => {
    const service = new UserService(new FakeUserProfileRepository(null));

    const profile = await service.profileOf('u1');

    expect(profile.status).toBe('ONLINE');
    expect(profile.stack).toEqual([]);
  });

  it('devolve o perfil existente', async () => {
    const service = new UserService(new FakeUserProfileRepository(profileOf()));

    const profile = await service.profileOf('u1');

    expect(profile.jobTitle).toBe('Engenheiro de Software');
    expect(profile.stack).toEqual(['TypeScript']);
  });

  it('grava as alterações recebidas', async () => {
    const repository = new FakeUserProfileRepository(null);
    const service = new UserService(repository);

    await service.updateProfile('u1', { bio: 'Focado em backend', status: 'DEEP_WORK' });

    expect(repository.saved).toEqual({ bio: 'Focado em backend', status: 'DEEP_WORK' });
  });
});
