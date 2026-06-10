export class Resource {
  id: string;
  name: string;
  type: string;
  location: string;
  description?: string | null;
  capacity?: number | null;
  category?: string | null;
  characteristics?: string[];
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
}
