import { Resource } from '../domain/Resource';

export class ResourceResponseDto {
  id: string;
  name: string;
  type: string;
  location: string;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;

  constructor(resource: Resource) {
    Object.assign(this, resource);
  }
}
