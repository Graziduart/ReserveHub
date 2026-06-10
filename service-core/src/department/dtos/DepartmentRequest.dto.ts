import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class DepartmentRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sigla!: string;

  /** Maior valor = maior prioridade em conflitos entre departamentos (0–100). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  costCenterCode?: string;
}
