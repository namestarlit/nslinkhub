import { OmitType } from '@nestjs/mapped-types';
import { CreateRepositoryDto } from './create-repository.dto';

export class CreateChildRepositoryDto extends OmitType(CreateRepositoryDto, [
  'parentRepositoryId',
] as const) {}
