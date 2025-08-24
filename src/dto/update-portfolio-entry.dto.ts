import { PartialType } from '@nestjs/swagger';
import { CreatePortfolioEntryDto } from './create-portfolio-entry.dto';

export class UpdatePortfolioEntryDto extends PartialType(
  CreatePortfolioEntryDto,
) {}
