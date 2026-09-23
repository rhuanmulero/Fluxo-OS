import { GovernanceModeName, ProjectModuleName } from '@prisma/client';

export class ModuleSettingResponseDto {
  constructor(
    readonly module: ProjectModuleName,
    readonly governance: GovernanceModeName,
    readonly configurable: boolean,
  ) {}
}
