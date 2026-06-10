import { Department } from '../domain/Department';

export class DepartmentResponseDto {
  id: string;
  name: string;
  sigla: string;
  createdAt: Date;
  active: boolean;
  updatedAt: Date;

  constructor(department: Department) {
    Object.assign(this, department);
  }
}
